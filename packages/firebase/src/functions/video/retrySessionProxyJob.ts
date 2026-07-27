import { getFirestore } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { z } from 'zod';

import { validateAppCheckV2 } from '../../middleware/appCheck';
import { dispatchSessionProxyJob, type DispatchSessionProxyJobResult } from './dispatchSessionProxyJob';
import type { FinalizedOriginalRef } from './finalizeVideoSessionUpload';

/**
 * ISSUE-1175 repair-order step 2/3: recovery for a stranded finalized original.
 *
 * `dispatchSessionProxyJob` is reachable from exactly one place — the
 * `onObjectFinalized` trigger in `finalizeVideoSessionUpload`, which fires only
 * on a *staging* object write. When the proxy worker is unconfigured or
 * unreachable, dispatch honestly records `proxyJob.status = 'blocked'` and
 * finalization still succeeds, which is the correct fail-closed behaviour.
 *
 * The gap that behaviour left: nothing could ever dispatch again. The claim
 * store already contains the `blocked -> dispatching` transition that a retry
 * needs (see `createFirestoreProxyJobClaimStore`), but no caller existed to
 * drive it, so the staging object is gone and the trigger cannot re-fire. Every
 * session uploaded during a worker outage was permanently stuck holding
 * finalized, hash-verified, already-paid-for bytes with no proxy and no route to
 * one. This callable is that route.
 *
 * It deliberately does NOT re-implement dispatch. It rebuilds the exact
 * `FinalizedOriginalRef` the trigger would have passed — from the immutable
 * `original` the finalizer already persisted — and hands it to the same
 * function, so both idempotency layers (transactional claim + deterministic
 * Cloud Tasks name) still apply. Retrying a session whose job is already queued
 * is therefore a no-op rather than a second transcode.
 */

const RetrySessionProxyJobRequestSchema = z.object({
    sessionId: z.string().regex(/^[a-f0-9]{40}$/),
}).strict();

/** The states from which a retry is meaningful. */
const RETRYABLE_JOB_STATUS = new Set(['blocked']);

export interface RetryableSessionOriginal {
    sessionId: string;
    original: FinalizedOriginalRef;
}

export interface VideoSessionProxyRetryStore {
    /**
     * Load a session that is genuinely eligible for re-dispatch, failing closed
     * on every other state rather than reporting a retry that cannot help.
     */
    loadRetryable(sessionId: string, ownerUid: string): Promise<RetryableSessionOriginal>;
}

export function createFirestoreVideoSessionProxyRetryStore(
    db: FirebaseFirestore.Firestore = getFirestore(),
): VideoSessionProxyRetryStore {
    return {
        async loadRetryable(sessionId, ownerUid) {
            const snapshot = await db.collection('videoSessions').doc(sessionId).get();
            if (!snapshot.exists) {
                throw new HttpsError('not-found', 'The video session does not exist.');
            }
            const session = snapshot.data() as Record<string, unknown>;

            if (session.ownerUid !== ownerUid) {
                // Same posture as cancelVideoSession: never disclose another
                // owner's session state through a differentiated error.
                throw new HttpsError('permission-denied', 'The video session belongs to another owner.');
            }

            // A manifest already exists — there is nothing to retry, and
            // re-dispatching would risk re-charging for work already delivered.
            if (session.proxyManifest) {
                throw new HttpsError('failed-precondition', 'This session already has a proxy manifest.');
            }

            if (session.status !== 'uploaded') {
                throw new HttpsError(
                    'failed-precondition',
                    `A ${String(session.status)} session has no finalized original to retry.`,
                );
            }

            const original = session.original as FinalizedOriginalRef | undefined;
            if (!original || typeof original !== 'object') {
                throw new HttpsError('failed-precondition', 'The session has no finalized original.');
            }
            // The original is the identity the whole idempotency scheme keys on.
            // A malformed one must not be silently forwarded to dispatch.
            if (
                original.ownerUid !== ownerUid
                || typeof original.generation !== 'string'
                || typeof original.sha256 !== 'string'
                || typeof original.bucket !== 'string'
                || typeof original.path !== 'string'
            ) {
                throw new HttpsError('data-loss', 'The finalized original identity is malformed.');
            }

            const job = session.proxyJob as { status?: string } | undefined;
            if (job && !RETRYABLE_JOB_STATUS.has(String(job.status))) {
                // `dispatching` / `queued` mean work is already in flight. Saying
                // "retried" here would be a fabricated success.
                throw new HttpsError(
                    'failed-precondition',
                    `A ${String(job.status)} proxy job is already in flight for this session.`,
                );
            }

            return { sessionId, original };
        },
    };
}

export async function retryOwnedSessionProxyJob(
    ownerUid: string,
    rawRequest: unknown,
    dependencies: {
        store: VideoSessionProxyRetryStore;
        dispatch?: typeof dispatchSessionProxyJob;
    },
): Promise<DispatchSessionProxyJobResult> {
    const parsedOwner = z.string().trim().min(1).max(256).safeParse(ownerUid);
    const parsedRequest = RetrySessionProxyJobRequestSchema.safeParse(rawRequest);
    if (!parsedOwner.success || !parsedRequest.success) {
        throw new HttpsError('invalid-argument', 'A valid owner and video session ID are required.');
    }

    const retryable = await dependencies.store.loadRetryable(
        parsedRequest.data.sessionId,
        parsedOwner.data,
    );

    const dispatch = dependencies.dispatch ?? dispatchSessionProxyJob;
    const result = await dispatch(retryable.sessionId, retryable.original);

    // Still blocked means the worker is *still* unconfigured. Returning this
    // verbatim keeps the caller honest: the retry ran, and it did not help.
    return result;
}

export const retrySessionProxyJob = onCall(
    { timeoutSeconds: 60, memory: '512MiB', enforceAppCheck: false },
    async (request) => {
        validateAppCheckV2(request);
        if (!request.auth) {
            throw new HttpsError('unauthenticated', 'Authentication is required to retry a proxy job.');
        }
        return retryOwnedSessionProxyJob(request.auth.uid, request.data, {
            store: createFirestoreVideoSessionProxyRetryStore(),
        });
    },
);
