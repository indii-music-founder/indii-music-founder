import { describe, expect, it } from 'vitest';
import { HttpsError } from 'firebase-functions/v2/https';
import { VideoSessionSchema } from '../../../../shared/src/schemas/sessionMedia';
import {
    createOwnedVideoSession,
    estimateSessionProxyCost,
    projectAllowsVideoSession,
    type VideoSessionClaimStore,
} from './createVideoSession';

function createMemoryStore(): VideoSessionClaimStore {
    const sessions = new Map<string, Record<string, unknown>>();
    return {
        async claim(proposed) {
            const existing = sessions.get(proposed.sessionId);
            if (existing) return { session: existing, created: false };
            sessions.set(proposed.sessionId, proposed);
            return { session: proposed, created: true };
        },
    };
}

const request = {
    organizationId: 'org-1',
    projectId: 'project-1',
    idempotencyKey: 'iphone-session-2026-07-21-take-1',
    expectedMimeType: 'video/quicktime',
    expectedByteSize: 2_000_000_000,
};

describe('createOwnedVideoSession', () => {
    it('returns one owner-scoped resumable destination for repeated requests without a public URL', async () => {
        const store = createMemoryStore();
        const dependencies = {
            store,
            bucketName: 'private-media-bucket',
            now: () => new Date('2026-07-21T18:00:00.000Z'),
            estimateCost: () => ({
                currency: 'USD' as const,
                amountMinor: 125,
                estimateVersion: 'session-proxy-cost.v1',
            }),
            authorizeProject: async () => undefined,
        };

        const first = await createOwnedVideoSession('artist-1', request, dependencies);
        const retry = await createOwnedVideoSession('artist-1', request, dependencies);

        expect(first.created).toBe(true);
        expect(retry.created).toBe(false);
        expect(retry.session).toEqual(first.session);
        expect(VideoSessionSchema.safeParse(first.session).success).toBe(true);
        expect(first.upload.storageUri).toBe(
            `gs://private-media-bucket/session-media/artist-1/${first.session.sessionId}/staging/original.mov`,
        );
        expect(first.upload).not.toHaveProperty('url');
        expect(first.upload.requiredMetadata).toMatchObject({
            ownerUid: 'artist-1',
            organizationId: 'org-1',
            projectId: 'project-1',
            sessionId: first.session.sessionId,
        });

        const otherOwner = await createOwnedVideoSession('artist-2', request, dependencies);
        expect(otherOwner.session.sessionId).not.toBe(first.session.sessionId);
        expect(otherOwner.upload.storageUri).toContain('/artist-2/');
    });

    it('rejects an unauthorized project before claiming an upload destination', async () => {
        await expect(createOwnedVideoSession('artist-2', request, {
            store: {
                async claim() {
                    throw new Error('claim must not run before authorization');
                },
            },
            bucketName: 'private-media-bucket',
            now: () => new Date('2026-07-21T18:00:00.000Z'),
            estimateCost: () => ({
                currency: 'USD',
                amountMinor: 125,
                estimateVersion: 'session-proxy-cost.v1',
            }),
            authorizeProject: async () => {
                throw new HttpsError('permission-denied', 'Project is not available to this owner.');
            },
        })).rejects.toMatchObject({ code: 'permission-denied' });
    });
});

describe('projectAllowsVideoSession', () => {
    it('requires the requested organization and accepts only the project owner or an organization member', () => {
        const project = { userId: 'artist-1', orgId: 'org-1' };
        const organization = { ownerId: 'artist-9', members: { 'artist-2': { role: 'member' } } };

        expect(projectAllowsVideoSession('artist-1', 'org-1', project, organization)).toBe(true);
        expect(projectAllowsVideoSession('artist-2', 'org-1', project, organization)).toBe(true);
        expect(projectAllowsVideoSession('artist-3', 'org-1', project, organization)).toBe(false);
        expect(projectAllowsVideoSession('artist-1', 'org-2', project, organization)).toBe(false);
        expect(projectAllowsVideoSession('artist-2', 'personal', { userId: 'artist-1', orgId: 'personal' })).toBe(false);
    });
});

describe('estimateSessionProxyCost', () => {
    it('uses server configuration and fails closed when pricing is unavailable', () => {
        expect(estimateSessionProxyCost(2 * 1024 * 1024 * 1024, {
            SESSION_PROXY_ESTIMATE_USD_PER_GIB: '0.18',
            SESSION_PROXY_ESTIMATE_VERSION: 'gcp-transcode-2026-07',
        })).toEqual({
            currency: 'USD',
            amountMinor: 36,
            estimateVersion: 'gcp-transcode-2026-07',
        });

        expect(() => estimateSessionProxyCost(1024, {})).toThrowError(
            expect.objectContaining({ code: 'failed-precondition' }),
        );
    });
});
