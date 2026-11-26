import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ call: vi.fn() }));
vi.mock('firebase/functions', () => ({
    getFunctions: () => ({}),
    httpsCallable: () => mocks.call,
}));
vi.mock('@/config/featureFlags', () => ({
    featureFlags: { isEnabled: () => true },
    FEATURE_FLAG_NAMES: { TYPESAFE_JUDGMENTS: 'enable_typesafe_judgments' },
}));

import {
    __resetJudgmentCooldownForTests,
    heuristicAdMatrixCutJudgment,
    judgeAdMatrixCut,
    type AdMatrixCutState,
} from './typesafeJudgments';

const OVERLONG_VERTICAL_CUT: AdMatrixCutState = {
    variantId: 'camp_9x16_15s',
    shape: '9:16',
    durationSeconds: 15,
    channelLabel: 'Reels / TikTok / YouTube Shorts',
    brandOrArtistName: 'indii.music',
    hookHeadline: 'Drop one master track today and watch our studio turn it into a beat-synced music video and four ad cuts',
    ctaText: 'Start your free mini-campaign right now at indii.music',
    safeWidthPx: 820,
    headlineFontSizePx: 66,
    ctaFontSizePx: 36,
    brandVibe: 'High-contrast underground studio minimalism',
};

const CRISP_SQUARE_CUT: AdMatrixCutState = {
    variantId: 'camp_1x1_15s',
    shape: '1:1',
    durationSeconds: 15,
    channelLabel: 'Instagram / X / Meta Square Feed',
    brandOrArtistName: 'indii.music',
    hookHeadline: '1 song. Full video + 4 ad cuts.',
    ctaText: 'Try indii free',
    safeWidthPx: 907,
    headlineFontSizePx: 56,
    ctaFontSizePx: 32,
};

describe('judgeAdMatrixCut (Jev System One)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        __resetJudgmentCooldownForTests();
    });

    it('deterministic baseline flags overlong 9:16 copy and preserves complete clauses without mid-sentence word chops', () => {
        const verdict = heuristicAdMatrixCutJudgment(OVERLONG_VERTICAL_CUT);
        expect(verdict.source).toBe('heuristic');
        expect(verdict.passesPreFlight).toBe(false);
        expect(verdict.safeZoneOverflowRisk).toBeGreaterThanOrEqual(0.45);
        expect(verdict.recommendedAction).toBe('tighten_headline');
        expect(verdict.suggestedPatch?.headlineOverride).toBeUndefined();
        expect(verdict.suggestedPatch?.fontScaleMultiplier).toBe(0.86);

        const multiClauseVerdict = heuristicAdMatrixCutJudgment({
            ...OVERLONG_VERTICAL_CUT,
            hookHeadline: 'Drop 1 song today. Turn it into a beat-synced music video and four social ad cuts.',
        });
        expect(multiClauseVerdict.suggestedPatch?.headlineOverride).toBe('Drop 1 song today.');
    });

    it('maps Jev Score/Noul/Choice responses onto 0-10 scores and suggested patches', async () => {
        mocks.call.mockResolvedValueOnce({
            data: {
                answers: {
                    hook_punch_score: { type: 'score', score: 3 },
                    mobile_copy_clarity_score: { type: 'score', score: 2 },
                    cta_conversion_score: { type: 'score', score: 3 },
                    safe_zone_overflow_risk: { type: 'noul', noul: 0.72 },
                    brand_voice_fit: { type: 'noul', noul: 0.91 },
                    recommended_refinement: { type: 'choice', choice: 'increase_safe_margin', confidence: 0.88 },
                },
            },
        });

        const verdict = await judgeAdMatrixCut(OVERLONG_VERTICAL_CUT);
        expect(verdict.source).toBe('jev');
        expect(verdict.hookPunchScore).toBe(7.5);
        expect(verdict.mobileCopyClarityScore).toBe(5);
        expect(verdict.ctaConversionScore).toBe(7.5);
        expect(verdict.passesPreFlight).toBe(false);
        expect(verdict.recommendedAction).toBe('increase_safe_margin');
        expect(verdict.suggestedPatch).toEqual({ extraSafeMarginPct: 0.05, fontScaleMultiplier: 0.92 });
    });

    it('approves pre-flight when Jev returns high scores, low overflow risk, and "none"', async () => {
        mocks.call.mockResolvedValueOnce({
            data: {
                answers: {
                    hook_punch_score: { type: 'score', score: 4 },
                    mobile_copy_clarity_score: { type: 'score', score: 4 },
                    cta_conversion_score: { type: 'score', score: 4 },
                    safe_zone_overflow_risk: { type: 'noul', noul: 0.08 },
                    brand_voice_fit: { type: 'noul', noul: 0.95 },
                    recommended_refinement: { type: 'choice', choice: 'none', confidence: 0.93 },
                },
            },
        });

        const verdict = await judgeAdMatrixCut(CRISP_SQUARE_CUT);
        expect(verdict.source).toBe('jev');
        expect(verdict.compositeScore).toBe(10);
        expect(verdict.passesPreFlight).toBe(true);
        expect(verdict.suggestedPatch).toBeUndefined();
    });

    it('falls back to deterministic baseline when typesafeJudge is unavailable', async () => {
        mocks.call.mockRejectedValueOnce(new Error('network unavailable'));
        const verdict = await judgeAdMatrixCut(CRISP_SQUARE_CUT);
        expect(verdict.source).toBe('heuristic');
        expect(verdict.passesPreFlight).toBe(true);
    });
});
