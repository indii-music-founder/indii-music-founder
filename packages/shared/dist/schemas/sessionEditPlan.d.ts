import { z } from 'zod';
export declare const SessionSegmentClassificationSchema: z.ZodEnum<["performance", "spoken", "candid", "failed_take", "setup", "unknown"]>;
export declare const SegmentQualityFlagSchema: z.ZodEnum<["clipping", "noise", "reverb", "low_volume", "wind", "overlapping_speech"]>;
export declare const WordTimestampSchema: z.ZodEffects<z.ZodObject<{
    word: z.ZodString;
    startUs: z.ZodNumber;
    endUs: z.ZodNumber;
    confidence: z.ZodNumber;
}, "strict", z.ZodTypeAny, {
    word: string;
    startUs: number;
    endUs: number;
    confidence: number;
}, {
    word: string;
    startUs: number;
    endUs: number;
    confidence: number;
}>, {
    word: string;
    startUs: number;
    endUs: number;
    confidence: number;
}, {
    word: string;
    startUs: number;
    endUs: number;
    confidence: number;
}>;
export declare const SessionSegmentSchema: z.ZodEffects<z.ZodObject<{
    segmentId: z.ZodString;
    classification: z.ZodEnum<["performance", "spoken", "candid", "failed_take", "setup", "unknown"]>;
    proxyStartUs: z.ZodNumber;
    proxyEndUs: z.ZodNumber;
    originalStartUs: z.ZodNumber;
    originalEndUs: z.ZodNumber;
    transcriptText: z.ZodString;
    words: z.ZodDefault<z.ZodArray<z.ZodEffects<z.ZodObject<{
        word: z.ZodString;
        startUs: z.ZodNumber;
        endUs: z.ZodNumber;
        confidence: z.ZodNumber;
    }, "strict", z.ZodTypeAny, {
        word: string;
        startUs: number;
        endUs: number;
        confidence: number;
    }, {
        word: string;
        startUs: number;
        endUs: number;
        confidence: number;
    }>, {
        word: string;
        startUs: number;
        endUs: number;
        confidence: number;
    }, {
        word: string;
        startUs: number;
        endUs: number;
        confidence: number;
    }>, "many">>;
    confidence: z.ZodNumber;
    takeIndex: z.ZodOptional<z.ZodNumber>;
    isBestTake: z.ZodDefault<z.ZodBoolean>;
    qualityFlags: z.ZodDefault<z.ZodArray<z.ZodEnum<["clipping", "noise", "reverb", "low_volume", "wind", "overlapping_speech"]>, "many">>;
    syncAlignmentId: z.ZodOptional<z.ZodString>;
    audioRecipeId: z.ZodOptional<z.ZodString>;
    userNotes: z.ZodOptional<z.ZodString>;
}, "strict", z.ZodTypeAny, {
    proxyStartUs: number;
    proxyEndUs: number;
    originalStartUs: number;
    originalEndUs: number;
    confidence: number;
    segmentId: string;
    classification: "unknown" | "performance" | "spoken" | "candid" | "failed_take" | "setup";
    transcriptText: string;
    words: {
        word: string;
        startUs: number;
        endUs: number;
        confidence: number;
    }[];
    isBestTake: boolean;
    qualityFlags: ("clipping" | "noise" | "reverb" | "low_volume" | "wind" | "overlapping_speech")[];
    takeIndex?: number | undefined;
    syncAlignmentId?: string | undefined;
    audioRecipeId?: string | undefined;
    userNotes?: string | undefined;
}, {
    proxyStartUs: number;
    proxyEndUs: number;
    originalStartUs: number;
    originalEndUs: number;
    confidence: number;
    segmentId: string;
    classification: "unknown" | "performance" | "spoken" | "candid" | "failed_take" | "setup";
    transcriptText: string;
    words?: {
        word: string;
        startUs: number;
        endUs: number;
        confidence: number;
    }[] | undefined;
    takeIndex?: number | undefined;
    isBestTake?: boolean | undefined;
    qualityFlags?: ("clipping" | "noise" | "reverb" | "low_volume" | "wind" | "overlapping_speech")[] | undefined;
    syncAlignmentId?: string | undefined;
    audioRecipeId?: string | undefined;
    userNotes?: string | undefined;
}>, {
    proxyStartUs: number;
    proxyEndUs: number;
    originalStartUs: number;
    originalEndUs: number;
    confidence: number;
    segmentId: string;
    classification: "unknown" | "performance" | "spoken" | "candid" | "failed_take" | "setup";
    transcriptText: string;
    words: {
        word: string;
        startUs: number;
        endUs: number;
        confidence: number;
    }[];
    isBestTake: boolean;
    qualityFlags: ("clipping" | "noise" | "reverb" | "low_volume" | "wind" | "overlapping_speech")[];
    takeIndex?: number | undefined;
    syncAlignmentId?: string | undefined;
    audioRecipeId?: string | undefined;
    userNotes?: string | undefined;
}, {
    proxyStartUs: number;
    proxyEndUs: number;
    originalStartUs: number;
    originalEndUs: number;
    confidence: number;
    segmentId: string;
    classification: "unknown" | "performance" | "spoken" | "candid" | "failed_take" | "setup";
    transcriptText: string;
    words?: {
        word: string;
        startUs: number;
        endUs: number;
        confidence: number;
    }[] | undefined;
    takeIndex?: number | undefined;
    isBestTake?: boolean | undefined;
    qualityFlags?: ("clipping" | "noise" | "reverb" | "low_volume" | "wind" | "overlapping_speech")[] | undefined;
    syncAlignmentId?: string | undefined;
    audioRecipeId?: string | undefined;
    userNotes?: string | undefined;
}>;
export declare const ModelProvenanceSchema: z.ZodObject<{
    provider: z.ZodString;
    modelId: z.ZodString;
    promptTokens: z.ZodOptional<z.ZodNumber>;
    completionTokens: z.ZodOptional<z.ZodNumber>;
    thoughtSignature: z.ZodOptional<z.ZodString>;
}, "strict", z.ZodTypeAny, {
    provider: string;
    modelId: string;
    promptTokens?: number | undefined;
    completionTokens?: number | undefined;
    thoughtSignature?: string | undefined;
}, {
    provider: string;
    modelId: string;
    promptTokens?: number | undefined;
    completionTokens?: number | undefined;
    thoughtSignature?: string | undefined;
}>;
export declare const SessionEditPlanSchema: z.ZodEffects<z.ZodObject<{
    schemaVersion: z.ZodLiteral<"session-edit-plan.v1">;
    planId: z.ZodString;
    sessionId: z.ZodString;
    ownerUid: z.ZodString;
    organizationId: z.ZodString;
    projectId: z.ZodString;
    sourceGeneration: z.ZodString;
    segments: z.ZodArray<z.ZodEffects<z.ZodObject<{
        segmentId: z.ZodString;
        classification: z.ZodEnum<["performance", "spoken", "candid", "failed_take", "setup", "unknown"]>;
        proxyStartUs: z.ZodNumber;
        proxyEndUs: z.ZodNumber;
        originalStartUs: z.ZodNumber;
        originalEndUs: z.ZodNumber;
        transcriptText: z.ZodString;
        words: z.ZodDefault<z.ZodArray<z.ZodEffects<z.ZodObject<{
            word: z.ZodString;
            startUs: z.ZodNumber;
            endUs: z.ZodNumber;
            confidence: z.ZodNumber;
        }, "strict", z.ZodTypeAny, {
            word: string;
            startUs: number;
            endUs: number;
            confidence: number;
        }, {
            word: string;
            startUs: number;
            endUs: number;
            confidence: number;
        }>, {
            word: string;
            startUs: number;
            endUs: number;
            confidence: number;
        }, {
            word: string;
            startUs: number;
            endUs: number;
            confidence: number;
        }>, "many">>;
        confidence: z.ZodNumber;
        takeIndex: z.ZodOptional<z.ZodNumber>;
        isBestTake: z.ZodDefault<z.ZodBoolean>;
        qualityFlags: z.ZodDefault<z.ZodArray<z.ZodEnum<["clipping", "noise", "reverb", "low_volume", "wind", "overlapping_speech"]>, "many">>;
        syncAlignmentId: z.ZodOptional<z.ZodString>;
        audioRecipeId: z.ZodOptional<z.ZodString>;
        userNotes: z.ZodOptional<z.ZodString>;
    }, "strict", z.ZodTypeAny, {
        proxyStartUs: number;
        proxyEndUs: number;
        originalStartUs: number;
        originalEndUs: number;
        confidence: number;
        segmentId: string;
        classification: "unknown" | "performance" | "spoken" | "candid" | "failed_take" | "setup";
        transcriptText: string;
        words: {
            word: string;
            startUs: number;
            endUs: number;
            confidence: number;
        }[];
        isBestTake: boolean;
        qualityFlags: ("clipping" | "noise" | "reverb" | "low_volume" | "wind" | "overlapping_speech")[];
        takeIndex?: number | undefined;
        syncAlignmentId?: string | undefined;
        audioRecipeId?: string | undefined;
        userNotes?: string | undefined;
    }, {
        proxyStartUs: number;
        proxyEndUs: number;
        originalStartUs: number;
        originalEndUs: number;
        confidence: number;
        segmentId: string;
        classification: "unknown" | "performance" | "spoken" | "candid" | "failed_take" | "setup";
        transcriptText: string;
        words?: {
            word: string;
            startUs: number;
            endUs: number;
            confidence: number;
        }[] | undefined;
        takeIndex?: number | undefined;
        isBestTake?: boolean | undefined;
        qualityFlags?: ("clipping" | "noise" | "reverb" | "low_volume" | "wind" | "overlapping_speech")[] | undefined;
        syncAlignmentId?: string | undefined;
        audioRecipeId?: string | undefined;
        userNotes?: string | undefined;
    }>, {
        proxyStartUs: number;
        proxyEndUs: number;
        originalStartUs: number;
        originalEndUs: number;
        confidence: number;
        segmentId: string;
        classification: "unknown" | "performance" | "spoken" | "candid" | "failed_take" | "setup";
        transcriptText: string;
        words: {
            word: string;
            startUs: number;
            endUs: number;
            confidence: number;
        }[];
        isBestTake: boolean;
        qualityFlags: ("clipping" | "noise" | "reverb" | "low_volume" | "wind" | "overlapping_speech")[];
        takeIndex?: number | undefined;
        syncAlignmentId?: string | undefined;
        audioRecipeId?: string | undefined;
        userNotes?: string | undefined;
    }, {
        proxyStartUs: number;
        proxyEndUs: number;
        originalStartUs: number;
        originalEndUs: number;
        confidence: number;
        segmentId: string;
        classification: "unknown" | "performance" | "spoken" | "candid" | "failed_take" | "setup";
        transcriptText: string;
        words?: {
            word: string;
            startUs: number;
            endUs: number;
            confidence: number;
        }[] | undefined;
        takeIndex?: number | undefined;
        isBestTake?: boolean | undefined;
        qualityFlags?: ("clipping" | "noise" | "reverb" | "low_volume" | "wind" | "overlapping_speech")[] | undefined;
        syncAlignmentId?: string | undefined;
        audioRecipeId?: string | undefined;
        userNotes?: string | undefined;
    }>, "many">;
    modelProvenance: z.ZodObject<{
        provider: z.ZodString;
        modelId: z.ZodString;
        promptTokens: z.ZodOptional<z.ZodNumber>;
        completionTokens: z.ZodOptional<z.ZodNumber>;
        thoughtSignature: z.ZodOptional<z.ZodString>;
    }, "strict", z.ZodTypeAny, {
        provider: string;
        modelId: string;
        promptTokens?: number | undefined;
        completionTokens?: number | undefined;
        thoughtSignature?: string | undefined;
    }, {
        provider: string;
        modelId: string;
        promptTokens?: number | undefined;
        completionTokens?: number | undefined;
        thoughtSignature?: string | undefined;
    }>;
    createdAt: z.ZodString;
    receiptId: z.ZodString;
}, "strict", z.ZodTypeAny, {
    createdAt: string;
    schemaVersion: "session-edit-plan.v1";
    projectId: string;
    sessionId: string;
    ownerUid: string;
    organizationId: string;
    segments: {
        proxyStartUs: number;
        proxyEndUs: number;
        originalStartUs: number;
        originalEndUs: number;
        confidence: number;
        segmentId: string;
        classification: "unknown" | "performance" | "spoken" | "candid" | "failed_take" | "setup";
        transcriptText: string;
        words: {
            word: string;
            startUs: number;
            endUs: number;
            confidence: number;
        }[];
        isBestTake: boolean;
        qualityFlags: ("clipping" | "noise" | "reverb" | "low_volume" | "wind" | "overlapping_speech")[];
        takeIndex?: number | undefined;
        syncAlignmentId?: string | undefined;
        audioRecipeId?: string | undefined;
        userNotes?: string | undefined;
    }[];
    receiptId: string;
    planId: string;
    sourceGeneration: string;
    modelProvenance: {
        provider: string;
        modelId: string;
        promptTokens?: number | undefined;
        completionTokens?: number | undefined;
        thoughtSignature?: string | undefined;
    };
}, {
    createdAt: string;
    schemaVersion: "session-edit-plan.v1";
    projectId: string;
    sessionId: string;
    ownerUid: string;
    organizationId: string;
    segments: {
        proxyStartUs: number;
        proxyEndUs: number;
        originalStartUs: number;
        originalEndUs: number;
        confidence: number;
        segmentId: string;
        classification: "unknown" | "performance" | "spoken" | "candid" | "failed_take" | "setup";
        transcriptText: string;
        words?: {
            word: string;
            startUs: number;
            endUs: number;
            confidence: number;
        }[] | undefined;
        takeIndex?: number | undefined;
        isBestTake?: boolean | undefined;
        qualityFlags?: ("clipping" | "noise" | "reverb" | "low_volume" | "wind" | "overlapping_speech")[] | undefined;
        syncAlignmentId?: string | undefined;
        audioRecipeId?: string | undefined;
        userNotes?: string | undefined;
    }[];
    receiptId: string;
    planId: string;
    sourceGeneration: string;
    modelProvenance: {
        provider: string;
        modelId: string;
        promptTokens?: number | undefined;
        completionTokens?: number | undefined;
        thoughtSignature?: string | undefined;
    };
}>, {
    createdAt: string;
    schemaVersion: "session-edit-plan.v1";
    projectId: string;
    sessionId: string;
    ownerUid: string;
    organizationId: string;
    segments: {
        proxyStartUs: number;
        proxyEndUs: number;
        originalStartUs: number;
        originalEndUs: number;
        confidence: number;
        segmentId: string;
        classification: "unknown" | "performance" | "spoken" | "candid" | "failed_take" | "setup";
        transcriptText: string;
        words: {
            word: string;
            startUs: number;
            endUs: number;
            confidence: number;
        }[];
        isBestTake: boolean;
        qualityFlags: ("clipping" | "noise" | "reverb" | "low_volume" | "wind" | "overlapping_speech")[];
        takeIndex?: number | undefined;
        syncAlignmentId?: string | undefined;
        audioRecipeId?: string | undefined;
        userNotes?: string | undefined;
    }[];
    receiptId: string;
    planId: string;
    sourceGeneration: string;
    modelProvenance: {
        provider: string;
        modelId: string;
        promptTokens?: number | undefined;
        completionTokens?: number | undefined;
        thoughtSignature?: string | undefined;
    };
}, {
    createdAt: string;
    schemaVersion: "session-edit-plan.v1";
    projectId: string;
    sessionId: string;
    ownerUid: string;
    organizationId: string;
    segments: {
        proxyStartUs: number;
        proxyEndUs: number;
        originalStartUs: number;
        originalEndUs: number;
        confidence: number;
        segmentId: string;
        classification: "unknown" | "performance" | "spoken" | "candid" | "failed_take" | "setup";
        transcriptText: string;
        words?: {
            word: string;
            startUs: number;
            endUs: number;
            confidence: number;
        }[] | undefined;
        takeIndex?: number | undefined;
        isBestTake?: boolean | undefined;
        qualityFlags?: ("clipping" | "noise" | "reverb" | "low_volume" | "wind" | "overlapping_speech")[] | undefined;
        syncAlignmentId?: string | undefined;
        audioRecipeId?: string | undefined;
        userNotes?: string | undefined;
    }[];
    receiptId: string;
    planId: string;
    sourceGeneration: string;
    modelProvenance: {
        provider: string;
        modelId: string;
        promptTokens?: number | undefined;
        completionTokens?: number | undefined;
        thoughtSignature?: string | undefined;
    };
}>;
export type SessionSegmentClassification = z.infer<typeof SessionSegmentClassificationSchema>;
export type SegmentQualityFlag = z.infer<typeof SegmentQualityFlagSchema>;
export type WordTimestamp = z.infer<typeof WordTimestampSchema>;
export type SessionSegment = z.infer<typeof SessionSegmentSchema>;
export type ModelProvenance = z.infer<typeof ModelProvenanceSchema>;
export type SessionEditPlan = z.infer<typeof SessionEditPlanSchema>;
//# sourceMappingURL=sessionEditPlan.d.ts.map