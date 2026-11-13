import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ call: vi.fn(), enabled: vi.fn() }));
vi.mock('firebase/functions', () => ({ getFunctions: () => ({}), httpsCallable: () => mocks.call }));
vi.mock('@/config/featureFlags', () => ({ featureFlags: { isEnabled: mocks.enabled }, FEATURE_FLAG_NAMES: { TYPESAFE_JUDGMENTS: 'enable_typesafe_judgments' } }));
import { judgeCreativePromptModeIntent, deterministicCreativePromptModeFallback, judgeGalleryAssetBrandFit, deterministicGalleryBrandFitFallback, judgePlpVariantAdFormat, deterministicPlpVariantAdFallback, __resetJudgmentCooldownForTests } from './typesafeJudgments';

// Structural provenance contracts, not asset inspection or calibration.
describe('ambient creative evidence', () => {
    const prompt = 'watercolor album artwork';
    const gallery = { promptUsed: prompt, brandVibe: 'documentary monochrome' };
    const plp = { prompt, slotIndex: 0 };
    beforeEach(() => { vi.clearAllMocks(); __resetJudgmentCooldownForTests(); mocks.enabled.mockReturnValue(true); });
    it('keeps deterministic results useful without assigning model confidence', () => {
        for (const result of [deterministicCreativePromptModeFallback(prompt, 'video'), deterministicGalleryBrandFitFallback(gallery), deterministicPlpVariantAdFallback(plp)]) {
            expect(result).toMatchObject({ source: 'heuristic', confidence: null });
        }
    });
    it.each([undefined, null, NaN, Infinity, -0.1, 1.1, '0.9', false, 0.2])('rejects adoption on malformed/low confidence: %s', async confidence => {
        mocks.call.mockResolvedValue({ data: { answers: {
            target_mode: { type: 'choice', choice: 'video', confidence },
            brand_fit: { type: 'score', score: 4, confidence },
            ad_format: { type: 'choice', choice: 'STORY_REEL', confidence },
        } } });
        expect(await judgeCreativePromptModeIntent(prompt, 'image')).toEqual(deterministicCreativePromptModeFallback(prompt, 'image'));
        expect(await judgeGalleryAssetBrandFit(gallery)).toEqual(deterministicGalleryBrandFitFallback(gallery));
        expect(await judgePlpVariantAdFormat(plp)).toEqual(deterministicPlpVariantAdFallback(plp));
    });
    it('does not treat cinematic styling or camera equipment as video instructions', () => {
        expect(deterministicCreativePromptModeFallback('cinematic album cover photographed on a film camera', 'image').suggestedMode).toBe('image');
        expect(deterministicCreativePromptModeFallback('cinematic camera pan across a stage', 'image').suggestedMode).toBe('video');
    });
    it('retains actual confidence for adopted typed provider answers', async () => {
        mocks.call.mockResolvedValue({ data: { answers: {
            target_mode: { type: 'choice', choice: 'video', confidence: 0.9 },
            brand_fit: { type: 'score', score: 4, confidence: 0.9 },
            ad_format: { type: 'choice', choice: 'STORY_REEL', confidence: 0.9 },
        } } });
        expect(await judgeCreativePromptModeIntent(prompt)).toMatchObject({ source: 'jev', confidence: 0.9, suggestedMode: 'video' });
        expect(await judgeGalleryAssetBrandFit(gallery)).toMatchObject({ source: 'jev', confidence: 0.9, score: 5 });
        expect(await judgePlpVariantAdFormat(plp)).toMatchObject({ source: 'jev', confidence: 0.9, formatTag: 'STORY_REEL' });
    });
    it('does not infer a rendered defect or a paid retry from artistic prompt words', () => {
        expect(deterministicPlpVariantAdFallback({ prompt: 'intentional glitch art with distorted typography', slotIndex: 0 }).retryRecommended).toBe(false);
    });
});
