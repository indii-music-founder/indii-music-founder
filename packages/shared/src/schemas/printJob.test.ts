import { describe, expect, it } from 'vitest';
import {
    PrintJobSchema,
    EnqueuePrintJobInputSchema,
    PrintPlanSummarySchema,
} from './printJob';

describe('PrintJobSchema', () => {
    it('validates a valid queued print job document', () => {
        const doc = {
            jobId: 'job-123',
            userId: 'user-456',
            sourceUri: 'gs://indii-bucket/artwork.png',
            presetId: 'poster_18x24',
            bleedMode: 'extend',
            focusX: 0.5,
            focusY: 0.5,
            generateGuide: true,
            status: 'queued',
            progress: 0,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };

        const result = PrintJobSchema.safeParse(doc);
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.jobId).toBe('job-123');
            expect(result.data.bleedMode).toBe('extend');
        }
    });

    it('applies defaults for optional fields in EnqueuePrintJobInputSchema', () => {
        const input = {
            imageUri: 'gs://indii-bucket/cover.png',
            presetId: 'vinyl_sleeve',
        };

        const parsed = EnqueuePrintJobInputSchema.parse(input);
        expect(parsed.bleedMode).toBe('extend');
        expect(parsed.focusX).toBe(0.5);
        expect(parsed.focusY).toBe(0.5);
        expect(parsed.generateGuide).toBe(false);
    });

    it('rejects invalid bleedMode or invalid focus range', () => {
        expect(() =>
            EnqueuePrintJobInputSchema.parse({
                imageUri: 'gs://indii-bucket/cover.png',
                presetId: 'vinyl_sleeve',
                bleedMode: 'invalid_mode',
            })
        ).toThrow();

        expect(() =>
            EnqueuePrintJobInputSchema.parse({
                imageUri: 'gs://indii-bucket/cover.png',
                presetId: 'vinyl_sleeve',
                focusX: 1.5,
            })
        ).toThrow();
    });

    it('validates PrintPlanSummarySchema structure', () => {
        const plan = {
            requiredWidthPx: 3788,
            requiredHeightPx: 3788,
            trimWidthIn: 12.375,
            trimHeightIn: 12.375,
            bleedIn: 0.125,
            safeIn: 0.125,
            dpi: 300,
            requiredUpscaleFactor: 1.85,
            verdict: 'upscale' as const,
        };

        const result = PrintPlanSummarySchema.safeParse(plan);
        expect(result.success).toBe(true);
    });
});
