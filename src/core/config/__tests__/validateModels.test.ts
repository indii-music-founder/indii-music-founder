import { describe, it, expect } from 'vitest';
import { APPROVED_MODELS, ModelIdSchema } from '../ai-models';

describe('AI Model Validation', () => {
    it('should have only valid model IDs in APPROVED_MODELS', () => {
        const models = Object.values(APPROVED_MODELS);
        for (const modelId of models) {
            const result = ModelIdSchema.safeParse(modelId);
            expect(result.success).toBe(true);
        }
    });

    it('should block forbidden models', () => {
        const forbiddenModels = [
            'gemini-1.5-pro',
            'gemini-2.0-flash',
            'gemini-pro',
            'gemini-pro-vision'
        ];

        for (const modelId of forbiddenModels) {
            const result = ModelIdSchema.safeParse(modelId);
            expect(result.success).toBe(false);
        }
    });

    it('should ensure all approved models are within the correct namespace/format', () => {
        const models = Object.values(APPROVED_MODELS);
        for (const modelId of models) {
            // All recent models should contain 'gemini' or 'veo'
            expect(modelId).toMatch(/^(gemini|veo)-/);
        }
    });
});
