import { beforeEach, describe, expect, it, vi } from 'vitest';

import { runCreativeVisionCheck, toCreativeBrandKit } from './BrandVisionQC';
import { AutonomousIntelligence } from '@/services/intelligence/AutonomousIntelligence';
import { INTELLIGENCE_MODELS } from '@/core/config/intelligence-models';
import type { BrandKit } from '@/types/User';

vi.mock('@/services/intelligence/AutonomousIntelligence', () => ({
    AutonomousIntelligence: { generateStructuredData: vi.fn() },
}));

const generateStructuredData = vi.mocked(AutonomousIntelligence.generateStructuredData);

const BRAND_KIT = {
    primaryColors: ['#FF0055', '#111111'],
    forbiddenElements: ['stock photography', 'competitor logos'],
    vibe: 'Neon-lit late-night city',
};

const IMAGE = 'aGVsbG8td29ybGQ=';

beforeEach(() => {
    vi.clearAllMocks();
});

describe('runCreativeVisionCheck', () => {
    it('passes the image through as inline data alongside the brand constraints', async () => {
        generateStructuredData.mockResolvedValue({ approved: true, reason: 'Palette and mood match.' });

        const result = await runCreativeVisionCheck(IMAGE, BRAND_KIT);

        expect(result).toEqual({ approved: true, reason: 'Palette and mood match.' });

        const [parts, , , , model] = generateStructuredData.mock.calls[0];
        const typedParts = parts as Array<{ text?: string; inlineData?: { data: string; mimeType: string } }>;
        expect(typedParts[1].inlineData).toEqual({ data: IMAGE, mimeType: 'image/jpeg' });
        expect(typedParts[0].text).toContain('#FF0055');
        expect(typedParts[0].text).toContain('stock photography');
        expect(typedParts[0].text).toContain('Neon-lit late-night city');

        // Brand conformance is a complex-reasoning judgment, not a fast-tier task.
        expect(model).toBe(INTELLIGENCE_MODELS.TEXT.AGENT);
    });

    it('strips a data URL prefix before sending the bytes', async () => {
        generateStructuredData.mockResolvedValue({ approved: true, reason: 'ok' });

        await runCreativeVisionCheck(`data:image/png;base64,${IMAGE}`, BRAND_KIT, 'image/png');

        const parts = generateStructuredData.mock.calls[0][0] as Array<{ inlineData?: { data: string; mimeType: string } }>;
        expect(parts[1].inlineData).toEqual({ data: IMAGE, mimeType: 'image/png' });
    });

    it('relays a rejection with the model reason', async () => {
        generateStructuredData.mockResolvedValue({
            approved: false,
            reason: 'Uses a competitor logo in the lower third.',
        });

        await expect(runCreativeVisionCheck(IMAGE, BRAND_KIT)).resolves.toEqual({
            approved: false,
            reason: 'Uses a competitor logo in the lower third.',
        });
    });

    // ── Fail-closed behaviour ────────────────────────────────────────────────
    // Every unchecked creative is one the artist would pay to show. None of
    // these paths may return approved: true.

    it('rejects when the model call throws', async () => {
        generateStructuredData.mockRejectedValue(new Error('model unavailable'));

        const result = await runCreativeVisionCheck(IMAGE, BRAND_KIT);

        expect(result.approved).toBe(false);
        expect(result.reason).toContain('could not be completed');
    });

    it('rejects when the model returns a malformed verdict', async () => {
        generateStructuredData.mockResolvedValue({ reason: 'looks fine' } as never);

        const result = await runCreativeVisionCheck(IMAGE, BRAND_KIT);

        expect(result.approved).toBe(false);
    });

    it('rejects when the model returns nothing', async () => {
        generateStructuredData.mockResolvedValue(null as never);

        await expect(runCreativeVisionCheck(IMAGE, BRAND_KIT)).resolves.toMatchObject({ approved: false });
    });

    it('rejects an empty image without calling the model', async () => {
        const result = await runCreativeVisionCheck('', BRAND_KIT);

        expect(result.approved).toBe(false);
        expect(generateStructuredData).not.toHaveBeenCalled();
    });

    it('rejects rather than rubber-stamps when no brand constraints exist', async () => {
        const result = await runCreativeVisionCheck(IMAGE, {
            primaryColors: [], forbiddenElements: [], vibe: '   ',
        });

        expect(result.approved).toBe(false);
        expect(result.reason).toContain('Brand Kit');
        expect(generateStructuredData).not.toHaveBeenCalled();
    });
});

describe('toCreativeBrandKit', () => {
    it('splits the negative prompt into discrete forbidden elements', () => {
        const kit = toCreativeBrandKit({
            colors: ['#FF0055'],
            negativePrompt: 'blurry, stock photography\n competitor logos ,,',
            brandDescription: 'Independent electronic artist',
        } as BrandKit);

        expect(kit.forbiddenElements).toEqual(['blurry', 'stock photography', 'competitor logos']);
        expect(kit.primaryColors).toEqual(['#FF0055']);
    });

    it('builds the vibe from the most specific fields available', () => {
        const kit = toCreativeBrandKit({
            colors: [],
            negativePrompt: '',
            visualIdentity: 'Neon noir',
            aestheticStyle: 'Cyberpunk',
            digitalAura: ['Luxury'],
            brandDescription: 'Late-night club music',
        } as BrandKit);

        expect(kit.vibe).toBe('Neon noir — Cyberpunk — Luxury — Late-night club music');
    });

    it('falls back to an explicit marker when the kit says nothing about visuals', () => {
        const kit = toCreativeBrandKit({ colors: [], negativePrompt: '' } as unknown as BrandKit);

        expect(kit.vibe).toBe('No stated visual identity.');
        expect(kit.forbiddenElements).toEqual([]);
    });
});
