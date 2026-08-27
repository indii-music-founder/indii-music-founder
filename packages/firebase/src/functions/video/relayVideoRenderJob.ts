/**
 * Desktop relay claim/complete callables — the second trusted executor for
 * the video render queue. The signed-in desktop Studio claims a queued job,
 * renders it locally, uploads the artifact, and reports completion. The
 * cloud worker remains the first executor; whichever claims first wins.
 */

import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';

import { validateAppCheckV2 } from '../../middleware/appCheck';
import { requireVerifiedCreativeUser } from '../billing/enforceOperationCost';
import { VIDEO_RENDER_JOB_TRANSITIONS } from './queueCloudVideoRender';

const JOB_IDENTIFIER = /^[A-Za-z0-9_-]{1,128}$/;

const jobRefFor = (userId: string, jobId: string) =>
    getFirestore().doc(`users/${userId}/videoRenderJobs/${jobId}`);

export const claimVideoRenderJob = onCall(
    { timeoutSeconds: 30, memory: '512MiB', enforceAppCheck: false },
    async (request): Promise<{ claimed: true }> => {
        validateAppCheckV2(request);
        const userId = requireVerifiedCreativeUser(request.auth);
        const data = request.data as Record<string, unknown>;
        const jobId = typeof data.jobId === 'string' ? data.jobId.trim() : '';
        if (!jobId || !JOB_IDENTIFIER.test(jobId)) {
            throw new HttpsError('invalid-argument', 'A valid jobId is required.');
        }

        const ref = jobRefFor(userId, jobId);
        const snapshot = await ref.get();
        const job = snapshot.data();
        if (!snapshot.exists || !job || job.userId !== userId) {
            throw new HttpsError('not-found', 'Render job not found or not owned by the caller.');
        }
        const status = String(job.status ?? '');
        if (!VIDEO_RENDER_JOB_TRANSITIONS[status as keyof typeof VIDEO_RENDER_JOB_TRANSITIONS]?.includes('running')) {
            throw new HttpsError('failed-precondition', `Job ${jobId} is ${status}; only queued jobs can be claimed.`);
        }

        await ref.update({
            status: 'running',
            executor: 'desktop-relay',
            updatedAt: FieldValue.serverTimestamp(),
        });
        return { claimed: true };
    },
);

export const completeVideoRenderJob = onCall(
    { timeoutSeconds: 30, memory: '512MiB', enforceAppCheck: false },
    async (request): Promise<{ completed: true }> => {
        validateAppCheckV2(request);
        const userId = requireVerifiedCreativeUser(request.auth);
        const data = request.data as Record<string, unknown>;
        const jobId = typeof data.jobId === 'string' ? data.jobId.trim() : '';
        if (!jobId || !JOB_IDENTIFIER.test(jobId)) {
            throw new HttpsError('invalid-argument', 'A valid jobId is required.');
        }
        const artifactUrl = typeof data.artifactUrl === 'string' && data.artifactUrl.startsWith('https://')
            ? data.artifactUrl
            : null;
        const error = typeof data.error === 'string' ? data.error.slice(0, 800) : null;
        if (!artifactUrl && !error) {
            throw new HttpsError('invalid-argument', 'Provide either an https artifactUrl or an error.');
        }

        const ref = jobRefFor(userId, jobId);
        const snapshot = await ref.get();
        const job = snapshot.data();
        if (!snapshot.exists || !job || job.userId !== userId) {
            throw new HttpsError('not-found', 'Render job not found or not owned by the caller.');
        }
        if (job.status !== 'running' || job.executor !== 'desktop-relay') {
            throw new HttpsError('failed-precondition', 'Only a running desktop-relay job can be completed.');
        }

        await ref.update({
            ...(artifactUrl
                ? { status: 'completed', artifactUrl, artifactGeneration: '', error: null }
                : { status: 'failed', error }),
            updatedAt: FieldValue.serverTimestamp(),
        });
        return { completed: true };
    },
);
