import { describe, expect, it, vi } from 'vitest';

import { SubscriptionTier } from '../../shared/subscription/types';
import {
    admitOrganizationAccessRequest,
    organizationAccessCallableOptions,
    resolveOrganizationAccessMatrix,
    resolveUpdateOrganizationMemberAccess,
    type OrganizationAccessStore,
} from './organizationAccess';

function request(data: unknown, uid = 'owner-1') {
    return {
        auth: { uid, token: { admin: false } },
        app: { appId: 'verified-app' },
        data,
        rawRequest: { method: 'POST', headers: {} },
    } as never;
}

function store(overrides: Partial<OrganizationAccessStore> = {}): OrganizationAccessStore {
    return {
        getOrganization: vi.fn().mockResolvedValue({
            ownerId: 'owner-1',
            members: ['owner-1', 'manager-1', 'member-1'],
            memberRoles: {
                'owner-1': 'owner',
                'manager-1': 'manager',
                'member-1': 'member',
            },
        }),
        getPolicies: vi.fn().mockResolvedValue(new Map()),
        updateMemberPolicy: vi.fn().mockResolvedValue(undefined),
        ...overrides,
    };
}

describe('organization access control', () => {
    it('returns the owner an immutable all-module row and role defaults for every member', async () => {
        const result = await resolveOrganizationAccessMatrix(
            request({ orgId: 'org-1' }),
            { admit: vi.fn().mockResolvedValue('owner-1'), store: store() },
        );

        expect(result.canManage).toBe(true);
        expect(result.members).toHaveLength(3);
        expect(result.members[0]).toMatchObject({
            userId: 'owner-1',
            role: 'owner',
            source: 'owner',
        });
        expect(result.members[0]!.allowedModules).toContain('security');
        expect(result.members.find(member => member.userId === 'manager-1')).toMatchObject({
            role: 'manager',
            source: 'role-default',
        });
        expect(result.members.find(member => member.userId === 'manager-1')!.allowedModules)
            .not.toContain('security');
        expect(JSON.stringify(result)).not.toContain('@example.com');
    });

    it('limits a non-owner response to their own effective policy', async () => {
        const accessStore = store({
            getPolicies: vi.fn().mockResolvedValue(new Map([['member-1', {
                role: 'member',
                allowedModules: ['files', 'notes'],
                updatedAt: { toDate: () => new Date('2026-08-08T12:00:00.000Z') },
            }]])),
        });

        const result = await resolveOrganizationAccessMatrix(
            request({ orgId: 'org-1' }, 'member-1'),
            { admit: vi.fn().mockResolvedValue('member-1'), store: accessStore },
        );

        expect(result.canManage).toBe(false);
        expect(result.members).toEqual([expect.objectContaining({
            userId: 'member-1',
            role: 'member',
            allowedModules: ['files', 'notes'],
            source: 'explicit',
            updatedAt: '2026-08-08T12:00:00.000Z',
        })]);
        expect(accessStore.getPolicies).toHaveBeenCalledWith('org-1', ['member-1']);
    });

    it('ignores a stale policy whose role no longer matches organization authority', async () => {
        const accessStore = store({
            getPolicies: vi.fn().mockResolvedValue(new Map([['member-1', {
                role: 'manager',
                allowedModules: ['security'],
            }]])),
        });
        const result = await resolveOrganizationAccessMatrix(
            request({ orgId: 'org-1' }, 'member-1'),
            { admit: vi.fn().mockResolvedValue('member-1'), store: accessStore },
        );

        expect(result.members[0]).toMatchObject({ role: 'member', source: 'role-default' });
        expect(result.members[0]!.allowedModules).not.toContain('security');
    });

    it('writes an owner-authorized, canonical policy and audit transaction request', async () => {
        const accessStore = store();
        const result = await resolveUpdateOrganizationMemberAccess(
            request({
                orgId: 'org-1',
                targetUserId: 'member-1',
                role: 'producer',
                allowedModules: ['notes', 'creative', 'notes'],
            }),
            {
                admit: vi.fn().mockResolvedValue('owner-1'),
                store: accessStore,
                now: () => new Date('2026-08-08T13:00:00.000Z'),
            },
        );

        expect(accessStore.updateMemberPolicy).toHaveBeenCalledWith({
            orgId: 'org-1',
            actorUserId: 'owner-1',
            targetUserId: 'member-1',
            role: 'producer',
            allowedModules: ['creative', 'notes'],
            nowIso: '2026-08-08T13:00:00.000Z',
        });
        expect(result).toMatchObject({
            userId: 'member-1',
            role: 'producer',
            allowedModules: ['creative', 'notes'],
            source: 'explicit',
        });
    });

    it('denies non-owner updates and any attempt to reduce owner access', async () => {
        await expect(resolveUpdateOrganizationMemberAccess(
            request({
                orgId: 'org-1',
                targetUserId: 'member-1',
                role: 'member',
                allowedModules: [],
            }, 'manager-1'),
            { admit: vi.fn().mockResolvedValue('manager-1'), store: store() },
        )).rejects.toMatchObject({ code: 'permission-denied' });

        await expect(resolveUpdateOrganizationMemberAccess(
            request({
                orgId: 'org-1',
                targetUserId: 'owner-1',
                role: 'member',
                allowedModules: [],
            }),
            { admit: vi.fn().mockResolvedValue('owner-1'), store: store() },
        )).rejects.toMatchObject({ code: 'failed-precondition' });
    });

    it('strictly rejects unknown fields and forged owner roles before admission', async () => {
        const admit = vi.fn();
        await expect(resolveOrganizationAccessMatrix(
            request({ orgId: 'org-1', tier: 'founder' }),
            { admit, store: store() },
        )).rejects.toMatchObject({ code: 'invalid-argument' });
        await expect(resolveUpdateOrganizationMemberAccess(
            request({
                orgId: 'org-1',
                targetUserId: 'member-1',
                role: 'owner',
                allowedModules: [],
            }),
            { admit, store: store() },
        )).rejects.toMatchObject({ code: 'invalid-argument' });
        expect(admit).not.toHaveBeenCalled();
    });

    it('requires App Check, server entitlement, and an allowed Arcjet decision', async () => {
        const validateAppCheck = vi.fn();
        const resolveEntitlement = vi.fn().mockResolvedValue({
            tier: SubscriptionTier.FREE,
        });
        const protect = vi.fn().mockResolvedValue({ allowed: true });
        const uid = await admitOrganizationAccessRequest(
            request({ orgId: 'org-1' }),
            'organization-access-read',
            {
                validateAppCheck,
                resolveEntitlement: resolveEntitlement as never,
                protect,
                policyForEntitlement: vi.fn().mockReturnValue('verified-free'),
            },
        );

        expect(uid).toBe('owner-1');
        expect(validateAppCheck).toHaveBeenCalledOnce();
        expect(resolveEntitlement).toHaveBeenCalledWith('owner-1');
        expect(protect).toHaveBeenCalledWith(
            expect.objectContaining({ method: 'POST' }),
            expect.objectContaining({ userId: 'owner-1', policy: 'verified-free' }),
        );
        expect(organizationAccessCallableOptions).toMatchObject({
            enforceAppCheck: true,
            region: 'us-central1',
        });
    });

    it('fails closed when Arcjet denies the request', async () => {
        await expect(admitOrganizationAccessRequest(
            request({ orgId: 'org-1' }),
            'organization-access-update',
            {
                validateAppCheck: vi.fn(),
                resolveEntitlement: vi.fn().mockResolvedValue({ tier: SubscriptionTier.FREE }) as never,
                protect: vi.fn().mockResolvedValue({
                    allowed: false,
                    status: 429,
                    code: 'RATE_LIMITED',
                    message: 'Too many requests.',
                    retryAfterSeconds: 10,
                }),
                policyForEntitlement: vi.fn().mockReturnValue('verified-free'),
            },
        )).rejects.toMatchObject({
            code: 'resource-exhausted',
            details: { code: 'RATE_LIMITED', retryAfterSeconds: 10 },
        });
    });
});
