import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { z } from 'zod';

import { arcjetKey } from '../../config/secrets';
import { validateAppCheckV2, requireVerifiedEmailV2 } from '../../middleware/appCheck';
import { requireVerifiedServerEntitlement } from '../auth/entitlements';
import {
    policyClassForServerEntitlement,
    protectAuthenticatedApiRequest,
} from '../security/arcjet';
import { assertVideoSessionProjectAccess } from './createVideoSession';
import {
    derivePrivateRenderOutputUris,
    type PrivateRenderOutputIdentity,
} from './stitchMasterAudio';

const RECEIPT_URL_TTL_MS = 5 * 60 * 1000;
const PRIVATE_RENDER_POLICY = 'private-project-render.v1' as const;
const GetVideoRenderReceiptRequestSchema = z.object({
    jobId: z.string().trim().regex(/^[A-Za-z0-9_-]{1,128}$/),
}).strict();

type FirestoreJob = Record<string, unknown>;

export type VideoRenderReceipt =
    | {
        status: 'queued';
        renderId: string;
        projectId: string;
        progress: number;
    }
    | {
        status: 'running';
        renderId: string;
        projectId: string;
        progress: number;
        phase?: string;
    }
    | {
        status: 'completed';
        renderId: string;
        projectId: string;
        progress: 100;
        asset: {
            url: string;
            expiresAt: number;
            generation: string;
            mimeType: 'video/mp4';
        };
    }
    | {
        status: 'failed';
        renderId: string;
        projectId: string;
        progress: number;
        error: string;
    };

export interface VideoRenderReceiptDependencies {
    bucketName: string;
    now(): number;
    getJob(jobId: string): Promise<FirestoreJob | undefined>;
    authorizeProject(requesterUid: string, organizationId: string, projectId: string): Promise<void>;
    inspectObject(path: string, generation: string): Promise<{
        generation: string;
        contentType: string;
    }>;
    signObject(path: string, generation: string, expiresAt: number): Promise<string>;
}

function requiredJobString(job: FirestoreJob, field: string): string {
    const value = job[field];
    if (typeof value !== 'string' || !value.trim() || value.length > 128) {
        throw new HttpsError('data-loss', `Render job ${field} is invalid.`);
    }
    return value.trim();
}

function boundedProgress(value: unknown): number {
    return typeof value === 'number' && Number.isFinite(value)
        ? Math.max(0, Math.min(100, Math.round(value)))
        : 0;
}

function privateIdentityFromJob(job: FirestoreJob, jobId: string): PrivateRenderOutputIdentity {
    return {
        policy: PRIVATE_RENDER_POLICY,
        ownerUid: requiredJobString(job, 'userId'),
        projectId: requiredJobString(job, 'projectId'),
        jobId,
    };
}

export async function readVideoRenderReceipt(
    requesterUid: string,
    rawRequest: unknown,
    dependencies: VideoRenderReceiptDependencies,
): Promise<VideoRenderReceipt> {
    const parsed = GetVideoRenderReceiptRequestSchema.safeParse(rawRequest);
    if (!parsed.success) {
        throw new HttpsError('invalid-argument', 'A valid server render job ID is required.');
    }
    const { jobId } = parsed.data;
    const job = await dependencies.getJob(jobId);
    if (!job) throw new HttpsError('not-found', 'Render job not found.');
    if (
        job.id !== jobId
        || job.type !== 'render_stitch'
        || job.accessPolicy !== PRIVATE_RENDER_POLICY
    ) {
        throw new HttpsError('failed-precondition', 'Render job is not a private project render.');
    }

    const organizationId = requiredJobString(job, 'orgId');
    const identity = privateIdentityFromJob(job, jobId);
    await dependencies.authorizeProject(requesterUid, organizationId, identity.projectId);

    const progress = boundedProgress(job.progress);
    const rawStatus = typeof job.status === 'string' ? job.status.toLowerCase() : '';
    const cancellationRecorded = job.cancelledAt !== undefined && job.cancelledAt !== null;
    if (rawStatus === 'cancelled' || cancellationRecorded) {
        return {
            status: 'failed',
            renderId: jobId,
            projectId: identity.projectId,
            progress,
            error: 'The private render was cancelled.',
        };
    }
    if (rawStatus === 'queued' || rawStatus === 'pending') {
        return { status: 'queued', renderId: jobId, projectId: identity.projectId, progress };
    }
    if (rawStatus === 'processing' || rawStatus === 'stitching') {
        const phase = typeof job.renderStage === 'string' && job.renderStage.trim()
            ? job.renderStage.trim()
            : undefined;
        return {
            status: 'running',
            renderId: jobId,
            projectId: identity.projectId,
            progress,
            ...(phase ? { phase } : {}),
        };
    }
    if (rawStatus === 'failed') {
        const error = [job.error, job.stitchError]
            .find(value => typeof value === 'string' && value.trim()) as string | undefined;
        return {
            status: 'failed',
            renderId: jobId,
            projectId: identity.projectId,
            progress,
            error: error?.trim() || 'The private render did not complete.',
        };
    }
    if (rawStatus !== 'completed') {
        throw new HttpsError('data-loss', 'Render job has an invalid lifecycle status.');
    }
    if (job.accessRevokedAt || job.downloadRevokedAt) {
        throw new HttpsError('permission-denied', 'Render download access has been revoked.');
    }

    const generation = requiredJobString(job, 'resultGeneration');
    if (!/^[1-9][0-9]{0,29}$/.test(generation)) {
        throw new HttpsError('data-loss', 'Completed render generation is invalid.');
    }
    const expected = derivePrivateRenderOutputUris({
        bucketName: dependencies.bucketName,
        expectedOwnerUid: identity.ownerUid,
        expectedJobId: jobId,
        identity,
    });
    if (job.resultUri !== expected.finalVideoUri) {
        throw new HttpsError('data-loss', 'Completed render output does not match its private project identity.');
    }
    const bucketPrefix = `gs://${dependencies.bucketName}/`;
    const objectPath = expected.finalVideoUri.slice(bucketPrefix.length);
    let metadata: { generation: string; contentType: string };
    try {
        metadata = await dependencies.inspectObject(objectPath, generation);
    } catch {
        throw new HttpsError('failed-precondition', 'Completed render object is unavailable.');
    }
    if (metadata.generation !== generation || metadata.contentType !== 'video/mp4') {
        throw new HttpsError('data-loss', 'Completed render object generation or MIME type does not match its receipt.');
    }

    const expiresAt = dependencies.now() + RECEIPT_URL_TTL_MS;
    const url = await dependencies.signObject(objectPath, generation, expiresAt);
    if (!url.startsWith('https://')) {
        throw new HttpsError('internal', 'Storage did not issue a secure render URL.');
    }
    return {
        status: 'completed',
        renderId: jobId,
        projectId: identity.projectId,
        progress: 100,
        asset: {
            url,
            expiresAt,
            generation,
            mimeType: 'video/mp4',
        },
    };
}

export const getVideoRenderReceipt = onCall(
    {
        region: 'us-central1',
        secrets: [arcjetKey],
        timeoutSeconds: 30,
        memory: '512MiB',
        cpu: 'gcf_gen1',
        concurrency: 1,
    },
    async (request): Promise<VideoRenderReceipt> => {
        validateAppCheckV2(request);
        const requesterUid = requireVerifiedEmailV2(request);
        const entitlement = await requireVerifiedServerEntitlement(requesterUid);
        if (!request.rawRequest) {
            throw new HttpsError('unavailable', 'Request protection is temporarily unavailable.');
        }
        const rawData = request.data as unknown;
        const parsed = GetVideoRenderReceiptRequestSchema.safeParse(rawData);
        const operationId = parsed.success
            ? `video-render-receipt:${parsed.data.jobId}`
            : `video-render-receipt:invalid:${Date.now()}`;
        const protection = await protectAuthenticatedApiRequest(request.rawRequest as never, {
            userId: requesterUid,
            policy: policyClassForServerEntitlement({
                tier: entitlement.tier,
                isAdmin: request.auth?.token.admin === true,
            }),
            operationId,
        });
        if (!protection.allowed) {
            const code = protection.status === 429
                ? 'resource-exhausted'
                : protection.status === 403
                    ? 'permission-denied'
                    : 'unavailable';
            throw new HttpsError(code, protection.message, {
                code: protection.code,
                ...(protection.retryAfterSeconds ? { retryAfterSeconds: protection.retryAfterSeconds } : {}),
            });
        }

        const db = getFirestore();
        const bucket = getStorage().bucket();
        return readVideoRenderReceipt(requesterUid, rawData, {
            bucketName: bucket.name,
            now: () => Date.now(),
            async getJob(jobId) {
                const snapshot = await db.collection('videoJobs').doc(jobId).get();
                return snapshot.exists ? snapshot.data() : undefined;
            },
            authorizeProject: assertVideoSessionProjectAccess,
            async inspectObject(path, generation) {
                const [metadata] = await bucket.file(path, { generation }).getMetadata();
                return {
                    generation: String(metadata.generation ?? ''),
                    contentType: String(metadata.contentType ?? ''),
                };
            },
            async signObject(path, generation, expiresAt) {
                const [url] = await bucket.file(path, { generation }).getSignedUrl({
                    action: 'read',
                    expires: expiresAt,
                    version: 'v4',
                });
                return url;
            },
        });
    },
);
