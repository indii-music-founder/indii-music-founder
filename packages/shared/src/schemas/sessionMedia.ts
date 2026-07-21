import { z } from 'zod';

const IdentifierSchema = z.string().trim().min(1).max(256);
const StorageGenerationSchema = z.string().regex(/^\d+$/, 'Storage generation must be an immutable numeric generation.');
const Sha256Schema = z.string().regex(/^[a-f0-9]{64}$/, 'SHA-256 must be 64 lowercase hexadecimal characters.');
const BucketSchema = z.string().trim().min(3).max(222).regex(/^[a-z0-9][a-z0-9._-]+[a-z0-9]$/);
const ObjectPathSchema = z.string().trim().min(1).max(1024).refine(
    (path) => !path.startsWith('/') && !path.includes('://'),
    'Use a bucket-relative private object path, not a URL.',
);
const MicrosecondsSchema = z.number().int().nonnegative();

const ImmutableObjectIdentitySchema = z.object({
    ownerUid: IdentifierSchema,
    organizationId: IdentifierSchema,
    projectId: IdentifierSchema,
    bucket: BucketSchema,
    path: ObjectPathSchema,
    generation: StorageGenerationSchema,
    sha256: Sha256Schema,
    mimeType: z.string().trim().min(3).max(255),
    byteSize: z.number().int().positive(),
    createdAt: z.string().datetime(),
    creationReceiptId: IdentifierSchema,
}).strict();

export const CanonicalMediaRefSchema = ImmutableObjectIdentitySchema.extend({
    schemaVersion: z.literal('canonical-media-ref.v1'),
    role: z.enum(['original', 'editing_proxy', 'guide_audio']),
}).strict().superRefine((media, ctx) => {
    const expectedPrefix = media.role === 'guide_audio' ? 'audio/' : 'video/';
    if (!media.mimeType.startsWith(expectedPrefix)) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['mimeType'],
            message: `${media.role} must use a ${expectedPrefix} MIME type.`,
        });
    }
});

export const DerivedMediaRefSchema = ImmutableObjectIdentitySchema.extend({
    schemaVersion: z.literal('derived-media-ref.v1'),
    role: z.enum(['waveform', 'thumbnail', 'contact_sheet']),
    workerVersion: IdentifierSchema,
    atUs: MicrosecondsSchema.optional(),
}).strict();

export const PresentationTimeMapSegmentSchema = z.object({
    proxyStartUs: MicrosecondsSchema,
    proxyEndUs: MicrosecondsSchema,
    originalStartUs: MicrosecondsSchema,
    originalEndUs: MicrosecondsSchema,
}).strict().superRefine((segment, ctx) => {
    if (segment.proxyEndUs <= segment.proxyStartUs) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['proxyEndUs'], message: 'Proxy range must have positive duration.' });
    }
    if (segment.originalEndUs <= segment.originalStartUs) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['originalEndUs'], message: 'Original range must have positive duration.' });
    }
});

export const PresentationTimeMapSchema = z.object({
    version: z.literal('presentation-time-map.v1'),
    segments: z.array(PresentationTimeMapSegmentSchema).min(1),
}).strict().superRefine(({ segments }, ctx) => {
    if (segments[0]?.proxyStartUs !== 0) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['segments', 0, 'proxyStartUs'], message: 'Proxy mapping must start at zero.' });
    }

    for (let index = 1; index < segments.length; index += 1) {
        const previous = segments[index - 1];
        const current = segments[index];
        if (!previous || !current) continue;
        if (current.proxyStartUs !== previous.proxyEndUs) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['segments', index, 'proxyStartUs'], message: 'Proxy mapping must be ordered and continuous.' });
        }
        if (current.originalStartUs < previous.originalEndUs) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['segments', index, 'originalStartUs'], message: 'Original presentation time must be monotonic.' });
        }
    }
});

export const MediaInspectionSchema = z.object({
    originalDurationUs: MicrosecondsSchema.positive(),
    proxyDurationUs: MicrosecondsSchema.positive(),
    sourceVideoCodec: IdentifierSchema,
    sourceAudioCodec: IdentifierSchema.optional(),
    sourceWidth: z.number().int().positive(),
    sourceHeight: z.number().int().positive(),
    sourceRotationDegrees: z.union([z.literal(0), z.literal(90), z.literal(180), z.literal(270)]),
    sourceFrameRateMode: z.enum(['constant', 'variable']),
    sourceHdr: z.boolean(),
    proxyVideoCodec: z.literal('h264'),
    proxyAudioCodec: z.literal('aac'),
    proxyWidth: z.number().int().positive().max(1280),
    proxyHeight: z.number().int().positive().max(1280),
    proxyFrameRateNumerator: z.number().int().positive(),
    proxyFrameRateDenominator: z.number().int().positive(),
    proxyColorSpace: z.literal('rec709'),
    orientationBakedIn: z.literal(true),
}).strict();

export const ProxyManifestSchema = z.object({
    schemaVersion: z.literal('proxy-manifest.v1'),
    manifestId: IdentifierSchema,
    sessionId: IdentifierSchema,
    ownerUid: IdentifierSchema,
    organizationId: IdentifierSchema,
    projectId: IdentifierSchema,
    original: CanonicalMediaRefSchema,
    proxy: CanonicalMediaRefSchema,
    guideAudio: CanonicalMediaRefSchema,
    inspection: MediaInspectionSchema,
    timeMap: PresentationTimeMapSchema,
    waveform: DerivedMediaRefSchema,
    thumbnails: z.array(DerivedMediaRefSchema).max(120),
    contactSheet: DerivedMediaRefSchema.optional(),
    workerVersion: IdentifierSchema,
    createdAt: z.string().datetime(),
    processingReceiptId: IdentifierSchema,
}).strict().superRefine((manifest, ctx) => {
    const ownedRefs = [manifest.original, manifest.proxy, manifest.guideAudio, manifest.waveform, ...manifest.thumbnails];
    if (manifest.contactSheet) ownedRefs.push(manifest.contactSheet);

    for (const [index, ref] of ownedRefs.entries()) {
        if (
            ref.ownerUid !== manifest.ownerUid
            || ref.organizationId !== manifest.organizationId
            || ref.projectId !== manifest.projectId
        ) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['mediaRefs', index],
                message: 'Every manifest object must belong to the same owner, organization, and project.',
            });
        }
    }

    if (manifest.original.role !== 'original') {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['original', 'role'], message: 'Original reference must use the original role.' });
    }
    if (manifest.proxy.role !== 'editing_proxy') {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['proxy', 'role'], message: 'Proxy reference must use the editing_proxy role.' });
    }
    if (manifest.guideAudio.role !== 'guide_audio') {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['guideAudio', 'role'], message: 'Guide reference must use the guide_audio role.' });
    }
    if (manifest.waveform.role !== 'waveform') {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['waveform', 'role'], message: 'Waveform reference must use the waveform role.' });
    }
    manifest.thumbnails.forEach((thumbnail, index) => {
        if (thumbnail.role !== 'thumbnail') {
            ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['thumbnails', index, 'role'], message: 'Thumbnail references must use the thumbnail role.' });
        }
    });
    if (manifest.contactSheet && manifest.contactSheet.role !== 'contact_sheet') {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['contactSheet', 'role'], message: 'Contact sheet reference must use the contact_sheet role.' });
    }

    const finalSegment = manifest.timeMap.segments.at(-1);
    if (finalSegment?.proxyEndUs !== manifest.inspection.proxyDurationUs) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['timeMap', 'segments'],
            message: 'Proxy mapping must cover the inspected proxy duration exactly.',
        });
    }
    if (finalSegment?.originalEndUs !== manifest.inspection.originalDurationUs) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['timeMap', 'segments'],
            message: 'Proxy mapping must cover the inspected original presentation duration exactly.',
        });
    }
});

export const MediaProcessingCostEstimateSchema = z.object({
    currency: z.literal('USD'),
    amountMinor: z.number().int().nonnegative(),
    estimateVersion: IdentifierSchema,
}).strict();

export const VideoSessionSchema = z.object({
    schemaVersion: z.literal('video-session.v1'),
    sessionId: IdentifierSchema,
    ownerUid: IdentifierSchema,
    organizationId: IdentifierSchema,
    projectId: IdentifierSchema,
    idempotencyKey: IdentifierSchema,
    uploadSessionId: IdentifierSchema,
    expectedMimeType: z.string().trim().startsWith('video/'),
    expectedByteSize: z.number().int().positive(),
    stagingBucket: BucketSchema,
    stagingPath: ObjectPathSchema,
    status: z.enum(['uploading', 'uploaded', 'processing', 'completed', 'failed', 'cancelled']),
    original: CanonicalMediaRefSchema.optional(),
    proxyManifest: ProxyManifestSchema.optional(),
    costEstimate: MediaProcessingCostEstimateSchema,
    costReservationId: IdentifierSchema.optional(),
    retentionDeleteAfter: z.string().datetime(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
    completedAt: z.string().datetime().optional(),
    cancelledAt: z.string().datetime().optional(),
    failedAt: z.string().datetime().optional(),
    terminalReceiptId: IdentifierSchema.optional(),
    failure: z.object({
        code: IdentifierSchema,
        message: z.string().trim().min(1).max(2000),
        retryable: z.boolean(),
    }).strict().optional(),
}).strict().superRefine((session, ctx) => {
    const requiresOriginal = ['uploaded', 'processing', 'completed'].includes(session.status);
    if (requiresOriginal && !session.original) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['original'], message: `${session.status} sessions require an immutable original receipt.` });
    }

    if (session.status === 'completed') {
        if (!session.proxyManifest) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['proxyManifest'], message: 'Completed sessions require a validated proxy manifest.' });
        }
        if (!session.completedAt || !session.terminalReceiptId) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['terminalReceiptId'], message: 'Completed sessions require an auditable terminal receipt and completion time.' });
        }
    }

    if (session.status === 'cancelled' && (!session.cancelledAt || !session.terminalReceiptId)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['terminalReceiptId'], message: 'Cancelled sessions require an auditable terminal receipt and cancellation time.' });
    }

    if (session.status === 'failed' && (!session.failedAt || !session.failure || !session.terminalReceiptId)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['failure'], message: 'Failed sessions require failure details and an auditable terminal receipt.' });
    }

    if (session.original) {
        if (
            session.original.ownerUid !== session.ownerUid
            || session.original.organizationId !== session.organizationId
            || session.original.projectId !== session.projectId
        ) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['original'], message: 'Original receipt ownership must match the upload session.' });
        }
        if (session.original.role !== 'original') {
            ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['original', 'role'], message: 'Session source must use the original role.' });
        }
        if (session.original.mimeType !== session.expectedMimeType || session.original.byteSize !== session.expectedByteSize) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['original'], message: 'Original receipt must match the expected MIME type and byte size.' });
        }
    }

    if (session.proxyManifest) {
        if (
            session.proxyManifest.sessionId !== session.sessionId
            || session.proxyManifest.ownerUid !== session.ownerUid
            || session.proxyManifest.organizationId !== session.organizationId
            || session.proxyManifest.projectId !== session.projectId
        ) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['proxyManifest'], message: 'Proxy manifest identity must match the session.' });
        }
        if (
            session.original
            && (
                session.proxyManifest.original.bucket !== session.original.bucket
                || session.proxyManifest.original.path !== session.original.path
                || session.proxyManifest.original.generation !== session.original.generation
                || session.proxyManifest.original.sha256 !== session.original.sha256
            )
        ) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['proxyManifest', 'original'], message: 'Proxy manifest must bind the exact original object generation and hash.' });
        }
    }

    if (Date.parse(session.retentionDeleteAfter) <= Date.parse(session.createdAt)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['retentionDeleteAfter'], message: 'Retention cleanup must occur after session creation.' });
    }
});

export type CanonicalMediaRef = z.infer<typeof CanonicalMediaRefSchema>;
export type DerivedMediaRef = z.infer<typeof DerivedMediaRefSchema>;
export type PresentationTimeMap = z.infer<typeof PresentationTimeMapSchema>;
export type MediaInspection = z.infer<typeof MediaInspectionSchema>;
export type ProxyManifest = z.infer<typeof ProxyManifestSchema>;
export type MediaProcessingCostEstimate = z.infer<typeof MediaProcessingCostEstimateSchema>;
export type VideoSession = z.infer<typeof VideoSessionSchema>;
