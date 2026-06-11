import { describe, it, expect, vi } from 'vitest';
import {
    estimateCostUsd,
    getModelPricing,
    sanitizeModelKey,
    MODEL_PRICING,
    PRICING_LAST_VERIFIED
} from './ModelPricing';

vi.mock('@/utils/logger', () => ({
    logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() }
}));

describe('ModelPricing', () => {
    describe('estimateCostUsd — token models', () => {
        it('prices input and output tokens separately', () => {
            // gemini-3.1-pro-preview: $1.25/1M input, $10.00/1M output
            const cost = estimateCostUsd('gemini-3.1-pro-preview', {
                inputTokens: 1_000_000,
                outputTokens: 1_000_000
            });
            expect(cost).toBeCloseTo(1.25 + 10.0, 6);
        });

        it('does not conflate input and output (output costs more)', () => {
            const inputOnly = estimateCostUsd('gemini-3.1-pro-preview', { inputTokens: 1_000_000, outputTokens: 0 });
            const outputOnly = estimateCostUsd('gemini-3.1-pro-preview', { inputTokens: 0, outputTokens: 1_000_000 });
            expect(outputOnly).toBeGreaterThan(inputOnly);
        });

        it('treats missing token fields as zero', () => {
            expect(estimateCostUsd('gemini-3.1-flash-lite', {})).toBe(0);
        });

        it('clamps negative token counts to zero', () => {
            expect(estimateCostUsd('gemini-3.1-flash-lite', { inputTokens: -500, outputTokens: -500 })).toBe(0);
        });

        it('prices embeddings with zero output cost', () => {
            const cost = estimateCostUsd('gemini-embedding-001', { inputTokens: 2_000_000, outputTokens: 999 });
            expect(cost).toBeCloseTo((2_000_000 / 1_000_000) * 0.15, 6);
        });
    });

    describe('estimateCostUsd — image models', () => {
        it('charges per image plus prompt-token cost', () => {
            // gemini-3-pro-image-preview: $0.12/image + $1.25/1M prompt tokens
            const cost = estimateCostUsd('gemini-3-pro-image-preview', {
                images: 2,
                inputTokens: 1_000_000
            });
            expect(cost).toBeCloseTo(2 * 0.12 + 1.25, 6);
        });

        it('charges only per-image when no prompt tokens given', () => {
            const cost = estimateCostUsd('gemini-3.1-flash-image-preview', { images: 3 });
            expect(cost).toBeCloseTo(3 * 0.039, 6);
        });
    });

    describe('estimateCostUsd — video models', () => {
        it('charges per second of generated footage', () => {
            const cost = estimateCostUsd('veo-3.1-generate-preview', { seconds: 8 });
            expect(cost).toBeCloseTo(8 * 0.40, 6);
        });

        it('fast/lite tiers cost less than pro', () => {
            const pro = estimateCostUsd('veo-3.1-generate-preview', { seconds: 8 });
            const fast = estimateCostUsd('veo-3.1-fast-generate-preview', { seconds: 8 });
            const lite = estimateCostUsd('veo-3.1-lite-generate-preview', { seconds: 8 });
            expect(fast).toBeLessThan(pro);
            expect(lite).toBeLessThan(fast);
        });
    });

    describe('estimateCostUsd — TTS models', () => {
        it('charges per million characters', () => {
            const cost = estimateCostUsd('gemini-2.5-pro-tts', { characters: 500_000 });
            expect(cost).toBeCloseTo((500_000 / 1_000_000) * 16.0, 6);
        });
    });

    describe('getModelPricing — unknown models', () => {
        it('falls back conservatively (non-zero) rather than hiding cost', () => {
            const pricing = getModelPricing('some-unreleased-model-9000');
            expect(pricing.kind).toBe('token');
            // Must not silently cost nothing.
            const cost = estimateCostUsd('some-unreleased-model-9000', { inputTokens: 1_000_000, outputTokens: 1_000_000 });
            expect(cost).toBeGreaterThan(0);
        });
    });

    describe('sanitizeModelKey', () => {
        it('replaces dots so model IDs are valid Firestore map keys', () => {
            expect(sanitizeModelKey('gemini-3.1-pro-preview')).toBe('gemini-3_1-pro-preview');
        });

        it('strips other forbidden Firestore path characters', () => {
            expect(sanitizeModelKey('a.b#c$d/e[f]g')).toBe('a_b_c_d_e_f_g');
        });
    });

    describe('table integrity', () => {
        it('has a verification date', () => {
            expect(PRICING_LAST_VERIFIED).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        });

        it('every pricing entry has a valid positive rate for its kind', () => {
            for (const [model, pricing] of Object.entries(MODEL_PRICING)) {
                switch (pricing.kind) {
                    case 'token':
                        expect(pricing.inputPerMillion, model).toBeGreaterThanOrEqual(0);
                        expect(pricing.outputPerMillion, model).toBeGreaterThanOrEqual(0);
                        break;
                    case 'image':
                        expect(pricing.perImage, model).toBeGreaterThan(0);
                        break;
                    case 'video':
                        expect(pricing.perSecond, model).toBeGreaterThan(0);
                        break;
                    case 'tts':
                        expect(pricing.perMillionChars, model).toBeGreaterThan(0);
                        break;
                }
            }
        });
    });
});
