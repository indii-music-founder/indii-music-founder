import { describe, expect, it } from 'vitest';
import { HttpsError } from 'firebase-functions/v2/https';
import {
    cancelOwnedVideoSession,
    type CancelledVideoSession,
    type VideoSessionCancellationStore,
} from './cancelVideoSession';

const sessionId = 'a'.repeat(40);

function memoryStore(ownerUid = 'artist-1'): VideoSessionCancellationStore {
    let session: Record<string, unknown> = {
        sessionId,
        ownerUid,
        stagingBucket: 'private-media-bucket',
        stagingPath: `session-media/${ownerUid}/${sessionId}/staging/original.mov`,
        status: 'uploading',
    };
    return {
        async cancel(input) {
            if (session.ownerUid !== input.ownerUid) {
                throw new HttpsError('permission-denied', 'wrong owner');
            }
            if (session.status === 'cancelled') {
                return { session: session as unknown as CancelledVideoSession, reused: true };
            }
            session = {
                ...session,
                status: 'cancelled',
                cancelledAt: input.cancelledAt,
                updatedAt: input.cancelledAt,
                terminalReceiptId: input.terminalReceiptId,
            };
            return { session: session as unknown as CancelledVideoSession, reused: false };
        },
    };
}

describe('cancelOwnedVideoSession', () => {
    it('creates a retry-stable terminal receipt and removes only staging', async () => {
        const deleted: string[] = [];
        const dependencies = {
            store: memoryStore(),
            cleanup: {
                async deleteIfPresent(bucket: string, path: string) {
                    deleted.push(`gs://${bucket}/${path}`);
                },
            },
            now: () => new Date('2026-07-21T20:00:00.000Z'),
        };

        const first = await cancelOwnedVideoSession('artist-1', { sessionId }, dependencies);
        const retry = await cancelOwnedVideoSession('artist-1', { sessionId }, dependencies);

        expect(first.reused).toBe(false);
        expect(retry.reused).toBe(true);
        expect(first.session.terminalReceiptId).toBe(retry.session.terminalReceiptId);
        expect(first.session.status).toBe('cancelled');
        expect(deleted).toEqual([
            `gs://private-media-bucket/session-media/artist-1/${sessionId}/staging/original.mov`,
            `gs://private-media-bucket/session-media/artist-1/${sessionId}/staging/original.mov`,
        ]);
        expect(deleted.every((path) => path.includes('/staging/'))).toBe(true);
    });

    it('rejects cross-owner cancellation before cleanup', async () => {
        let cleanupCalled = false;
        await expect(cancelOwnedVideoSession('attacker', { sessionId }, {
            store: memoryStore('artist-1'),
            cleanup: {
                async deleteIfPresent() {
                    cleanupCalled = true;
                },
            },
            now: () => new Date('2026-07-21T20:00:00.000Z'),
        })).rejects.toMatchObject({ code: 'permission-denied' });
        expect(cleanupCalled).toBe(false);
    });
});
