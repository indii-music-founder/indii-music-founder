/**
 * Cloud video render queue — the durable job protocol that lets ANY user
 * (web included) request a composed-timeline render.
 *
 * The job document under users/{uid}/videoRenderJobs/{jobId} is the protocol
 * surface. It is created ONLY by this callable (clients cannot forge jobs via
 * rules), and it is advanced ONLY by trusted executors:
 *   - the signed-in desktop Studio relay (local HyperFrames render), or
 *   - the cloud render worker (server-side HyperFrames render).
 *
 * The renderer contract (receipts: queued → running → completed/failed)
 * stays the caller-facing shape; this module is its durable backbone.
 */

import { randomUUID } from 'node:crypto';

import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';

import { validateAppCheckV2 } from '../../middleware/appCheck';
import { requireVerifiedCreativeUser } from '../billing/enforceOperationCost';

export const VIDEO_RENDER_JOB_SCHEMA_VERSION = 'video-render-job.v1' as const;

export type VideoRenderJobStatus = 'queued' | 'running' | 'completed' | 'failed';
export type VideoRenderExecutor = 'desktop-relay' | 'cloud-worker';

export interface VideoRenderJob {
    schemaVersion: typeof VIDEO_RENDER_JOB_SCHEMA_VERSION;
    jobId: string;
    userId: string;
    projectId: string;
    outputName?: string;
    status: VideoRenderJobStatus;
    executor: VideoRenderExecutor | null;
    artifactUrl: string | null;
    /** Storage generation of the completed artifact (stale-read protection). */
    artifactGeneration: string | null;
    error: string | null;
    createdAt: unknown;
    updatedAt: unknown;
}

/** Allowed status transitions; executors advance jobs one hop at a time. */
export const VIDEO_RENDER_JOB_TRANSITIONS: Record<VideoRenderJobStatus, VideoRenderJobStatus[]> = {
    queued: ['running'],
    running: ['completed', 'failed'],
    completed: [],
    failed: [],
};

const JOB_IDENTIFIER = /^[A-Za-z0-9_-]{1,128}$/;

export function videoRenderJobPath(userId: string, jobId: string): string {
    return `users/${userId}/videoRenderJobs/${jobId}`;
}

export const sanitizeVideoRenderOutputName = (raw: unknown): string | undefined => {
    if (raw === undefined) return undefined;
    if (typeof raw !== 'string' || raw.trim() === '') return undefined;
    const value = raw.trim();
    if (value.includes('/') || value.includes('\\')) {
        throw new TypeError('outputName must be a filename, not a path.');
    }
    const sanitized = value.replace(/[^a-z0-9._-]/gi, '_');
    const lower = sanitized.toLowerCase();
    return lower.endsWith('.mp4') ? `${sanitized.slice(0, -4)}.mp4` : `${sanitized}.mp4`;
};

export const queueCloudVideoRender = onCall(
    { timeoutSeconds: 30, memory: '512MiB', enforceAppCheck: false },
    async (request): Promise<{ renderId: string; projectId: string; status: 'queued'; progress: 0 }> => {
        validateAppCheckV2(request);
        const userId = requireVerifiedCreativeUser(request.auth);

        const data = request.data as Record<string, unknown>;
        const projectId = typeof data.projectId === 'string' ? data.projectId.trim() : '';
        if (!projectId || !JOB_IDENTIFIER.test(projectId) || projectId.includes('/')) {
            throw new HttpsError('invalid-argument', 'A valid projectId is required.');
        }
        let outputName: string | undefined;
        try {
            outputName = sanitizeVideoRenderOutputName(data.outputName);
        } catch (error) {
            throw new HttpsError('invalid-argument', error instanceof Error ? error.message : 'Invalid outputName.');
        }

        const db = getFirestore();
        const projectRef = db.collection('users').doc(userId).collection('videoProjects').doc(projectId);
        const projectSnapshot = await projectRef.get();
        const projectData = projectSnapshot.data();
        if (!projectSnapshot.exists || projectData?.userId !== userId || !projectData?.project) {
            throw new HttpsError('not-found', 'Video project not found or not owned by the caller.');
        }

        const jobId = randomUUID();
        const jobRef = db.doc(videoRenderJobPath(userId, jobId));
        await jobRef.create({
            schemaVersion: VIDEO_RENDER_JOB_SCHEMA_VERSION,
            jobId,
            userId,
            projectId,
            ...(outputName ? { outputName } : {}),
            status: 'queued',
            executor: null,
            artifactUrl: null,
            artifactGeneration: null,
            error: null,
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
        } satisfies Record<string, unknown>);

        return { renderId: jobId, projectId, status: 'queued', progress: 0 };
    },
);
