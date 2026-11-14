import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ call: vi.fn(), enabled: vi.fn(() => true) }));
vi.mock('firebase/functions', () => ({ getFunctions: () => ({}), httpsCallable: () => mocks.call }));
vi.mock('@/config/featureFlags', () => ({ featureFlags: { isEnabled: mocks.enabled }, FEATURE_FLAG_NAMES: { TYPESAFE_JUDGMENTS: 'enable_typesafe_judgments' } }));
import { judgeCreativeStudioConfigPreset, deterministicCreativeStudioConfigFallback, judgePromptImprovementIntent, deterministicPromptImprovementFallback, __resetJudgmentCooldownForTests } from './typesafeJudgments';

// Structural evidence contracts, not model calibration or genuine generation acceptance.
describe('creative judgment provenance', () => {
    beforeEach(() => { vi.clearAllMocks(); mocks.enabled.mockReturnValue(true); __resetJudgmentCooldownForTests(); });
    const context = { mode: 'image' as const, prompt: 'cinematic album artwork' };
    it('does not assign model confidence to deterministic suggestions', () => {
        expect(deterministicCreativeStudioConfigFallback(context)).toMatchObject({ source: 'heuristic', confidence: null });
        expect(deterministicPromptImprovementFallback(context.prompt)).toMatchObject({ source: 'heuristic', confidence: null });
    });
    it.each([undefined, null, NaN, Infinity, -0.1, 1.1, '0.9', false, 0.2])('preserves deterministic suggestions on invalid/low confidence: %s', async confidence => {
        mocks.call.mockResolvedValue({ data: { answers: {
            preset: { type: 'choice', choice: 'social_vertical_story', confidence },
            archetype: { type: 'choice', choice: 'graphic_cover_typography', confidence },
        } } });
        expect(await judgeCreativeStudioConfigPreset(context)).toEqual(deterministicCreativeStudioConfigFallback(context));
        expect(await judgePromptImprovementIntent(context.prompt)).toEqual(deterministicPromptImprovementFallback(context.prompt));
    });
    it.each(['constructor', 'toString', '__proto__'])('rejects inherited preset keys: %s', async choice => {
        mocks.call.mockResolvedValue({ data: { answers: { preset: { type: 'choice', choice, confidence: 0.99 } } } });
        expect(await judgeCreativeStudioConfigPreset(context)).toEqual(deterministicCreativeStudioConfigFallback(context));
    });
    it('records actual Jev provenance and keeps technical direction aligned with the adopted archetype', async () => {
        mocks.call.mockResolvedValue({ data: { answers: {
            preset: { type: 'choice', choice: 'social_vertical_story', confidence: 0.95 },
            archetype: { type: 'choice', choice: 'graphic_cover_typography', confidence: 0.94 },
        } } });
        expect(await judgeCreativeStudioConfigPreset(context)).toMatchObject({ source: 'jev', confidence: 0.95, presetId: 'social_vertical_story' });
        const intent = await judgePromptImprovementIntent('cinematic singer portrait');
        expect(intent).toMatchObject({ source: 'jev', confidence: 0.94, archetype: 'graphic_cover_typography' });
        expect(intent.focusTechnical).toContain('typographic hierarchy');
        expect(intent.focusTechnical).not.toContain('anamorphic lens');
    });
});
