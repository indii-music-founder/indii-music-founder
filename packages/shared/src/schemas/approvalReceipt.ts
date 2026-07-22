import { z } from 'zod';

const IdentifierSchema = z.string().trim().min(1).max(256);

export const SegmentApprovalDecisionSchema = z.object({
    segmentId: IdentifierSchema,
    action: z.enum(['keep', 'reject', 'blooper']),
    overrideProxyStartUs: z.number().int().nonnegative().optional(),
    overrideProxyEndUs: z.number().int().nonnegative().optional(),
    overrideAudioRecipeId: IdentifierSchema.optional(),
    acknowledgedLowConfidence: z.boolean().default(false),
}).strict();

export const ApprovalReceiptSchema = z.object({
    schemaVersion: z.literal('approval-receipt.v1'),
    approvalReceiptId: IdentifierSchema,
    sessionId: IdentifierSchema,
    planId: IdentifierSchema,
    ownerUid: IdentifierSchema,
    organizationId: IdentifierSchema,
    projectId: IdentifierSchema,
    sourceGeneration: z.string().regex(/^\d+$/),
    masterGeneration: z.string().regex(/^\d+$/).optional(),
    decisions: z.array(SegmentApprovalDecisionSchema).min(1),
    approvedAt: z.string().datetime(),
    approverUid: IdentifierSchema,
}).strict().superRefine((receipt, ctx) => {
    if (receipt.approverUid !== receipt.ownerUid) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['approverUid'], message: 'Approver must be the session owner.' });
    }
});

export type SegmentApprovalDecision = z.infer<typeof SegmentApprovalDecisionSchema>;
export type ApprovalReceipt = z.infer<typeof ApprovalReceiptSchema>;
