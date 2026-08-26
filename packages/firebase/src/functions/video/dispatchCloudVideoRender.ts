/**
 * Cloud render dispatcher — bridges the durable queue to the cloud render
 * worker. When a videoRenderJobs document is created in `queued` state, this
 * trigger POSTs it to the Cloud Run render worker with the shared secret.
 *
 * Degradation is explicit: if RENDER_WORKER_URL is not provisioned yet, the
 * job stays `queued` (observable in the editor) and is logged — nothing is
 * faked, and no client can claim the job itself.
 */

import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { logger } from 'firebase-functions';

import { renderWorkerSecret, renderWorkerUrl } from '../../config/cloudRender';

export const dispatchCloudVideoRender = onDocumentCreated(
    {
        document: 'users/{userId}/videoRenderJobs/{jobId}',
        region: 'us-central1',
        secrets: [renderWorkerSecret, renderWorkerUrl],
        timeoutSeconds: 60,
        memory: '512MiB',
    },
    async (event) => {
        const jobPath = `users/${event.params.userId}/videoRenderJobs/${event.params.jobId}`;
        const data = event.data?.data();
        if (!data || data.status !== 'queued') {
            logger.info('[dispatchCloudVideoRender] Skipping non-queued job', { jobPath, status: data?.status });
            return;
        }

        const workerUrl = renderWorkerUrl.value().trim();
        if (!workerUrl) {
            logger.warn('[dispatchCloudVideoRender] RENDER_WORKER_URL not provisioned; job stays queued.', { jobPath });
            return;
        }

        const db = getFirestore();
        try {
            const response = await fetch(`${workerUrl}/v1/render`, {
                method: 'POST',
                headers: {
                    authorization: `Bearer ${renderWorkerSecret.value().trim()}`,
                    'content-type': 'application/json',
                },
                body: JSON.stringify({ jobPath }),
                signal: AbortSignal.timeout(55_000),
            });
            if (!response.ok) {
                const body = await response.text().catch(() => '');
                throw new Error(`render worker responded ${response.status}: ${body.slice(0, 400)}`);
            }
            logger.info('[dispatchCloudVideoRender] Worker accepted job', { jobPath });
        } catch (error) {
            // The worker marks failures itself; a dispatch failure leaves the
            // job queued with a visible note instead of a false terminal state.
            await db.doc(jobPath).update({
                dispatchError: error instanceof Error ? error.message.slice(0, 800) : String(error),
                updatedAt: FieldValue.serverTimestamp(),
            }).catch(() => undefined);
            logger.error('[dispatchCloudVideoRender] Dispatch failed; job remains queued.', { jobPath, error });
        }
    },
);
