import { z } from 'zod';
const IdentifierSchema = z.string().trim().min(1).max(256);
const FirestoreDocumentIdSchema = z.string().trim().regex(/^[A-Za-z0-9_-]{1,256}$/);
export const AspectRatioSchema = z.enum(['9:16', '1:1', '16:9']);
export const DerivativeAssetReceiptSchema = z.object({
    schemaVersion: z.literal('derivative-asset-receipt.v1'),
    derivativeId: FirestoreDocumentIdSchema,
    sessionId: IdentifierSchema,
    approvalReceiptId: IdentifierSchema,
    timelineRevisionId: IdentifierSchema,
    renderJobId: FirestoreDocumentIdSchema,
    ownerUid: IdentifierSchema,
    organizationId: IdentifierSchema,
    projectId: IdentifierSchema,
    sourceGeneration: z.string().regex(/^\d+$/),
    masterGeneration: z.string().regex(/^\d+$/).optional(),
    aspectRatio: AspectRatioSchema,
    codec: z.enum(['h264', 'hevc', 'prores']),
    mimeType: z.literal('video/mp4'),
    width: z.number().int().positive(),
    height: z.number().int().positive(),
    durationUs: z.number().int().positive(),
    byteSize: z.number().int().positive(),
    sha256: z.string().regex(/^[a-f0-9]{64}$/),
    storageBucket: z.string().trim().min(3),
    storagePath: z.string().trim().min(1),
    generation: z.string().regex(/^\d+$/),
    metageneration: z.string().regex(/^[1-9]\d*$/),
    verifiedAt: z.string().datetime(),
    renderedAt: z.string().datetime(),
    renderCostUsd: z.number().min(0),
    isTerminalPlayable: z.literal(true),
}).strict().superRefine((receipt, ctx) => {
    if (Date.parse(receipt.verifiedAt) < Date.parse(receipt.renderedAt)) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['verifiedAt'],
            message: 'Derivative verification cannot predate render completion.',
        });
    }
    if (!Number.isSafeInteger(receipt.renderCostUsd * 1_000_000)) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['renderCostUsd'],
            message: 'Render cost must use exact USD micros.',
        });
    }
});
export const SocialHandoffDraftSchema = z.object({
    schemaVersion: z.literal('social-handoff-draft.v1'),
    draftId: IdentifierSchema,
    derivativeId: IdentifierSchema,
    ownerUid: IdentifierSchema,
    organizationId: IdentifierSchema,
    projectId: IdentifierSchema,
    targetPlatforms: z.array(z.enum(['tiktok', 'instagram', 'youtube', 'x'])).min(1),
    captionText: z.string().max(2200),
    suggestedHashtags: z.array(z.string().trim()).max(30),
    isPublished: z.literal(false),
    createdAt: z.string().datetime(),
}).strict();
