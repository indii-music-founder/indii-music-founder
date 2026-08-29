import { describe, it, expect, vi, beforeEach } from 'vitest';

const generateImages = vi.fn();

vi.mock('@/services/image/ImageGenerationService', () => ({
    ImageGeneration: { generateImages: (...a: unknown[]) => generateImages(...a) }
}));

import {
    generateMockup,
    MOCKUP_PROMPTS,
    MOCKUP_ASPECTS,
    ARTWORK_FIDELITY_CLAUSE,
    type MockupKind
} from '../MockupService';

const KINDS: MockupKind[] = ['vinyl-12', 'cd-jewel', 'cassette', 'tee', 'hoodie', 'poster', 'story-card'];

describe('MOCKUP_PROMPTS templates (F1.1)', () => {
    it('defines all seven kinds', () => {
        expect(Object.keys(MOCKUP_PROMPTS).sort()).toEqual([...KINDS].sort());
    });

    it('every template contains the artwork-fidelity clause verbatim', () => {
        for (const kind of KINDS) {
            expect(MOCKUP_PROMPTS[kind], kind).toContain(ARTWORK_FIDELITY_CLAUSE);
        }
    });

    it('every template carries kind-specific staging (not just generic text)', () => {
        expect(MOCKUP_PROMPTS['vinyl-12']).toMatch(/sleeve/i);
        expect(MOCKUP_PROMPTS['vinyl-12']).toMatch(/disc/i);
        expect(MOCKUP_PROMPTS['tee']).toMatch(/shirt|chest/i);
        expect(MOCKUP_PROMPTS['hoodie']).toMatch(/hood/i);
        expect(MOCKUP_PROMPTS['poster']).toMatch(/poster|wall/i);
        expect(MOCKUP_PROMPTS['cd-jewel']).toMatch(/jewel case/i);
        expect(MOCKUP_PROMPTS['cassette']).toMatch(/cassette/i);
        expect(MOCKUP_PROMPTS['story-card']).toMatch(/story/i);
    });

    it('aspect map is correct per kind', () => {
        expect(MOCKUP_ASPECTS['vinyl-12']).toBe('1:1');
        expect(MOCKUP_ASPECTS['cd-jewel']).toBe('1:1');
        expect(MOCKUP_ASPECTS['cassette']).toBe('1:1');
        expect(MOCKUP_ASPECTS['tee']).toBe('4:5');
        expect(MOCKUP_ASPECTS['hoodie']).toBe('4:5');
        expect(MOCKUP_ASPECTS['poster']).toBe('2:3');
        expect(MOCKUP_ASPECTS['story-card']).toBe('9:16');
    });
});

describe('generateMockup (F1.2 — generation mocked)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        generateImages.mockResolvedValue([{ id: 'img1', url: 'https://cdn.test/mockup.png' }]);
    });

    it('passes the artwork as a sourceImages reference plus the assembled template', async () => {
        const res = await generateMockup({
            artworkUrl: 'data:image/png;base64,QUJD',
            kind: 'vinyl-12',
            scene: 'lifestyle'
        });

        expect(res.kind).toBe('vinyl-12');
        expect(res.url).toBe('https://cdn.test/mockup.png');

        const call = generateImages.mock.calls[0]![0] as { prompt: string; sourceImages: unknown[]; model: string; aspectRatio: string };
        expect(call.sourceImages).toEqual([{ mimeType: 'image/png', data: 'QUJD' }]);
        expect(call.prompt).toContain(ARTWORK_FIDELITY_CLAUSE);
        expect(call.prompt).toContain('natural lifestyle context'); // scene swapped in
        expect(call.aspectRatio).toBe('1:1');
        // Ground Rule 6: model via APPROVED_MODELS constant, not a literal.
        expect(call.model).toBe('gemini-3-pro-image');
        expect(res.promptUsed).toContain('1:1');
    });

    it('honors an explicit aspectRatio override and colorway', async () => {
        const res = await generateMockup({
            artworkUrl: 'data:image/png;base64,QUJD',
            kind: 'poster',
            aspectRatio: '3:4',
            colorway: 'natural cream shirt'
        });

        const call = generateImages.mock.calls[0]![0] as { prompt: string; aspectRatio: string };
        expect(call.aspectRatio).toBe('3:4');
        expect(call.prompt).toContain('natural cream shirt');
        expect(res.promptUsed).toContain('3:4');
    });

    it('fails closed when artwork is missing', async () => {
        await expect(generateMockup({ artworkUrl: '', kind: 'tee' })).rejects.toThrow(/artworkUrl is required/);
        expect(generateImages).not.toHaveBeenCalled();
    });

    it('fails closed on an unknown kind', async () => {
        await expect(generateMockup({ artworkUrl: 'data:image/png;base64,QUJD', kind: 'flag' as never }))
            .rejects.toThrow(/unknown mockup kind/);
        expect(generateImages).not.toHaveBeenCalled();
    });

    it('throws a specific error when generation returns nothing', async () => {
        generateImages.mockResolvedValue([]);
        await expect(generateMockup({ artworkUrl: 'data:image/png;base64,QUJD', kind: 'tee' }))
            .rejects.toThrow(/returned no result/);
    });
});
