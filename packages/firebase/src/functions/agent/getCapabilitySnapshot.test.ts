import { describe, expect, it, vi } from 'vitest';

import { SubscriptionTier } from '../../shared/subscription/types';
import {
    CapabilityMapSchema,
    CapabilitySnapshotSchema,
    CapabilityStatusSchema,
} from '../../shared/capabilitySnapshot';
import {
    CapabilityMapSchema as SharedCapabilityMapSchema,
    CapabilitySnapshotSchema as SharedCapabilitySnapshotSchema,
    CapabilityStatusSchema as SharedCapabilityStatusSchema,
} from '../../../../shared/src/schemas/capabilitySnapshot';
import {
    admitCapabilitySnapshotRequest,
    assertEmptyCapabilityRequestData,
    buildServerCapabilitySnapshot,
    capabilitySnapshotCallableOptions,
    resolveCapabilitySnapshotRequest,
    type CapabilityEvidenceReader,
} from './getCapabilitySnapshot';

const NOW = Date.parse('2026-07-30T12:00:00.000Z');

function reader(overrides: Partial<CapabilityEvidenceReader> = {}): CapabilityEvidenceReader {
    return {
        verifyWorkspaceAccess: vi.fn().mockResolvedValue(undefined),
        verifyMemoryAccess: vi.fn().mockResolvedValue(undefined),
        listRecentMediaJobs: vi.fn().mockResolvedValue([]),
        listSocialConnections: vi.fn().mockResolvedValue([]),
        ...overrides,
    };
}

function entitlement(uid = 'artist-1') {
    return {
        schemaVersion: 'account-entitlement.v1' as const,
        uid,
        tier: SubscriptionTier.FREE,
        status: 'active' as const,
        source: 'verified_email' as const,
        grantId: 'grant-1',
    };
}

function admittedRequest(overrides: Record<string, unknown> = {}) {
    return {
        auth: { uid: 'artist-1', token: { admin: false } },
        app: { appId: 'verified-app' },
        data: {},
        rawRequest: { method: 'POST', headers: {} },
        ...overrides,
    } as never;
}

describe('server-attested Boardroom capability snapshot', () => {
    it('requires App Check before entitlement or Arcjet admission', async () => {
        const validateAppCheck = vi.fn(() => {
            throw new Error('Unauthorized: Missing App Check token.');
        });
        const resolveEntitlement = vi.fn();
        const protect = vi.fn();

        await expect(admitCapabilitySnapshotRequest(admittedRequest(), {
            validateAppCheck,
            resolveEntitlement,
            protect,
        })).rejects.toThrow('Missing App Check');
        expect(resolveEntitlement).not.toHaveBeenCalled();
        expect(protect).not.toHaveBeenCalled();
    });

    it('rejects unauthenticated callers before resolving entitlement', async () => {
        const resolveEntitlement = vi.fn();

        await expect(admitCapabilitySnapshotRequest(
            admittedRequest({ auth: undefined }),
            { validateAppCheck: vi.fn(), resolveEntitlement },
        )).rejects.toMatchObject({ code: 'unauthenticated' });
        expect(resolveEntitlement).not.toHaveBeenCalled();
    });

    it('rejects accounts without a verified server entitlement', async () => {
        const protect = vi.fn();
        const resolveEntitlement = vi.fn().mockRejectedValue(
            new Error('Verify your email before activating an indii entitlement.'),
        );

        await expect(admitCapabilitySnapshotRequest(admittedRequest(), {
            validateAppCheck: vi.fn(),
            resolveEntitlement,
            protect,
        })).rejects.toThrow('Verify your email');
        expect(resolveEntitlement).toHaveBeenCalledWith('artist-1');
        expect(protect).not.toHaveBeenCalled();
    });

    it('rejects all client account, session, and tier claims', async () => {
        const resolveEntitlement = vi.fn().mockResolvedValue(entitlement());
        const protect = vi.fn().mockResolvedValue({ allowed: true });
        const policyForEntitlement = vi.fn().mockReturnValue('verified-free');

        await expect(admitCapabilitySnapshotRequest(admittedRequest({
            data: {
                uid: 'other-artist',
                userId: 'other-artist',
                tier: 'founder',
                session: 'claimed-session',
            },
        }), {
            validateAppCheck: vi.fn(),
            resolveEntitlement,
            protect,
            policyForEntitlement,
        })).rejects.toMatchObject({ code: 'invalid-argument' });

        expect(resolveEntitlement).not.toHaveBeenCalled();
        expect(protect).not.toHaveBeenCalled();
        expect(() => assertEmptyCapabilityRequestData({ session: 'claimed' }))
            .toThrow('does not accept account, session, or plan claims');
    });

    it('derives owner and rate policy only from the authenticated server entitlement', async () => {
        const resolveEntitlement = vi.fn().mockResolvedValue(entitlement());
        const protect = vi.fn().mockResolvedValue({ allowed: true });
        const policyForEntitlement = vi.fn().mockReturnValue('verified-free');
        const evidenceReader = reader();

        const result = await resolveCapabilitySnapshotRequest(admittedRequest(), {
            validateAppCheck: vi.fn(),
            resolveEntitlement,
            protect,
            policyForEntitlement,
            reader: evidenceReader,
            now: NOW,
        });

        expect(result.schemaVersion).toBe('capability-snapshot.v1');
        expect(resolveEntitlement).toHaveBeenCalledWith('artist-1');
        expect(policyForEntitlement).toHaveBeenCalledWith({
            tier: SubscriptionTier.FREE,
            isAdmin: false,
        });
        expect(protect).toHaveBeenCalledWith(
            expect.objectContaining({ method: 'POST' }),
            expect.objectContaining({ userId: 'artist-1', policy: 'verified-free' }),
        );
        expect(evidenceReader.verifyWorkspaceAccess).toHaveBeenCalledWith('artist-1');
        expect(evidenceReader.verifyMemoryAccess).toHaveBeenCalledWith('artist-1');
        expect(evidenceReader.listRecentMediaJobs).toHaveBeenCalledWith('artist-1');
        expect(evidenceReader.listSocialConnections).toHaveBeenCalledWith('artist-1');
    });

    it('fails closed when Arcjet denies the authenticated request', async () => {
        const protect = vi.fn().mockResolvedValue({
            allowed: false,
            status: 429,
            code: 'RATE_LIMITED',
            message: 'Too many requests. Please slow down.',
            retryAfterSeconds: 20,
        });

        await expect(admitCapabilitySnapshotRequest(admittedRequest(), {
            validateAppCheck: vi.fn(),
            resolveEntitlement: vi.fn().mockResolvedValue(entitlement()),
            protect,
            policyForEntitlement: vi.fn().mockReturnValue('verified-free'),
        })).rejects.toMatchObject({
            code: 'resource-exhausted',
            details: { code: 'RATE_LIMITED', retryAfterSeconds: 20 },
        });
    });

    it('attests only recent successful owned media jobs and reachable durable stores', async () => {
        const evidenceReader = reader({
            listRecentMediaJobs: vi.fn().mockResolvedValue([
                { type: 'image', status: 'completed', completedAt: NOW - 60_000 },
                { type: 'video', status: 'completed', completedAt: NOW - 8 * 24 * 60 * 60_000 },
                { type: 'video', status: 'failed', completedAt: NOW - 60_000 },
            ]),
        });

        const snapshot = await buildServerCapabilitySnapshot('artist-1', {
            reader: evidenceReader,
            now: NOW,
        });

        expect(CapabilitySnapshotSchema.parse(snapshot)).toEqual(snapshot);
        expect(snapshot.capabilities.durable_workspace.status).toBe('available');
        expect(snapshot.capabilities.durable_memory.status).toBe('available');
        expect(snapshot.capabilities.image_generation.status).toBe('available');
        expect(snapshot.capabilities.video_generation.status).toBe('unverified');
        expect(evidenceReader.listRecentMediaJobs).toHaveBeenCalledWith('artist-1');
    });

    it('never caches media availability beyond the successful job evidence window', async () => {
        const evidenceExpiresAt = NOW + 30_000;
        const completedAt = evidenceExpiresAt - 7 * 24 * 60 * 60_000;
        const snapshot = await buildServerCapabilitySnapshot('artist-1', {
            reader: reader({
                listRecentMediaJobs: vi.fn().mockResolvedValue([
                    { type: 'image', status: 'completed', completedAt },
                ]),
            }),
            now: NOW,
        });

        expect(snapshot.capabilities.image_generation.status).toBe('available');
        expect(snapshot.capabilities.image_generation.expiresAt).toBe(evidenceExpiresAt);
    });

    it('downgrades missing or expired social connections and never claims calendar integration', async () => {
        const missing = await buildServerCapabilitySnapshot('artist-1', {
            reader: reader(),
            now: NOW,
        });
        const expired = await buildServerCapabilitySnapshot('artist-1', {
            reader: reader({
                listSocialConnections: vi.fn().mockResolvedValue([
                    { accessToken: 'server-secret', expiresAt: NOW - 1 },
                ]),
            }),
            now: NOW,
        });

        for (const snapshot of [missing, expired]) {
            expect(snapshot.capabilities.social_connection.status).toBe('blocked');
            expect(snapshot.capabilities.social_publishing.status).toBe('blocked');
            expect(snapshot.capabilities.social_publishing.approvalRequired).toBe(true);
            expect(snapshot.capabilities.calendar_connection.status).toBe('blocked');
            expect(snapshot.capabilities.calendar_actions.status).toBe('blocked');
            expect(JSON.stringify(snapshot)).not.toContain('server-secret');
        }
    });

    it('never caches an available social connection beyond its owned token expiry', async () => {
        const tokenExpiresAt = NOW + 30_000;
        const snapshot = await buildServerCapabilitySnapshot('artist-1', {
            reader: reader({
                listSocialConnections: vi.fn().mockResolvedValue([
                    { accessToken: 'server-secret', expiresAt: tokenExpiresAt },
                ]),
            }),
            now: NOW,
        });

        expect(snapshot.capabilities.social_connection.status).toBe('available');
        expect(snapshot.capabilities.social_connection.expiresAt).toBe(tokenExpiresAt);
        expect(snapshot.capabilities.social_publishing.expiresAt).toBe(tokenExpiresAt);
        expect(JSON.stringify(snapshot)).not.toContain('server-secret');
    });

    it('marks transport failures and unknown specialist health unverified', async () => {
        const unavailable = vi.fn().mockRejectedValue(new Error('transport failed'));
        const snapshot = await buildServerCapabilitySnapshot('artist-1', {
            reader: reader({
                verifyWorkspaceAccess: unavailable,
                verifyMemoryAccess: unavailable,
                listRecentMediaJobs: unavailable,
                listSocialConnections: unavailable,
            }),
            now: NOW,
        });

        expect(snapshot.capabilities.durable_workspace.status).toBe('unverified');
        expect(snapshot.capabilities.durable_memory.status).toBe('unverified');
        expect(snapshot.capabilities.image_generation.status).toBe('unverified');
        expect(snapshot.capabilities.video_generation.status).toBe('unverified');
        expect(snapshot.capabilities.social_connection.status).toBe('unverified');
        expect(snapshot.capabilities.specialist_routing.status).toBe('unverified');
    });

    it('honors explicit runtime disables without converting unknown state to available', async () => {
        const snapshot = await buildServerCapabilitySnapshot('artist-1', {
            reader: reader({
                listRecentMediaJobs: vi.fn().mockResolvedValue([
                    { type: 'image', status: 'completed', completedAt: NOW - 1 },
                    { type: 'video', status: 'completed', completedAt: NOW - 1 },
                ]),
            }),
            now: NOW,
            specialistRoutingDisabled: true,
            imageGenerationDisabled: true,
            videoGenerationDisabled: true,
        });

        expect(snapshot.capabilities.specialist_routing.status).toBe('blocked');
        expect(snapshot.capabilities.image_generation.status).toBe('blocked');
        expect(snapshot.capabilities.video_generation.status).toBe('blocked');
    });

    it('returns only the versioned safe public contract', async () => {
        const snapshot = await buildServerCapabilitySnapshot('artist-1', {
            reader: reader(),
            now: NOW,
        });
        const serialized = JSON.stringify(snapshot);

        expect(snapshot.schemaVersion).toBe('capability-snapshot.v1');
        expect(snapshot.expiresAt).toBeGreaterThan(snapshot.observedAt);
        expect(serialized).not.toMatch(/endpoint|provider|accessToken|tool|security|incident/i);
        expect(capabilitySnapshotCallableOptions.enforceAppCheck).toBe(true);
        expect(SharedCapabilitySnapshotSchema.parse(snapshot)).toEqual(snapshot);
    });

    it('guards the Firebase CommonJS schema copy against shared-contract drift', async () => {
        expect(CapabilityStatusSchema.options).toEqual(SharedCapabilityStatusSchema.options);
        expect(Object.keys(CapabilityMapSchema.shape).sort())
            .toEqual(Object.keys(SharedCapabilityMapSchema.shape).sort());
        const snapshot = await buildServerCapabilitySnapshot('artist-1', {
            reader: reader(),
            now: NOW,
        });
        expect(CapabilitySnapshotSchema.parse(
            SharedCapabilitySnapshotSchema.parse(snapshot),
        )).toEqual(snapshot);
    });
});
