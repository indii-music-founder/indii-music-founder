import { createHash } from 'crypto';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { z } from 'zod';
import {
    ApprovalReceiptSchema,
    DerivativeAssetReceipt,
    DerivativeAssetReceiptSchema,
    SocialHandoffDraft,
    SocialHandoffDraftSchema,
} from '@indii/shared';
import { validateAppCheckV2 } from '../../middleware/appCheck';
import { derivePrivateRenderOutputUris } from './stitchMasterAudio';

const CreateSocialHandoffDraftRequestSchema = z.object({
    derivativeId: z.string().trim().regex(/^[A-Za-z0-9_-]{1,256}$/),
    targetPlatforms: z.array(z.enum(['tiktok', 'instagram', 'youtube', 'x']))
        .min(1)
        .max(4)
        .refine(platforms => new Set(platforms).size === platforms.length, 'Target platforms must be unique.'),
    captionText: z.string().max(2200).default(''),
    suggestedHashtags: z.array(z.string().trim()).max(30).default([]),
}).strict();

type StoredRecord = Record<string, unknown>;

export interface VerifiedDerivativeObjectMetadata {
    generation: string;
    metageneration: string;
    byteSize: number;
    mimeType: string;
    sha256: string;
}

export interface SocialHandoffDraftDependencies {
    projectBucketName: string;
    getDerivative(derivativeId: string): Promise<unknown | undefined>;
    getSession(sessionId: string): Promise<StoredRecord | undefined>;
    getApproval(sessionId: string, approvalReceiptId: string): Promise<unknown | undefined>;
    getRenderJob(renderJobId: string): Promise<StoredRecord | undefined>;
    inspectObject(
        storageBucket: string,
        storagePath: string,
        generation: string,
    ): Promise<VerifiedDerivativeObjectMetadata>;
    persistDraft(
        draftId: string,
        draft: SocialHandoffDraft,
    ): Promise<{ draft: unknown; created: boolean }>;
}

export function parseVerifiedDerivativeObjectMetadata(
    metadata: StoredRecord,
): VerifiedDerivativeObjectMetadata {
    const generation = asNonEmptyString(metadata.generation);
    const metageneration = asNonEmptyString(metadata.metageneration);
    const mimeType = asNonEmptyString(metadata.contentType);
    const byteSize = Number(metadata.size);
    const customMetadata = metadata.metadata;
    const sha256 = customMetadata && typeof customMetadata === 'object' && !Array.isArray(customMetadata)
        ? asNonEmptyString((customMetadata as StoredRecord).sha256)
        : undefined;
    if (
        !generation
        || !/^[1-9]\d{0,29}$/.test(generation)
        || !metageneration
        || !/^[1-9]\d*$/.test(metageneration)
        || !Number.isSafeInteger(byteSize)
        || byteSize <= 0
        || mimeType !== 'video/mp4'
        || !sha256
        || !/^[a-f0-9]{64}$/.test(sha256)
    ) {
        throw new Error('Verified derivative object metadata is incomplete or invalid.');
    }
    return { generation, metageneration, byteSize, mimeType, sha256 };
}

function asNonEmptyString(value: unknown): string | undefined {
    return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function normalizeCompletionTimestamp(value: unknown): string | undefined {
    if (typeof value === 'string') {
        const milliseconds = Date.parse(value);
        return Number.isFinite(milliseconds) ? new Date(milliseconds).toISOString() : undefined;
    }
    if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
    const timestamp = value as StoredRecord;
    const seconds = timestamp.seconds;
    const nanoseconds = timestamp.nanoseconds;
    if (
        typeof seconds !== 'number'
        || !Number.isSafeInteger(seconds)
        || typeof nanoseconds !== 'number'
        || !Number.isInteger(nanoseconds)
        || nanoseconds < 0
        || nanoseconds > 999_999_999
    ) {
        return undefined;
    }
    const milliseconds = (seconds * 1000) + Math.floor(nanoseconds / 1_000_000);
    return Number.isSafeInteger(milliseconds) ? new Date(milliseconds).toISOString() : undefined;
}

function costMicros(value: unknown): number | undefined {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return undefined;
    const micros = value * 1_000_000;
    return Number.isSafeInteger(micros) ? micros : undefined;
}

function assertSessionBinding(
    session: StoredRecord | undefined,
    derivative: DerivativeAssetReceipt,
): void {
    const original = session?.original;
    const originalGeneration = original && typeof original === 'object' && !Array.isArray(original)
        ? asNonEmptyString((original as StoredRecord).generation)
        : undefined;
    if (
        !session
        || session.sessionId !== derivative.sessionId
        || session.ownerUid !== derivative.ownerUid
        || session.organizationId !== derivative.organizationId
        || session.projectId !== derivative.projectId
        || session.status !== 'completed'
        || !asNonEmptyString(session.terminalReceiptId)
        || originalGeneration !== derivative.sourceGeneration
    ) {
        throw new HttpsError(
            'failed-precondition',
            'The derivative is not bound to a completed owner-scoped video session.',
        );
    }
}

function assertApprovalBinding(
    rawApproval: unknown,
    derivative: DerivativeAssetReceipt,
): void {
    const parsed = ApprovalReceiptSchema.safeParse(rawApproval);
    const approval = parsed.success ? parsed.data : undefined;
    if (
        !approval
        || approval.approvalReceiptId !== derivative.approvalReceiptId
        || approval.sessionId !== derivative.sessionId
        || approval.ownerUid !== derivative.ownerUid
        || approval.organizationId !== derivative.organizationId
        || approval.projectId !== derivative.projectId
        || approval.sourceGeneration !== derivative.sourceGeneration
        || approval.masterGeneration !== derivative.masterGeneration
    ) {
        throw new HttpsError(
            'failed-precondition',
            'The derivative is not bound to a valid owner approval receipt.',
        );
    }
}

function assertRenderJobBinding(
    job: StoredRecord | undefined,
    derivative: DerivativeAssetReceipt,
    expectedResultUri: string,
): void {
    const completedAt = normalizeCompletionTimestamp(job?.completedAt);
    const actualCostMicros = costMicros(job?.actualCost);
    const receiptCostMicros = costMicros(derivative.renderCostUsd);
    if (
        !job
        || job.id !== derivative.renderJobId
        || job.userId !== derivative.ownerUid
        || job.orgId !== derivative.organizationId
        || job.projectId !== derivative.projectId
        || job.sessionId !== derivative.sessionId
        || job.approvalReceiptId !== derivative.approvalReceiptId
        || job.timelineRevisionId !== derivative.timelineRevisionId
        || job.sourceGeneration !== derivative.sourceGeneration
        || job.aspectRatio !== derivative.aspectRatio
        || job.type !== 'render_stitch'
        || job.accessPolicy !== 'private-project-render.v1'
        || String(job.status).toLowerCase() !== 'completed'
        || completedAt !== derivative.renderedAt
        || job.resultUri !== expectedResultUri
        || job.resultGeneration !== derivative.generation
        || job.resultMetageneration !== derivative.metageneration
        || job.resultSha256 !== derivative.sha256
        || job.resultByteSize !== derivative.byteSize
        || job.resultMimeType !== derivative.mimeType
        || !asNonEmptyString(job.costReservationId)
        || actualCostMicros === undefined
        || receiptCostMicros === undefined
        || actualCostMicros !== receiptCostMicros
    ) {
        throw new HttpsError(
            'failed-precondition',
            'The derivative is not backed by a completed private render job.',
        );
    }
}

function assertObjectMetadata(
    metadata: VerifiedDerivativeObjectMetadata,
    derivative: DerivativeAssetReceipt,
): void {
    if (
        metadata.generation !== derivative.generation
        || metadata.metageneration !== derivative.metageneration
        || metadata.byteSize !== derivative.byteSize
        || metadata.mimeType !== derivative.mimeType
        || metadata.sha256 !== derivative.sha256
    ) {
        throw new HttpsError(
            'failed-precondition',
            'The private render object no longer matches its immutable derivative receipt.',
        );
    }
}

function sameDraft(left: SocialHandoffDraft, right: SocialHandoffDraft): boolean {
    return left.schemaVersion === right.schemaVersion
        && left.draftId === right.draftId
        && left.derivativeId === right.derivativeId
        && left.ownerUid === right.ownerUid
        && left.organizationId === right.organizationId
        && left.projectId === right.projectId
        && left.isPublished === false
        && right.isPublished === false
        && left.captionText === right.captionText
        && left.targetPlatforms.length === right.targetPlatforms.length
        && left.targetPlatforms.every((platform, index) => platform === right.targetPlatforms[index])
        && left.suggestedHashtags.length === right.suggestedHashtags.length
        && left.suggestedHashtags.every((hashtag, index) => hashtag === right.suggestedHashtags[index]);
}

export function createCreateSocialHandoffDraftHandler(
    dependencies: SocialHandoffDraftDependencies,
) {
    return async (rawInput: unknown, authUid: string) => {
        const parseResult = CreateSocialHandoffDraftRequestSchema.safeParse(rawInput);
        if (!parseResult.success) {
            throw new HttpsError('invalid-argument', 'The social handoff draft request is malformed.');
        }

        const {
            derivativeId,
            captionText,
            suggestedHashtags,
        } = parseResult.data;
        const targetPlatforms = [...parseResult.data.targetPlatforms].sort();
        const rawDerivative = await dependencies.getDerivative(derivativeId);
        if (!rawDerivative) {
            throw new HttpsError('not-found', 'The specified derivative asset receipt does not exist.');
        }
        const parsedDerivative = DerivativeAssetReceiptSchema.safeParse(rawDerivative);
        if (!parsedDerivative.success || parsedDerivative.data.derivativeId !== derivativeId) {
            throw new HttpsError(
                'failed-precondition',
                'The specified derivative asset receipt is not a verified terminal receipt.',
            );
        }
        const derivative = parsedDerivative.data;
        if (derivative.ownerUid !== authUid) {
            throw new HttpsError('permission-denied', 'Cross-owner derivative asset access is prohibited.');
        }

        const expectedOutput = derivePrivateRenderOutputUris({
            bucketName: dependencies.projectBucketName,
            expectedOwnerUid: authUid,
            expectedJobId: derivative.renderJobId,
            identity: {
                policy: 'private-project-render.v1',
                ownerUid: derivative.ownerUid,
                projectId: derivative.projectId,
                jobId: derivative.renderJobId,
            },
        });
        const bucketPrefix = `gs://${dependencies.projectBucketName}/`;
        if (
            derivative.storageBucket !== dependencies.projectBucketName
            || derivative.storagePath !== expectedOutput.finalVideoUri.slice(bucketPrefix.length)
        ) {
            throw new HttpsError(
                'failed-precondition',
                'The derivative output is not stored at its server-owned private render identity.',
            );
        }

        const [session, approval, renderJob] = await Promise.all([
            dependencies.getSession(derivative.sessionId),
            dependencies.getApproval(derivative.sessionId, derivative.approvalReceiptId),
            dependencies.getRenderJob(derivative.renderJobId),
        ]);
        assertSessionBinding(session, derivative);
        assertApprovalBinding(approval, derivative);
        assertRenderJobBinding(renderJob, derivative, expectedOutput.finalVideoUri);

        let objectMetadata: VerifiedDerivativeObjectMetadata;
        try {
            objectMetadata = await dependencies.inspectObject(
                derivative.storageBucket,
                derivative.storagePath,
                derivative.generation,
            );
        } catch {
            throw new HttpsError(
                'failed-precondition',
                'The verified private render object is unavailable.',
            );
        }
        assertObjectMetadata(objectMetadata, derivative);

        const requestIdentity = JSON.stringify({
            derivativeId,
            targetPlatforms,
            captionText,
            suggestedHashtags,
        });
        const draftId = `draft-${createHash('sha256').update(requestIdentity).digest('hex').slice(0, 24)}`;
        const now = new Date().toISOString();
        const newDraft = SocialHandoffDraftSchema.parse({
            schemaVersion: 'social-handoff-draft.v1',
            draftId,
            derivativeId,
            ownerUid: authUid,
            organizationId: derivative.organizationId,
            projectId: derivative.projectId,
            targetPlatforms,
            captionText,
            suggestedHashtags,
            isPublished: false,
            createdAt: now,
        });

        const persisted = await dependencies.persistDraft(draftId, newDraft);
        const existing = SocialHandoffDraftSchema.safeParse(persisted.draft);
        if (!existing.success || !sameDraft(existing.data, newDraft)) {
            throw new HttpsError('data-loss', 'The existing handoff draft does not match this request.');
        }
        return { draft: existing.data, reused: !persisted.created };
    };
}

function createFirebaseDependencies(): SocialHandoffDraftDependencies {
    const db = getFirestore();
    const projectBucket = getStorage().bucket();
    return {
        projectBucketName: projectBucket.name,
        async getDerivative(derivativeId) {
            const snapshot = await db.collection('derivatives').doc(derivativeId).get();
            return snapshot.exists ? snapshot.data() : undefined;
        },
        async getSession(sessionId) {
            const snapshot = await db.collection('videoSessions').doc(sessionId).get();
            return snapshot.exists ? snapshot.data() : undefined;
        },
        async getApproval(sessionId, approvalReceiptId) {
            const snapshot = await db.collection('videoSessions').doc(sessionId)
                .collection('approvals').doc(approvalReceiptId).get();
            return snapshot.exists ? snapshot.data() : undefined;
        },
        async getRenderJob(renderJobId) {
            const snapshot = await db.collection('videoJobs').doc(renderJobId).get();
            return snapshot.exists ? snapshot.data() : undefined;
        },
        async inspectObject(storageBucket, storagePath, generation) {
            const file = getStorage().bucket(storageBucket).file(storagePath, { generation });
            const [metadata] = await file.getMetadata();
            return parseVerifiedDerivativeObjectMetadata(metadata as StoredRecord);
        },
        async persistDraft(draftId, draft) {
            const ref = db.collection('socialDrafts').doc(draftId);
            return db.runTransaction(async transaction => {
                const snapshot = await transaction.get(ref);
                if (snapshot.exists) {
                    return { draft: snapshot.data(), created: false };
                }
                transaction.create(ref, draft);
                return { draft, created: true };
            });
        },
    };
}

export const createSocialHandoffDraft = onCall(async (request) => {
    validateAppCheckV2(request);
    if (!request.auth?.uid) {
        throw new HttpsError('unauthenticated', 'User must be authenticated.');
    }
    const handler = createCreateSocialHandoffDraftHandler(createFirebaseDependencies());
    return handler(request.data, request.auth.uid);
});
