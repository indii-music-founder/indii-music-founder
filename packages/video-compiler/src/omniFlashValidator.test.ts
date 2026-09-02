import { describe, expect, it } from 'vitest';
import {
    evaluateFrameContinuity,
    planBoundaryPreservingEdit,
    validateGeminiOmniFlashContinuity
} from './omniFlashValidator.js';

describe('OmniFlashValidator & Editor', () => {
    it('accepts matching frame metadata with high continuity score', () => {
        const result = evaluateFrameContinuity(
            { width: 1920, height: 1080, averageLuma: 0.5 },
            { width: 1920, height: 1080, averageLuma: 0.52 }
        );

        expect(result.score).toBeGreaterThanOrEqual(0.85);
        expect(result.recommendation).toBe('accept');
        expect(result.subjectMatch).toBe(true);
        expect(result.lightingConsistency).toBe(true);
    });

    it('penalizes resolution and excessive luminance discontinuity', () => {
        const result = evaluateFrameContinuity(
            { width: 1920, height: 1080, averageLuma: 0.9 },
            { width: 1080, height: 1920, averageLuma: 0.1 }
        );

        expect(result.score).toBeLessThan(0.6);
        expect(result.recommendation).toBe('regenerate');
        expect(result.reasoning).toContain('Resolution mismatch');
        expect(result.reasoning).toContain('Excessive luminance jump');
    });

    it('locks boundary margins when planning conversational edits to protect crossfades', () => {
        const plan = planBoundaryPreservingEdit(10.0, {
            segmentIndex: 1,
            instruction: 'Make the atmosphere darker and moodier',
            lockBoundaryMarginSeconds: 0.75,
            styleDirectives: { lighting: 'moody' }
        });

        expect(plan.lockedStartSeconds).toBe(0.75);
        expect(plan.lockedEndSeconds).toBe(9.25);
        expect(plan.activeEditSeconds).toBe(8.5);
        expect(plan.filterString).toContain("between(t,0.75,9.25)");
        expect(plan.explanation).toContain("seam margins [0-0.75s] and [9.25s-10.00s] locked");
    });

    it('executes validateGeminiOmniFlashContinuity with structural fallback', async () => {
        const result = await validateGeminiOmniFlashContinuity(
            { dataUriOrBase64: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=' },
            { dataUriOrBase64: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=' }
        );

        expect(result.score).toBeGreaterThanOrEqual(0.85);
        expect(result.recommendation).toBe('accept');
    });
});
