import { onSchedule } from 'firebase-functions/v2/scheduler';
import * as admin from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { finalizeOperationReservation } from '../billing/enforceOperationCost';
import { GATEWAY_VIDEO_WORKER_VERSION } from '../creative/videoJobAuthority';

/**
 * Reclaims gateway video jobs stuck in `processing` (a crashed/killed
 * callable never flips its own status — the gateway timeout is 540s, so
 * nothing legitimate outlives that). Boundedly re-queues jobs that never
 * reached the provider, and makes jobs with an ambiguous provider outcome
 * terminal while reconciling their cost hold from the durable evidence.
 *
 * The orchestrator is an onDocumentWritten trigger, so the re-queue write
 * re-triggers the atomic claim; the job runs again.
 */

const STUCK_AFTER_MS = 12 * 60 * 1000; // > gateway callable timeout (540s)
const MAX_REQUEUES = 2;

export interface VideoReaperResult {
    requeued: number;
    failed: number;
    queuedTouched: number;
}

export async function reclaimStuckGatewayVideoJobs(
    now: Date = new Date(),
    db: admin.firestore.Firestore = admin.firestore(),
): Promise<VideoReaperResult> {
    const cutoff = admin.firestore.Timestamp.fromMillis(now.getTime() - STUCK_AFTER_MS);
    const [stuckProcessing, stuckQueued] = await Promise.all([
        db.collection('videoJobs')
            .where('status', '==', 'processing')
            .where('updatedAt', '<=', cutoff)
            .limit(50)
            .get(),
        db.collection('videoJobs')
            .where('status', '==', 'queued')
            .where('updatedAt', '<=', cutoff)
            .limit(50)
            .get(),
    ]);

    const result: VideoReaperResult = { requeued: 0, failed: 0, queuedTouched: 0 };

    const isGatewayJob = (job: Record<string, unknown>): boolean =>
        job.type === 'video' && job.workerVersion === GATEWAY_VIDEO_WORKER_VERSION;

    const terminalize = async (
        doc: admin.firestore.DocumentSnapshot,
        job: Record<string, unknown>,
        reason: string,
    ): Promise<void> => {
        const jobId = doc.id;
        const userId = typeof job.userId === 'string' ? job.userId : null;
        const costReservationId = typeof job.costReservationId === 'string' ? job.costReservationId : null;
        const submissionState = typeof job.providerSubmissionState === 'string'
            ? job.providerSubmissionState
            : 'not_submitted';

        let reconciliationRequired = true;
        if (userId && costReservationId) {
            try {
                // Fail closed financially: an attempted provider submission
                // may still have been billed, so an ambiguous outcome settles
                // the hold; only a provably un-submitted job is voided.
                await finalizeOperationReservation({
                    userId,
                    operationId: costReservationId,
                    outcome: submissionState === 'not_submitted' ? 'VOIDED' : 'SETTLED',
                    jobId,
                });
                reconciliationRequired = false;
            } catch (error) {
                console.error('[VideoReaper] Hold reconciliation failed', {
                    jobId,
                    error: error instanceof Error ? error.message : String(error),
                });
            }
        }

        await doc.ref.update({
            status: 'failed',
            error: reason,
            reconciliationRequired,
            failedAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
        });
        result.failed += 1;
    };

    for (const doc of stuckProcessing.docs) {
        const job = doc.data() as Record<string, unknown>;
        if (!isGatewayJob(job)) continue;
        const submissionState = typeof job.providerSubmissionState === 'string'
            ? job.providerSubmissionState
            : 'not_submitted';
        const requeueCount = typeof job.requeueCount === 'number' ? job.requeueCount : 0;

        // A job whose provider submission outcome is unknown must NEVER be
        // re-run — the retry would re-submit billable work. Terminalize it
        // and reconcile the hold from the durable evidence instead.
        if (submissionState !== 'not_submitted' || requeueCount >= MAX_REQUEUES) {
            await terminalize(
                doc,
                job,
                submissionState === 'not_submitted'
                    ? 'Video job was stuck before any provider submission and exhausted its re-queue budget.'
                    : 'Video job was stuck after a provider submission with an unknown outcome.',
            );
            continue;
        }

        await doc.ref.update({
            status: 'queued',
            requeueCount: requeueCount + 1,
            updatedAt: FieldValue.serverTimestamp(),
        });
        result.requeued += 1;
    }

    // Jobs that were created but never claimed (the create-time trigger
    // failed or was deployed late). Nothing was submitted, so they are safe
    // to nudge: touching updatedAt re-fires the onDocumentWritten
    // orchestrator, which atomically claims them. Bounded by the same
    // requeue budget so a broken orchestrator cannot loop forever.
    for (const doc of stuckQueued.docs) {
        const job = doc.data() as Record<string, unknown>;
        if (!isGatewayJob(job)) continue;
        const requeueCount = typeof job.requeueCount === 'number' ? job.requeueCount : 0;
        if (requeueCount >= MAX_REQUEUES) {
            await terminalize(doc, job, 'Video job was never claimed and exhausted its re-queue budget.');
            continue;
        }
        await doc.ref.update({
            requeueCount: requeueCount + 1,
            updatedAt: FieldValue.serverTimestamp(),
        });
        result.queuedTouched += 1;
    }

    return result;
}

export const reclaimStuckVideoJobs = onSchedule(
    { schedule: 'every 5 minutes', timeZone: 'Etc/UTC', region: 'us-central1' },
    async () => {
        const result = await reclaimStuckGatewayVideoJobs();
        console.info('[VideoReaper] Reclaimed stuck gateway video jobs', result);
    },
);
