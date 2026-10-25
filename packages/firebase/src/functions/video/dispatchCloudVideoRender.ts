/**
 * A queued Firestore render job becomes a durable, deterministically named
 * Cloud Task before this trigger reports dispatch success. Cloud Tasks waits
 * for the worker's terminal response and retries transport/crash failures.
 */

import { createHash } from 'node:crypto';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { logger } from 'firebase-functions';
import { CloudTasksClient } from '@google-cloud/tasks';
import { renderWorkerSecret, renderWorkerUrl } from '../../config/cloudRender';

const REGION = 'us-central1';
const QUEUE = 'video-render-jobs';
const JOB_PATH = /^users\/([^/]+)\/videoRenderJobs\/([A-Za-z0-9_-]{1,128})$/;

interface TasksClientLike {
    queuePath(project: string, location: string, queue: string): string;
    createTask(request: {
        parent: string;
        task: {
            name: string;
            dispatchDeadline: { seconds: number };
            httpRequest: {
                httpMethod: 'POST';
                url: string;
                headers: Record<string, string>;
                body: string;
            };
        };
    }): Promise<unknown>;
}

export async function enqueueCloudRenderTask(
    jobPath: string,
    config: { project: string; workerUrl: string; workerSecret: string },
    client: TasksClientLike,
): Promise<string> {
    if (!JOB_PATH.test(jobPath)) throw new Error('Invalid render job path.');
    const url = new URL(config.workerUrl);
    if (url.protocol !== 'https:' || url.username || url.password || url.port || !config.workerSecret) throw new Error('Render worker configuration is invalid.');
    const parent = client.queuePath(config.project, REGION, QUEUE);
    const name = `${parent}/tasks/render-${createHash('sha256').update(jobPath).digest('hex')}`;
    try {
        await client.createTask({ parent, task: {
            name,
            dispatchDeadline: { seconds: 1_800 },
            httpRequest: {
                httpMethod: 'POST',
                url: new URL('/v1/render', url).toString(),
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.workerSecret}` },
                body: Buffer.from(JSON.stringify({ jobPath })).toString('base64'),
            },
        } });
    } catch (error) {
        if ((error as { code?: unknown })?.code !== 6 && (error as { code?: unknown })?.code !== 'ALREADY_EXISTS') throw error;
    }
    return name;
}

export const dispatchCloudVideoRender = onDocumentCreated(
    {
        document: 'users/{userId}/videoRenderJobs/{jobId}',
        region: REGION,
        secrets: [renderWorkerSecret, renderWorkerUrl],
        timeoutSeconds: 60,
        memory: '512MiB',
        retry: true,
    },
    async event => {
        const jobPath = `users/${event.params.userId}/videoRenderJobs/${event.params.jobId}`;
        const data = event.data?.data();
        if (!data || data.status !== 'queued' || data.userId !== event.params.userId || data.jobId !== event.params.jobId) {
            logger.warn('[dispatchCloudVideoRender] Job identity or state is not dispatchable', { jobPath });
            return;
        }
        const workerUrl = renderWorkerUrl.value().trim();
        const workerSecret = renderWorkerSecret.value().trim();
        const project = process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT || '';
        if (!workerUrl || !workerSecret || !project) {
            logger.error('[dispatchCloudVideoRender] Render task configuration is incomplete', { jobPath });
            throw new Error('Render task configuration is incomplete.');
        }
        try {
            const name = await enqueueCloudRenderTask(jobPath, { project, workerUrl, workerSecret }, new CloudTasksClient() as TasksClientLike);
            await getFirestore().doc(jobPath).update({ dispatchTaskName: name, dispatchError: FieldValue.delete(), updatedAt: FieldValue.serverTimestamp() });
            logger.info('[dispatchCloudVideoRender] Durable task enqueued', { jobPath, taskName: name });
        } catch (error) {
            await getFirestore().doc(jobPath).update({ dispatchError: error instanceof Error ? error.message.slice(0, 400) : 'TASK_ENQUEUE_FAILED', updatedAt: FieldValue.serverTimestamp() }).catch(() => undefined);
            logger.error('[dispatchCloudVideoRender] Enqueue failed; trigger will retry', { jobPath, error });
            throw error;
        }
    },
);
