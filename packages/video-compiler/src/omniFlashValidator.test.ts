import { describe, expect, it, vi } from 'vitest';
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

    it('parses markdown-fenced JSON responses and defaults to gemini-omni-flash-preview', async () => {
        let requestedUrl = '';
        const mockFetch = vi.fn().mockImplementation(async (url: string) => {
            requestedUrl = url;
            return {
                ok: true,
                json: async () => ({
                    candidates: [
                        {
                            content: {
                                parts: [
                                    {
                                        text: '```json\n{\n  "score": 0.94,\n  "subjectMatch": true,\n  "lightingConsistency": true,\n  "recommendation": "accept",\n  "reasoning": "Consistent character geometry and lighting."\n}\n```'
                                    }
                                ]
                            }
                        }
                    ]
                })
            };
        });

        const originalFetch = global.fetch;
        global.fetch = mockFetch as unknown as typeof fetch;

        try {
            const result = await validateGeminiOmniFlashContinuity(
                { dataUriOrBase64: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=' },
                { dataUriOrBase64: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=' },
                { apiKey: 'test-api-key' }
            );

            expect(requestedUrl).toContain('models/gemini-omni-flash-preview:generateContent');
            expect(result.score).toBe(0.94);
            expect(result.subjectMatch).toBe(true);
            expect(result.lightingConsistency).toBe(true);
            expect(result.recommendation).toBe('accept');
            expect(result.reasoning).toBe('Consistent character geometry and lighting.');
        } finally {
            global.fetch = originalFetch;
        }
    });
});
