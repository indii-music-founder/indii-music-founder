import { z } from 'zod';
import { CanonicalMediaRefSchema } from './sessionMedia.js';

const IdentifierSchema = z.string().trim().min(1).max(256);
const StorageGenerationSchema = z.string().regex(/^\d+$/, 'Storage generation must be an immutable numeric generation.');
const Sha256Schema = z.string().regex(/^[a-f0-9]{64}$/, 'SHA-256 must be 64 lowercase hexadecimal characters.');
const BucketSchema = z.string().trim().min(3).max(222).regex(/^[a-z0-9][a-z0-9._-]+[a-z0-9]$/);
const ObjectPathSchema = z.string().trim().min(1).max(1024).refine(
    (path) => !path.startsWith('/') && !path.includes('://'),
    'Use a bucket-relative private object path, not a URL.',
);
const MicrosecondsSchema = z.number().int().nonnegative();

export const MasterTimingProfileSchema = z.object({
    schemaVersion: z.literal('master-timing-profile.v1'),
    contentHash: Sha256Schema,
    generation: StorageGenerationSchema,
    masterFingerprint: IdentifierSchema,
    durationUs: MicrosecondsSchema.positive(),
    sampleRate: z.number().int().positive(),
    bpm: z.number().positive().optional(),
    beatsUs: z.array(MicrosecondsSchema),
    onsetsUs: z.array(MicrosecondsSchema),
    chromaSequence: z.array(z.array(z.number().min(0).max(1))).optional(),
    landmarks: z.array(z.object({
        timeUs: MicrosecondsSchema,
        frequencyHz: z.number().nonnegative(),
        hash: z.string().trim().min(1),
    }).strict()).optional(),
    createdAt: z.string().datetime(),
}).strict();

export const AlignmentAnchorSchema = z.object({
    videoUs: MicrosecondsSchema,
    masterUs: MicrosecondsSchema,
    confidence: z.number().min(0).max(1),
    method: z.enum(['onset', 'chroma', 'cross_correlation', 'manual']),
}).strict();

export const ManualOverrideSchema = z.object({
    videoUs: MicrosecondsSchema,
    masterUs: MicrosecondsSchema,
    userUid: IdentifierSchema,
    createdAt: z.string().datetime(),
    reason: z.string().trim().min(1).max(500),
}).strict();

export const CanonicalMasterRefSchema = z.object({
    bucket: BucketSchema,
    path: ObjectPathSchema,
    generation: StorageGenerationSchema,
    sha256: Sha256Schema,
    masterFingerprint: IdentifierSchema,
}).strict();

export const MasterSyncAlignmentSchema = z.object({
    schemaVersion: z.literal('master-sync-alignment.v1'),
    alignmentId: IdentifierSchema,
    sessionId: IdentifierSchema,
    ownerUid: IdentifierSchema,
    organizationId: IdentifierSchema,
    projectId: IdentifierSchema,
    timeMapVersion: z.literal('sync-time-map.v1'),
    guideAudioRef: CanonicalMediaRefSchema,
    canonicalMasterRef: CanonicalMasterRefSchema,
    anchors: z.array(AlignmentAnchorSchema),
    fitModel: z.enum(['linear', 'piecewise_linear']),
    residualP95Us: z.number().int().nonnegative(),
    driftPpm: z.number(),
    status: z.enum(['locked', 'needs_review', 'no_match', 'failed']),
    aggregateConfidence: z.number().min(0).max(1),
    algorithmVersion: IdentifierSchema,
    manualOverrides: z.array(ManualOverrideSchema).default([]),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
    receiptId: IdentifierSchema,
}).strict().superRefine((alignment, ctx) => {
    // 1. Check ownership consistency
    if (
        alignment.guideAudioRef.ownerUid !== alignment.ownerUid
        || alignment.guideAudioRef.organizationId !== alignment.organizationId
        || alignment.guideAudioRef.projectId !== alignment.projectId
    ) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['guideAudioRef'],
            message: 'Guide audio owner, organization, and project must match the alignment identity.',
        });
    }

    if (alignment.guideAudioRef.role !== 'guide_audio') {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['guideAudioRef', 'role'],
            message: 'Guide audio reference must use role guide_audio.',
        });
    }

    // 2. Anchor ordering & monotonicity validation
    for (let idx = 1; idx < alignment.anchors.length; idx += 1) {
        const prev = alignment.anchors[idx - 1];
        const curr = alignment.anchors[idx];
        if (!prev || !curr) continue;
        if (curr.videoUs <= prev.videoUs) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['anchors', idx, 'videoUs'],
                message: 'Anchors must be strictly monotonic in video presentation time.',
            });
        }
        if (curr.masterUs <= prev.masterUs) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['anchors', idx, 'masterUs'],
                message: 'Anchors must be strictly monotonic in master presentation time.',
            });
        }
    }

    // 3. Confidence & Auto-lock policy enforcement
    // Status "locked" requires high confidence (>=0.80) and low residual (<=40,000 us / 40ms)
    if (alignment.status === 'locked') {
        if (alignment.aggregateConfidence < 0.80) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['status'],
                message: 'Status cannot be locked when aggregate confidence is below 0.80.',
            });
        }
        if (alignment.residualP95Us > 40_000) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['status'],
                message: 'Status cannot be locked when residual P95 error exceeds 40ms (40,000 us).',
            });
        }
        if (alignment.anchors.length < 2) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['anchors'],
                message: 'Locked status requires at least 2 alignment anchors.',
            });
        }
    }

    if (alignment.status === 'no_match' && alignment.anchors.length > 0) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['anchors'],
            message: 'No-match alignments cannot contain matching anchors.',
        });
    }
});

export type MasterTimingProfile = z.infer<typeof MasterTimingProfileSchema>;
export type AlignmentAnchor = z.infer<typeof AlignmentAnchorSchema>;
export type ManualOverride = z.infer<typeof ManualOverrideSchema>;
export type CanonicalMasterRef = z.infer<typeof CanonicalMasterRefSchema>;
export type MasterSyncAlignment = z.infer<typeof MasterSyncAlignmentSchema>;
