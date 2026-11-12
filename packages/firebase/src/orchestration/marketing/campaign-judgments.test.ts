import { describe, expect, it } from 'vitest';
import { parseCampaignAllocationAnswers, type CampaignAllocationJudgment } from './campaign-judgments';
import type { UnifiedCampaignDirective } from '../../types/ad-execution.types';

// Literal parser inputs only: no provider, account, ledger, or campaign execution.
const directive: Pick<UnifiedCampaignDirective, 'platforms' | 'budgetAllocation'> = {
    platforms: ['META', 'TIKTOK'],
    budgetAllocation: {
        currency: 'USD', totalBudgetCents: 10000, dailyBudgetCents: 1000,
        platformSplitPercentages: { META: 60, TIKTOK: 40 },
    },
};
const baseline: CampaignAllocationJudgment = {
    dominantPlatform: 'META', refinedSplitPercentages: { META: 60, TIKTOK: 40 },
    creativeFitScore: 4, creativeReadinessConfirmed: true, source: 'heuristic',
};
const answers = () => ({
    dominant_platform: { choice: 'TIKTOK', confidence: 0.9 },
    creative_fit_score: { score: 3.781 },
    creative_readiness_confirmed: { noul: 0.9 },
});

describe('campaign answer contract', () => {
    it.each([undefined, null, true, '0.9', NaN, Infinity, -0.1, 1.1])('retains baseline on invalid confidence %s', confidence => {
        const raw = { ...answers(), dominant_platform: { choice: 'TIKTOK', confidence } };
        expect(parseCampaignAllocationAnswers(raw, directive, baseline)).toBe(baseline);
    });
    it.each([undefined, null, true, '0.9', NaN, Infinity, -0.1, 1.1])('retains baseline on invalid readiness %s', noul => {
        const raw = { ...answers(), creative_readiness_confirmed: { noul } };
        expect(parseCampaignAllocationAnswers(raw, directive, baseline)).toBe(baseline);
    });
    it.each([undefined, null, true, '4', NaN, Infinity, -0.1, 4.1])('retains baseline on invalid fit score %s', score => {
        const raw = { ...answers(), creative_fit_score: { score } };
        expect(parseCampaignAllocationAnswers(raw, directive, baseline)).toBe(baseline);
    });
    it.each(['UNKNOWN', 'GOOGLE_ADS'])('cannot tilt toward an undeclared or unrequested platform %s', choice => {
        const raw = { ...answers(), dominant_platform: { choice, confidence: 1 } };
        expect(parseCampaignAllocationAnswers(raw, directive, baseline)).toBe(baseline);
    });
    it('preserves fractional fit evidence without premature rounding', () => {
        const parsed = parseCampaignAllocationAnswers(answers(), directive, baseline, 'request');
        expect(parsed.creativeFitScore).toBeCloseTo(4.781, 8);
        expect(parsed.refinedSplitPercentages).toEqual({ META: 50, TIKTOK: 50 });
        expect(parsed).toMatchObject({ source: 'jev', confidence: 0.9, requestId: 'request' });
    });
    it.each([0, 0.599])('does not refine at low platform confidence %s, while retaining valid readiness rejection', confidence => {
        const raw = { ...answers(), dominant_platform: { choice: 'TIKTOK', confidence }, creative_readiness_confirmed: { noul: 0 } };
        const parsed = parseCampaignAllocationAnswers(raw, directive, baseline);
        expect(parsed.refinedSplitPercentages).toEqual(baseline.refinedSplitPercentages);
        expect(parsed.dominantPlatform).toBe('META');
        expect(parsed.creativeReadinessConfirmed).toBe(false);
    });
    it.each([0, 4])('accepts valid fit endpoint %s', score => {
        const raw = { ...answers(), creative_fit_score: { score } };
        expect(parseCampaignAllocationAnswers(raw, directive, baseline).creativeFitScore).toBe(score + 1);
    });
    it('retains a valid readiness veto when allocation evidence is malformed', () => {
        const parsed = parseCampaignAllocationAnswers({
            dominant_platform: { choice: 'UNKNOWN', confidence: 10 },
            creative_fit_score: { score: null },
            creative_readiness_confirmed: { noul: 0.2 },
        }, directive, baseline);
        expect(parsed.creativeReadinessConfirmed).toBe(false);
        expect(parsed.refinedSplitPercentages).toEqual(baseline.refinedSplitPercentages);
        expect(parsed.confidence).toBeUndefined();
    });
});
