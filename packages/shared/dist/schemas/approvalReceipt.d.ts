import { z } from 'zod';
export declare const SegmentApprovalDecisionSchema: z.ZodObject<{
    segmentId: z.ZodString;
    action: z.ZodEnum<["keep", "reject", "blooper"]>;
    overrideProxyStartUs: z.ZodOptional<z.ZodNumber>;
    overrideProxyEndUs: z.ZodOptional<z.ZodNumber>;
    overrideAudioRecipeId: z.ZodOptional<z.ZodString>;
    acknowledgedLowConfidence: z.ZodDefault<z.ZodBoolean>;
}, "strict", z.ZodTypeAny, {
    segmentId: string;
    action: "keep" | "reject" | "blooper";
    acknowledgedLowConfidence: boolean;
    overrideProxyStartUs?: number | undefined;
    overrideProxyEndUs?: number | undefined;
    overrideAudioRecipeId?: string | undefined;
}, {
    segmentId: string;
    action: "keep" | "reject" | "blooper";
    overrideProxyStartUs?: number | undefined;
    overrideProxyEndUs?: number | undefined;
    overrideAudioRecipeId?: string | undefined;
    acknowledgedLowConfidence?: boolean | undefined;
}>;
export declare const ApprovalReceiptSchema: z.ZodEffects<z.ZodObject<{
    schemaVersion: z.ZodLiteral<"approval-receipt.v1">;
    approvalReceiptId: z.ZodString;
    sessionId: z.ZodString;
    planId: z.ZodString;
    ownerUid: z.ZodString;
    organizationId: z.ZodString;
    projectId: z.ZodString;
    sourceGeneration: z.ZodString;
    masterGeneration: z.ZodOptional<z.ZodString>;
    decisions: z.ZodArray<z.ZodObject<{
        segmentId: z.ZodString;
        action: z.ZodEnum<["keep", "reject", "blooper"]>;
        overrideProxyStartUs: z.ZodOptional<z.ZodNumber>;
        overrideProxyEndUs: z.ZodOptional<z.ZodNumber>;
        overrideAudioRecipeId: z.ZodOptional<z.ZodString>;
        acknowledgedLowConfidence: z.ZodDefault<z.ZodBoolean>;
    }, "strict", z.ZodTypeAny, {
        segmentId: string;
        action: "keep" | "reject" | "blooper";
        acknowledgedLowConfidence: boolean;
        overrideProxyStartUs?: number | undefined;
        overrideProxyEndUs?: number | undefined;
        overrideAudioRecipeId?: string | undefined;
    }, {
        segmentId: string;
        action: "keep" | "reject" | "blooper";
        overrideProxyStartUs?: number | undefined;
        overrideProxyEndUs?: number | undefined;
        overrideAudioRecipeId?: string | undefined;
        acknowledgedLowConfidence?: boolean | undefined;
    }>, "many">;
    approvedAt: z.ZodString;
    approverUid: z.ZodString;
}, "strict", z.ZodTypeAny, {
    schemaVersion: "approval-receipt.v1";
    projectId: string;
    sessionId: string;
    ownerUid: string;
    organizationId: string;
    planId: string;
    sourceGeneration: string;
    approvalReceiptId: string;
    decisions: {
        segmentId: string;
        action: "keep" | "reject" | "blooper";
        acknowledgedLowConfidence: boolean;
        overrideProxyStartUs?: number | undefined;
        overrideProxyEndUs?: number | undefined;
        overrideAudioRecipeId?: string | undefined;
    }[];
    approvedAt: string;
    approverUid: string;
    masterGeneration?: string | undefined;
}, {
    schemaVersion: "approval-receipt.v1";
    projectId: string;
    sessionId: string;
    ownerUid: string;
    organizationId: string;
    planId: string;
    sourceGeneration: string;
    approvalReceiptId: string;
    decisions: {
        segmentId: string;
        action: "keep" | "reject" | "blooper";
        overrideProxyStartUs?: number | undefined;
        overrideProxyEndUs?: number | undefined;
        overrideAudioRecipeId?: string | undefined;
        acknowledgedLowConfidence?: boolean | undefined;
    }[];
    approvedAt: string;
    approverUid: string;
    masterGeneration?: string | undefined;
}>, {
    schemaVersion: "approval-receipt.v1";
    projectId: string;
    sessionId: string;
    ownerUid: string;
    organizationId: string;
    planId: string;
    sourceGeneration: string;
    approvalReceiptId: string;
    decisions: {
        segmentId: string;
        action: "keep" | "reject" | "blooper";
        acknowledgedLowConfidence: boolean;
        overrideProxyStartUs?: number | undefined;
        overrideProxyEndUs?: number | undefined;
        overrideAudioRecipeId?: string | undefined;
    }[];
    approvedAt: string;
    approverUid: string;
    masterGeneration?: string | undefined;
}, {
    schemaVersion: "approval-receipt.v1";
    projectId: string;
    sessionId: string;
    ownerUid: string;
    organizationId: string;
    planId: string;
    sourceGeneration: string;
    approvalReceiptId: string;
    decisions: {
        segmentId: string;
        action: "keep" | "reject" | "blooper";
        overrideProxyStartUs?: number | undefined;
        overrideProxyEndUs?: number | undefined;
        overrideAudioRecipeId?: string | undefined;
        acknowledgedLowConfidence?: boolean | undefined;
    }[];
    approvedAt: string;
    approverUid: string;
    masterGeneration?: string | undefined;
}>;
export type SegmentApprovalDecision = z.infer<typeof SegmentApprovalDecisionSchema>;
export type ApprovalReceipt = z.infer<typeof ApprovalReceiptSchema>;
//# sourceMappingURL=approvalReceipt.d.ts.map