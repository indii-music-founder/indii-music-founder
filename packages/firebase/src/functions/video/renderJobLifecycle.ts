import { HttpsError } from 'firebase-functions/v2/https';

const TERMINAL_STATUSES = new Set(['completed', 'failed', 'cancelled']);

export interface PrivateRenderJobIdentity {
    jobId: string;
    ownerUid: string;
    projectId: string;
}

export interface RenderJobTransitionResult {
    applied: boolean;
    status: string;
}

function normalizedStatus(value: unknown): string {
    return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function assertPrivateRenderAuthority(
    job: Record<string, unknown>,
    identity: PrivateRenderJobIdentity,
): void {
    if (
        job.id !== identity.jobId
        || job.userId !== identity.ownerUid
        || job.projectId !== identity.projectId
        || typeof job.orgId !== 'string'
        || !job.orgId
        || job.accessPolicy !== 'private-project-render.v1'
        || job.type !== 'render_stitch'
    ) {
        throw new Error('Private render job does not match its durable server authority.');
    }
}

export async function inspectPrivateRenderJob(
    db: FirebaseFirestore.Firestore,
    identity: PrivateRenderJobIdentity,
): Promise<{ status: string; terminal: boolean }> {
    const snapshot = await db.collection('videoJobs').doc(identity.jobId).get();
    if (!snapshot.exists) {
        throw new Error('Private render job authority is missing.');
    }
    const job = snapshot.data() as Record<string, unknown>;
    assertPrivateRenderAuthority(job, identity);
    const status = normalizedStatus(job.status);
    if (!status) throw new Error('Private render job status is invalid.');
    return { status, terminal: TERMINAL_STATUSES.has(status) };
}

/**
 * Compare-and-set a private render lifecycle transition. Firestore retries the
 * transaction if cancellation changes the document after this read, so a
 * cancelled or terminal job can never be moved back to stitching/completed.
 */
export async function transitionPrivateRenderJob(
    db: FirebaseFirestore.Firestore,
    input: {
        identity: PrivateRenderJobIdentity;
        allowedStatuses: readonly string[];
        nextStatus: string;
        update: Record<string, unknown>;
    },
): Promise<RenderJobTransitionResult> {
    const ref = db.collection('videoJobs').doc(input.identity.jobId);
    return db.runTransaction(async transaction => {
        const snapshot = await transaction.get(ref);
        if (!snapshot.exists) {
            throw new Error('Private render job authority is missing.');
        }
        const job = snapshot.data() as Record<string, unknown>;
        assertPrivateRenderAuthority(job, input.identity);
        const status = normalizedStatus(job.status);
        if (
            TERMINAL_STATUSES.has(status)
            || !input.allowedStatuses.map(normalizedStatus).includes(status)
        ) {
            return { applied: false, status };
        }
        transaction.update(ref, {
            ...input.update,
            status: input.nextStatus,
        });
        return { applied: true, status: input.nextStatus };
    });
}

/**
 * Cancellation and completion share the same authoritative transaction. The
 * creative_jobs document is only a compatibility mirror and is updated in the
 * same transaction when it exists.
 */
export async function cancelOwnedVideoJobTransactionally(
    db: FirebaseFirestore.Firestore,
    input: {
        jobId: string;
        ownerUid: string;
        cancelledAt: string;
    },
): Promise<{ status: string; changed: boolean }> {
    const videoRef = db.collection('videoJobs').doc(input.jobId);
    const creativeRef = db.collection('creative_jobs').doc(input.jobId);
    return db.runTransaction(async transaction => {
        const [videoSnapshot, creativeSnapshot] = await Promise.all([
            transaction.get(videoRef),
            transaction.get(creativeRef),
        ]);
        const authoritative = videoSnapshot.exists ? videoSnapshot : creativeSnapshot;
        if (!authoritative.exists) {
            throw new HttpsError('not-found', 'Video job not found.');
        }
        const job = authoritative.data() as Record<string, unknown>;
        if (job.userId !== input.ownerUid) {
            throw new HttpsError('permission-denied', 'You do not own this video job.');
        }
        const status = normalizedStatus(job.status);
        if (TERMINAL_STATUSES.has(status)) {
            return { status, changed: false };
        }
        const update = {
            status: 'cancelled',
            error: 'Cancelled by user',
            cancelledAt: input.cancelledAt,
            updatedAt: input.cancelledAt,
        };
        if (videoSnapshot.exists) transaction.update(videoRef, update);
        if (creativeSnapshot.exists) transaction.update(creativeRef, update);
        return { status: 'cancelled', changed: true };
    });
}
