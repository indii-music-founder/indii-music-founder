import { describe, expect, it } from 'vitest';
import { HttpsError } from 'firebase-functions/v2/https';
import { VideoSessionSchema } from '../../../../shared/src/schemas/sessionMedia';
import {
    createOwnedVideoSession,
    estimateSessionProxyCost,
    projectAllowsVideoSession,
    type PersistedVideoSessionUploadGrant,
    type VideoSessionClaimStore,
    type VideoSessionUploadGrantStore,
} from './createVideoSession';

function createMemoryStore(): VideoSessionClaimStore {
    // Derived from the interface rather than restated, so the double cannot drift
    // from the collaborator it stands in for.
    type Proposed = Parameters<VideoSessionClaimStore['claim']>[0];
    const sessions = new Map<string, Proposed>();
    return {
        async claim(proposed) {
            const existing = sessions.get(proposed.sessionId);
            if (existing) return { session: existing, created: false };
            sessions.set(proposed.sessionId, proposed);
            return { session: proposed, created: true };
        },
    };
}

function createMemoryGrantStore(): VideoSessionUploadGrantStore & { writes: number } {
    const grants = new Map<string, PersistedVideoSessionUploadGrant>();
    return {
        writes: 0,
        async get(sessionId) {
            return grants.get(sessionId);
        },
        async claim(proposed) {
            const existing = grants.get(proposed.sessionId);
            if (existing) return { grant: existing, created: false };
            grants.set(proposed.sessionId, proposed);
            this.writes += 1;
            return { grant: proposed, created: true };
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
        const grants = createMemoryGrantStore();
        let resumableSessionsCreated = 0;
        const costReservationIds = new Set<string>();
        const dependencies = {
            store,
            grants,
            bucketName: 'private-media-bucket',
            now: () => new Date('2026-07-21T18:00:00.000Z'),
            allowedOrigin: 'https://app.indii.music',
            createResumableUpload: async () => {
                resumableSessionsCreated += 1;
                return 'https://storage.googleapis.test/upload/resumable-owner-1';
            },
            estimateCost: () => ({
                currency: 'USD' as const,
                amountMinor: 125,
                estimateVersion: 'session-proxy-cost.v1',
            }),
            reserveCost: async ({ sessionId }: { sessionId: string }) => {
                const reservationId = `video-session-${sessionId}`;
                costReservationIds.add(reservationId);
                return reservationId;
            },
            authorizeProject: async () => undefined,
        };

        const first = await createOwnedVideoSession('artist-1', request, dependencies);
        const retry = await createOwnedVideoSession('artist-1', request, dependencies);

        expect(first.created).toBe(true);
        expect(retry.created).toBe(false);
        expect(retry.session).toEqual(first.session);
        expect(retry.upload.resumableSessionUri).toBe(first.upload.resumableSessionUri);
        expect(resumableSessionsCreated).toBe(1);
        expect(grants.writes).toBe(1);
        expect(costReservationIds.size).toBe(1);
        expect(first.session.costReservationId).toBe(`video-session-${first.session.sessionId}`);
        expect(VideoSessionSchema.safeParse(first.session).success).toBe(true);
        expect(first.upload.storageUri).toBe(
            `gs://private-media-bucket/session-media/artist-1/${first.session.sessionId}/staging/original.mov`,
        );
        expect(first.upload).toMatchObject({
            protocol: 'gcs-resumable.v1',
            resumableSessionUri: 'https://storage.googleapis.test/upload/resumable-owner-1',
            chunkSizeBytes: 8 * 1024 * 1024,
            expiresAt: '2026-07-27T18:00:00.000Z',
        });
        expect(first.upload).not.toHaveProperty('url');
        expect(first.upload.requiredMetadata).toMatchObject({
            ownerUid: 'artist-1',
            organizationId: 'org-1',
            projectId: 'project-1',
            sessionId: first.session.sessionId,
        });

        const otherOwner = await createOwnedVideoSession('artist-2', request, {
            ...dependencies,
            createResumableUpload: async () => {
                resumableSessionsCreated += 1;
                return 'https://storage.googleapis.test/upload/resumable-owner-2';
            },
        });
        expect(otherOwner.session.sessionId).not.toBe(first.session.sessionId);
        expect(otherOwner.upload.storageUri).toContain('/artist-2/');
        expect(otherOwner.upload.resumableSessionUri).not.toBe(first.upload.resumableSessionUri);
    });

    it('rejects an unauthorized project before claiming an upload destination', async () => {
        await expect(createOwnedVideoSession('artist-2', request, {
            store: {
                async claim() {
                    throw new Error('claim must not run before authorization');
                },
            },
            grants: createMemoryGrantStore(),
            bucketName: 'private-media-bucket',
            now: () => new Date('2026-07-21T18:00:00.000Z'),
            allowedOrigin: 'https://app.indii.music',
            createResumableUpload: async () => {
                throw new Error('upload grant must not be created before authorization');
            },
            estimateCost: () => ({
                currency: 'USD',
                amountMinor: 125,
                estimateVersion: 'session-proxy-cost.v1',
            }),
            reserveCost: async () => {
                throw new Error('cost reservation must not run before authorization');
            },
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
