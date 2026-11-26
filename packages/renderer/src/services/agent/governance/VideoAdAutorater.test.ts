import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGenerateStructuredData = vi.fn();
const mockRunCreativeVisionCheck = vi.fn();

vi.mock('@/services/intelligence/AutonomousIntelligence', () => ({
    AutonomousIntelligence: {
        generateStructuredData: (...args: unknown[]) => mockGenerateStructuredData(...args),
    },
}));

vi.mock('./BrandVisionQC', () => ({
    runCreativeVisionCheck: (...args: unknown[]) => mockRunCreativeVisionCheck(...args),
}));

import { VideoAdAutorater } from './VideoAdAutorater';

const BRAND_KIT = {
    primaryColors: ['#FFE135', '#0B0D12'],
    forbiddenElements: ['watermarks', 'clip-art'],
    vibe: 'High-contrast underground studio minimalism',
};

describe('VideoAdAutorater (Level 5 /10 Multimodal Ad Judge)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockRunCreativeVisionCheck.mockResolvedValue({
            approved: true,
            reason: 'Matches primary yellow/black palette and studio vibe.',
        });
    });

    it('approves immediately when overallScore >= 9.0 and BrandVisionQC passes', async () => {
        mockGenerateStructuredData.mockResolvedValueOnce({
            firstTwoSecondHook: 9.8,
            mobileLegibility: 9.6,
            safeZoneIntegrity: 9.7,
            audioVisualPacing: 9.5,
            brandAlignment: 9.6,
            overallScore: 9.7,
            overallPass: true,
            gapsFound: 'None',
        });

        const result = await VideoAdAutorater.evaluateWithAutoRedo({
            variantId: 'camp_9x16_15s',
            shape: '9:16',
            durationSeconds: 15,
            briefSummary: '15s Reels hook ad',
            keyframeBase64List: ['ZmFrZWZyYW1lMQ=='],
            brandKit: BRAND_KIT,
        });

        expect(result.approved).toBe(true);
        expect(result.attemptsUsed).toBe(0);
        expect(result.bestScore?.overallScore).toBe(9.7);
        expect(mockRunCreativeVisionCheck).toHaveBeenCalledTimes(1);
    });

    it('auto-redoes a cut scoring 8.8 and approves when refinement reaches 9.8', async () => {
        mockGenerateStructuredData
            .mockResolvedValueOnce({
                firstTwoSecondHook: 9.0,
                mobileLegibility: 8.2,
                safeZoneIntegrity: 8.5,
                audioVisualPacing: 9.0,
                brandAlignment: 9.2,
                overallScore: 8.8,
                overallPass: false,
                gapsFound: 'Headline slightly crowds right Reels icon rail.',
                refinementPatch: { extraSafeMarginPct: 0.05, fontScaleMultiplier: 0.9 },
            })
            .mockResolvedValueOnce({
                firstTwoSecondHook: 9.9,
                mobileLegibility: 9.8,
                safeZoneIntegrity: 9.8,
                audioVisualPacing: 9.7,
                brandAlignment: 9.8,
                overallScore: 9.8,
                overallPass: true,
                gapsFound: 'None',
            });

        const onRefine = vi.fn().mockResolvedValue(['cmVmaW5lZGZyYW1l']);
        const result = await VideoAdAutorater.evaluateWithAutoRedo(
            {
                variantId: 'camp_1x1_15s',
                shape: '1:1',
                durationSeconds: 15,
                briefSummary: 'Square feed cut',
                keyframeBase64List: ['aW5pdGlhbGZyYW1l'],
                brandKit: BRAND_KIT,
            },
            onRefine,
        );

        expect(result.approved).toBe(true);
        expect(result.attemptsUsed).toBe(1);
        expect(onRefine).toHaveBeenCalledWith({ extraSafeMarginPct: 0.05, fontScaleMultiplier: 0.9 }, 1);
        expect(result.bestScore?.overallScore).toBe(9.8);
    });

    it('discards cut when refinement regresses (e.g. 8.5 -> 7.8)', async () => {
        mockGenerateStructuredData
            .mockResolvedValueOnce({
                firstTwoSecondHook: 8.5,
                mobileLegibility: 8.5,
                safeZoneIntegrity: 8.5,
                audioVisualPacing: 8.5,
                brandAlignment: 8.5,
                overallScore: 8.5,
                overallPass: false,
                gapsFound: '30s pacing drags in middle third.',
            })
            .mockResolvedValueOnce({
                firstTwoSecondHook: 7.8,
                mobileLegibility: 7.8,
                safeZoneIntegrity: 7.8,
                audioVisualPacing: 7.8,
                brandAlignment: 7.8,
                overallScore: 7.8,
                overallPass: false,
                gapsFound: 'Tighter crop clipped subject framing.',
            });

        const onRefine = vi.fn().mockResolvedValue(['cmVncmVzc2VkZnJhbWU=']);
        const result = await VideoAdAutorater.evaluateWithAutoRedo(
            {
                variantId: 'camp_16x9_30s',
                shape: '16:9',
                durationSeconds: 30,
                briefSummary: '30s YouTube ad',
                keyframeBase64List: ['aW5pdGlhbDMwcw=='],
                brandKit: BRAND_KIT,
            },
            onRefine,
        );

        expect(result.approved).toBe(false);
        expect(result.discardedForRegression).toBe(true);
        expect(result.attemptsUsed).toBe(1);
    });

    it('holds back a high-scoring cut if BrandVisionQC rejects it', async () => {
        mockGenerateStructuredData.mockResolvedValueOnce({
            firstTwoSecondHook: 9.5,
            mobileLegibility: 9.5,
            safeZoneIntegrity: 9.5,
            audioVisualPacing: 9.5,
            brandAlignment: 9.5,
            overallScore: 9.5,
            overallPass: true,
            gapsFound: 'None',
        });
        mockRunCreativeVisionCheck.mockResolvedValueOnce({
            approved: false,
            reason: 'Contains forbidden neon pink hue not in Brand Kit.',
        });

        const result = await VideoAdAutorater.evaluateWithAutoRedo({
            variantId: 'camp_4x5_15s',
            shape: '4:5',
            durationSeconds: 15,
            briefSummary: 'Meta vertical feed ad',
            keyframeBase64List: ['ZmFrZWZyYW1l'],
            brandKit: BRAND_KIT,
        });

        expect(result.approved).toBe(false);
        expect(result.brandQc?.approved).toBe(false);
    });
});
