import { createHash } from 'crypto';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { z } from 'zod';
import { validateAppCheckV2 } from '../../middleware/appCheck';

const CancelVideoSessionRequestSchema = z.object({
    sessionId: z.string().regex(/^[a-f0-9]{40}$/),
}).strict();

export interface CancelledVideoSession {
    sessionId: string;
    ownerUid: string;
    stagingBucket: string;
    stagingPath: string;
    status: 'cancelled';
    cancelledAt: string;
    updatedAt: string;
    terminalReceiptId: string;
    original?: unknown;
}

export interface VideoSessionCancellationStore {
    cancel(input: {
        sessionId: string;
        ownerUid: string;
        cancelledAt: string;
        terminalReceiptId: string;
    }): Promise<{ session: CancelledVideoSession; reused: boolean }>;
}

export interface VideoSessionStagingCleanup {
    deleteIfPresent(bucket: string, path: string): Promise<void>;
}

export function createFirestoreVideoSessionCancellationStore(
    db: FirebaseFirestore.Firestore = getFirestore(),
): VideoSessionCancellationStore {
    return {
        async cancel(input) {
            const ref = db.collection('videoSessions').doc(input.sessionId);
            return db.runTransaction(async (transaction) => {
                const snapshot = await transaction.get(ref);
                if (!snapshot.exists) {
                    throw new HttpsError('not-found', 'The video session does not exist.');
                }
                const session = snapshot.data() as Record<string, unknown>;
                if (session.ownerUid !== input.ownerUid) {
                    throw new HttpsError('permission-denied', 'The video session belongs to another owner.');
                }
                if (session.status === 'cancelled') {
                    return { session: session as unknown as CancelledVideoSession, reused: true };
                }
                if (!['uploading', 'uploaded', 'processing'].includes(String(session.status))) {
                    throw new HttpsError('failed-precondition', `A ${String(session.status)} session cannot be cancelled.`);
                }
                if (
                    typeof session.stagingBucket !== 'string'
                    || typeof session.stagingPath !== 'string'
                    || !session.stagingPath.startsWith(`session-media/${input.ownerUid}/${input.sessionId}/staging/`)
                ) {
                    throw new HttpsError('data-loss', 'The session staging identity is malformed.');
                }
                const update = {
                    status: 'cancelled' as const,
                    cancelledAt: input.cancelledAt,
                    updatedAt: input.cancelledAt,
                    terminalReceiptId: input.terminalReceiptId,
                };
                transaction.update(ref, update);
                return {
                    session: { ...session, ...update } as unknown as CancelledVideoSession,
                    reused: false,
                };
            });
        },
    };
}

export function createGcsVideoSessionStagingCleanup(
    storage: ReturnType<typeof getStorage> = getStorage(),
): VideoSessionStagingCleanup {
    return {
        async deleteIfPresent(bucket, path) {
            try {
                await storage.bucket(bucket).file(path).delete();
            } catch (error: unknown) {
                const code = Number(
                    error && typeof error === 'object' && 'code' in error
                        ? (error as { code?: unknown }).code
                        : undefined,
                );
                if (code !== 404) throw error;
            }
        },
    };
}

export async function cancelOwnedVideoSession(
    ownerUid: string,
    rawRequest: unknown,
    dependencies: {
        store: VideoSessionCancellationStore;
        cleanup: VideoSessionStagingCleanup;
        now: () => Date;
    },
): Promise<{ session: CancelledVideoSession; reused: boolean }> {
    const parsedOwner = z.string().trim().min(1).max(256).safeParse(ownerUid);
    const parsedRequest = CancelVideoSessionRequestSchema.safeParse(rawRequest);
    if (!parsedOwner.success || !parsedRequest.success) {
        throw new HttpsError('invalid-argument', 'A valid owner and video session ID are required.');
    }
    const cancelledAt = dependencies.now().toISOString();
    const terminalReceiptId = `cancel-${createHash('sha256')
        .update(`${parsedOwner.data}\0${parsedRequest.data.sessionId}`)
        .digest('hex')
        .slice(0, 48)}`;
    const result = await dependencies.store.cancel({
        sessionId: parsedRequest.data.sessionId,
        ownerUid: parsedOwner.data,
        cancelledAt,
        terminalReceiptId,
    });
    await dependencies.cleanup.deleteIfPresent(result.session.stagingBucket, result.session.stagingPath);
    return result;
}

export const cancelVideoSession = onCall(
    { timeoutSeconds: 30, memory: '512MiB', enforceAppCheck: false },
    async (request) => {
        validateAppCheckV2(request);
        if (!request.auth) {
            throw new HttpsError('unauthenticated', 'Authentication is required to cancel a video session.');
        }
        return cancelOwnedVideoSession(request.auth.uid, request.data, {
            store: createFirestoreVideoSessionCancellationStore(),
            cleanup: createGcsVideoSessionStagingCleanup(),
            now: () => new Date(),
        });
    },
);
