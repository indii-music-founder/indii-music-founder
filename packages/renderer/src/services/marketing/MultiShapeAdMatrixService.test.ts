import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockEvaluateWithAutoRedo = vi.fn();
const mockJudgeAdMatrixCut = vi.fn();

vi.mock('@/config/typesafeJudgments', () => ({
    judgeAdMatrixCut: (...args: unknown[]) => mockJudgeAdMatrixCut(...args),
}));

vi.mock('@/services/agent/governance/VideoAdAutorater', () => ({
    VideoAdAutorater: {
        evaluateWithAutoRedo: (...args: unknown[]) => mockEvaluateWithAutoRedo(...args),
    },
}));

import { MultiShapeAdMatrixService } from './MultiShapeAdMatrixService';

describe('MultiShapeAdMatrixService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockJudgeAdMatrixCut.mockResolvedValue({
            hookPunchScore: 9.0,
            mobileCopyClarityScore: 9.0,
            ctaConversionScore: 9.0,
            compositeScore: 9.0,
            safeZoneOverflowRisk: 0.1,
            brandVoiceFit: 0.9,
            recommendedAction: 'none',
            passesPreFlight: true,
            source: 'jev',
            rationale: 'Jev System One passed cut.',
        });
    });

    it('runs Jev pre-flight improvement on weak cuts before multimodal scoring', async () => {
        mockJudgeAdMatrixCut
            .mockResolvedValueOnce({
                hookPunchScore: 7.0,
                mobileCopyClarityScore: 6.5,
                ctaConversionScore: 7.5,
                compositeScore: 7.0,
                safeZoneOverflowRisk: 0.7,
                brandVoiceFit: 0.85,
                recommendedAction: 'increase_safe_margin',
                suggestedPatch: { extraSafeMarginPct: 0.05, fontScaleMultiplier: 0.92 },
                passesPreFlight: false,
                source: 'jev',
                rationale: 'Needs margin.',
            })
            .mockResolvedValueOnce({
                hookPunchScore: 9.2,
                mobileCopyClarityScore: 9.1,
                ctaConversionScore: 9.0,
                compositeScore: 9.1,
                safeZoneOverflowRisk: 0.12,
                brandVoiceFit: 0.9,
                recommendedAction: 'none',
                passesPreFlight: true,
                source: 'jev',
                rationale: 'Improved.',
            });

        const report = await MultiShapeAdMatrixService.generateAndScoreMatrix({
            campaignId: 'camp_jev_improve',
            title: 'Neon Highway',
            brandOrArtistName: 'Nova',
            hookHeadline: 'Out midnight everywhere',
            ctaText: 'Stream now',
            verticalFootageUrl: 'https://storage.googleapis.com/b/v.mp4',
            shapes: ['9:16'],
            durations: [15],
        });

        expect(report.totalVariants).toBe(1);
        expect(report.jevImprovedCount).toBe(1);
        expect(report.heldBackVariants[0]?.jevImproved).toBe(true);
        expect(report.heldBackVariants[0]?.jevVerdict.compositeScore).toBe(9.1);
    });

    it('fans out all 4 shapes in parallel and separates >= 9.0 approved cuts from held-back cuts', async () => {
        mockEvaluateWithAutoRedo.mockImplementation(async (input: { variantId: string; shape: string; durationSeconds: number }) => ({
            variantId: input.variantId,
            shape: input.shape,
            durationSeconds: input.durationSeconds,
            approved: input.shape !== '16:9',
            discardedForRegression: input.shape === '16:9',
            attemptsUsed: input.shape === '1:1' ? 1 : 0,
            bestScore: {
                firstTwoSecondHook: 9.5,
                mobileLegibility: 9.5,
                safeZoneIntegrity: 9.5,
                audioVisualPacing: 9.5,
                brandAlignment: 9.5,
                overallScore: input.shape === '16:9' ? 8.2 : 9.6,
                overallPass: input.shape !== '16:9',
                gapsFound: input.shape === '16:9' ? 'Regressed on retry' : 'None',
            },
            brandQc: { approved: true, reason: 'On brand' },
            appliedPatches: [],
            history: [],
        }));

        const report = await MultiShapeAdMatrixService.generateAndScoreMatrix(
            {
                campaignId: 'camp_matrix_1',
                title: 'Neon Highway',
                brandOrArtistName: 'Nova',
                hookHeadline: 'Out midnight everywhere',
                ctaText: 'Stream now',
                verticalFootageUrl: 'https://storage.googleapis.com/b/v.mp4',
                landscapeFootageUrl: 'https://storage.googleapis.com/b/l.mp4',
                audioHookUrl: 'https://storage.googleapis.com/b/hook.wav',
            },
            {
                previewExtractor: {
                    extractKeyframes: async () => ['a2V5ZnJhbWU='],
                },
            },
        );

        expect(report.totalVariants).toBe(4);
        expect(report.approvedVariants).toHaveLength(3);
        expect(report.heldBackVariants).toHaveLength(1);
        expect(report.heldBackVariants[0]?.variant.shape).toBe('16:9');
    });

    it('fails closed (holds back all cuts) when no rendered keyframes are supplied for inspection', async () => {
        const report = await MultiShapeAdMatrixService.generateAndScoreMatrix({
            campaignId: 'camp_uninspected',
            title: 'Draft',
            brandOrArtistName: 'Nova',
            hookHeadline: 'Hook',
            ctaText: 'Listen',
            verticalFootageUrl: 'https://storage.googleapis.com/b/v.mp4',
        });

        expect(report.totalVariants).toBe(4);
        expect(report.approvedVariants).toHaveLength(0);
        expect(report.heldBackVariants).toHaveLength(4);
    });
});
