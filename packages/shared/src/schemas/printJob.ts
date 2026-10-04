import { z } from 'zod';

export const PrintBleedModeSchema = z.enum(['fill', 'extend']);
export type PrintBleedMode = z.infer<typeof PrintBleedModeSchema>;

export const PrintJobStatusSchema = z.enum(['queued', 'processing', 'done', 'failed', 'cancelled']);
export type PrintJobStatus = z.infer<typeof PrintJobStatusSchema>;

export const PrintPlanSummarySchema = z.object({
    requiredWidthPx: z.number().int().positive(),
    requiredHeightPx: z.number().int().positive(),
    trimWidthIn: z.number().positive(),
    trimHeightIn: z.number().positive(),
    bleedIn: z.number().nonnegative(),
    safeIn: z.number().nonnegative(),
    dpi: z.number().int().positive(),
    requiredUpscaleFactor: z.number().positive(),
    verdict: z.enum(['sufficient', 'upscale', 'insufficient']),
});
export type PrintPlanSummary = z.infer<typeof PrintPlanSummarySchema>;

export const PrintJobSchema = z.object({
    jobId: z.string().min(1),
    userId: z.string().min(1),
    sourceUri: z.string().min(1),
    presetId: z.string().min(1),
    bleedMode: PrintBleedModeSchema.default('extend'),
    focusX: z.number().min(0).max(1).default(0.5),
    focusY: z.number().min(0).max(1).default(0.5),
    generateGuide: z.boolean().default(false),
    status: PrintJobStatusSchema.default('queued'),
    progress: z.number().min(0).max(100).default(0),
    outputUri: z.string().optional(),
    guideUri: z.string().optional(),
    plan: PrintPlanSummarySchema.optional(),
    error: z.string().optional(),
    estimatedDurationSec: z.number().positive().optional(),
    createdAt: z.string(),
    updatedAt: z.string(),
    completedAt: z.string().optional(),
});
export type PrintJob = z.infer<typeof PrintJobSchema>;

export const EnqueuePrintJobInputSchema = z.object({
    imageUri: z.string().min(1),
    presetId: z.string().min(1),
    bleedMode: PrintBleedModeSchema.optional().default('extend'),
    focusX: z.number().min(0).max(1).optional().default(0.5),
    focusY: z.number().min(0).max(1).optional().default(0.5),
    generateGuide: z.boolean().optional().default(false),
});
export type EnqueuePrintJobInput = z.infer<typeof EnqueuePrintJobInputSchema>;

export const EnqueuePrintJobResultSchema = z.object({
    jobId: z.string().min(1),
    status: PrintJobStatusSchema,
    estimatedDurationSec: z.number().positive(),
    plan: PrintPlanSummarySchema,
});
export type EnqueuePrintJobResult = z.infer<typeof EnqueuePrintJobResultSchema>;
