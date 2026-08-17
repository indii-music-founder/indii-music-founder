import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
    const add = vi.fn().mockResolvedValue({ id: 'audit-123' });
    const collection = vi.fn(() => ({ add }));
    const firestore = Object.assign(vi.fn(() => ({ collection })), {
        FieldValue: { serverTimestamp: vi.fn(() => 'SERVER_TIMESTAMP') },
    });
    return { add, collection, firestore };
});

vi.mock('firebase-admin', () => ({ firestore: mocks.firestore }));

vi.mock('firebase-functions/v2/https', () => {
    class HttpsError extends Error {
        constructor(public code: string, message: string) {
            super(message);
        }
    }
    return {
        HttpsError,
        onCall: vi.fn((_options: unknown, handler: unknown) => handler),
    };
});

import { SubscriptionTier } from '../../shared/subscription/types';
import { admitAuditLogWriteRequest, persistAuditEvent } from './logAuditEvent';

function admittedRequest() {
    return {
        auth: { uid: 'owner-123', token: { admin: false } },
        app: { appId: 'verified-app' },
        rawRequest: { method: 'POST', headers: {} },
        data: {},
    } as never;
}

describe('admitAuditLogWriteRequest', () => {
    beforeEach(() => vi.clearAllMocks());

    it('admits a verified, entitled request that passes Arcjet protection', async () => {
        const uid = await admitAuditLogWriteRequest(admittedRequest(), {
            validateAppCheck: vi.fn() as never,
            requireVerifiedEmail: vi.fn().mockReturnValue('owner-123') as never,
            resolveEntitlement: vi.fn().mockResolvedValue({ tier: SubscriptionTier.STUDIO }) as never,
            protect: vi.fn().mockResolvedValue({ allowed: true }) as never,
            policyForEntitlement: vi.fn().mockReturnValue('paid') as never,
        });

        expect(uid).toBe('owner-123');
    });

    it('fails closed when Arcjet denies the request with a rate limit', async () => {
        await expect(admitAuditLogWriteRequest(admittedRequest(), {
            validateAppCheck: vi.fn() as never,
            requireVerifiedEmail: vi.fn().mockReturnValue('owner-123') as never,
            resolveEntitlement: vi.fn().mockResolvedValue({ tier: SubscriptionTier.STUDIO }) as never,
            protect: vi.fn().mockResolvedValue({
                allowed: false,
                status: 429,
                code: 'RATE_LIMITED',
                message: 'Too many requests. Please slow down.',
                retryAfterSeconds: 60,
            }) as never,
            policyForEntitlement: vi.fn().mockReturnValue('paid') as never,
        })).rejects.toMatchObject({ code: 'resource-exhausted' });
    });

    it('fails closed when App Check validation throws', async () => {
        const appCheckError = new Error('Unauthorized: Missing App Check token.');
        (appCheckError as { code?: string }).code = 'failed-precondition';

        await expect(admitAuditLogWriteRequest(admittedRequest(), {
            validateAppCheck: vi.fn().mockImplementation(() => { throw appCheckError; }) as never,
            requireVerifiedEmail: vi.fn().mockReturnValue('owner-123') as never,
            resolveEntitlement: vi.fn().mockResolvedValue({ tier: SubscriptionTier.STUDIO }) as never,
            protect: vi.fn().mockResolvedValue({ allowed: true }) as never,
            policyForEntitlement: vi.fn().mockReturnValue('paid') as never,
        })).rejects.toMatchObject({ code: 'failed-precondition' });
        expect(mocks.add).not.toHaveBeenCalled();
    });
});

describe('persistAuditEvent', () => {
    beforeEach(() => vi.clearAllMocks());

    it('binds an agent tool outcome to the authenticated owner and server time', async () => {
        const result = await persistAuditEvent('owner-123', {
            action: 'agent.tool.generate_image',
            resourceId: 'agent/creative-director',
            severity: 'low',
            agentId: 'creative-director',
            status: 'success',
        });

        expect(mocks.collection).toHaveBeenCalledWith('audit_logs');
        expect(mocks.add).toHaveBeenCalledWith({
            action: 'agent.tool.generate_image',
            resourceId: 'agent/creative-director',
            severity: 'low',
            status: 'success',
            agentId: 'creative-director',
            userId: 'owner-123',
            timestamp: 'SERVER_TIMESTAMP',
            source: 'Studio_Agent',
        });
        expect(result).toMatchObject({ logId: 'audit-123', status: 'success' });
    });

    it('rejects unbounded or invalid client-supplied audit fields', async () => {
        await expect(persistAuditEvent('owner-123', {
            action: 'agent.tool.generate_image',
            resourceId: 'agent/creative-director',
            severity: 'low',
            agentId: 'x'.repeat(121),
            status: 'success',
        })).rejects.toMatchObject({ code: 'invalid-argument' });
        expect(mocks.add).not.toHaveBeenCalled();
    });
});
