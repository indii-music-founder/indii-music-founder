import { z } from 'zod';

const IdentifierSchema = z.string().trim().min(1).max(256);
const MicrosecondsSchema = z.number().int().nonnegative();

export const SessionSegmentClassificationSchema = z.enum([
    'performance',
    'spoken',
    'candid',
    'failed_take',
    'setup',
    'unknown',
]);

export const SegmentQualityFlagSchema = z.enum([
    'clipping',
    'noise',
    'reverb',
    'low_volume',
    'wind',
    'overlapping_speech',
]);

export const WordTimestampSchema = z.object({
    word: z.string().trim().min(1),
    startUs: MicrosecondsSchema,
    endUs: MicrosecondsSchema,
    confidence: z.number().min(0).max(1),
}).strict().superRefine((w, ctx) => {
    if (w.endUs < w.startUs) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['endUs'], message: 'Word endUs must be >= startUs.' });
    }
});

export const SessionSegmentSchema = z.object({
    segmentId: IdentifierSchema,
    classification: SessionSegmentClassificationSchema,
    proxyStartUs: MicrosecondsSchema,
    proxyEndUs: MicrosecondsSchema,
    originalStartUs: MicrosecondsSchema,
    originalEndUs: MicrosecondsSchema,
    transcriptText: z.string(),
    words: z.array(WordTimestampSchema).default([]),
    confidence: z.number().min(0).max(1),
    takeIndex: z.number().int().nonnegative().optional(),
    isBestTake: z.boolean().default(false),
    qualityFlags: z.array(SegmentQualityFlagSchema).default([]),
    syncAlignmentId: IdentifierSchema.optional(),
    audioRecipeId: IdentifierSchema.optional(),
    userNotes: z.string().max(1000).optional(),
}).strict().superRefine((segment, ctx) => {
    if (segment.proxyEndUs <= segment.proxyStartUs) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['proxyEndUs'], message: 'Segment proxyEndUs must be > proxyStartUs.' });
    }
    if (segment.originalEndUs <= segment.originalStartUs) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['originalEndUs'], message: 'Segment originalEndUs must be > originalStartUs.' });
    }
});

export const ModelProvenanceSchema = z.object({
    provider: z.string().trim().min(1),
    modelId: z.string().trim().min(1),
    promptTokens: z.number().int().nonnegative().optional(),
    completionTokens: z.number().int().nonnegative().optional(),
    thoughtSignature: z.string().optional(),
}).strict();

export const SessionEditPlanSchema = z.object({
    schemaVersion: z.literal('session-edit-plan.v1'),
    planId: IdentifierSchema,
    sessionId: IdentifierSchema,
    ownerUid: IdentifierSchema,
    organizationId: IdentifierSchema,
    projectId: IdentifierSchema,
    sourceGeneration: z.string().regex(/^\d+$/),
    segments: z.array(SessionSegmentSchema).min(1),
    modelProvenance: ModelProvenanceSchema,
    createdAt: z.string().datetime(),
    receiptId: IdentifierSchema,
}).strict().superRefine((plan, ctx) => {
    for (let i = 1; i < plan.segments.length; i += 1) {
        const prev = plan.segments[i - 1];
        const curr = plan.segments[i];
        if (!prev || !curr) continue;
        if (curr.proxyStartUs < prev.proxyEndUs) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['segments', i, 'proxyStartUs'],
                message: 'Plan segments must be ordered and non-overlapping in proxy time.',
            });
        }
    }
});

export type SessionSegmentClassification = z.infer<typeof SessionSegmentClassificationSchema>;
export type SegmentQualityFlag = z.infer<typeof SegmentQualityFlagSchema>;
export type WordTimestamp = z.infer<typeof WordTimestampSchema>;
export type SessionSegment = z.infer<typeof SessionSegmentSchema>;
export type ModelProvenance = z.infer<typeof ModelProvenanceSchema>;
export type SessionEditPlan = z.infer<typeof SessionEditPlanSchema>;
