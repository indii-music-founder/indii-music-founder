import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ call: vi.fn(), enabled: vi.fn() }));
vi.mock('firebase/functions', () => ({ getFunctions: () => ({}), httpsCallable: () => mocks.call }));
vi.mock('@/config/featureFlags', () => ({ featureFlags: { isEnabled: mocks.enabled }, FEATURE_FLAG_NAMES: { TYPESAFE_JUDGMENTS: 'enable_typesafe_judgments' } }));
import { judgeCreativePromptAdditiveSuggestions, rankAdditivesDeterministically, __resetJudgmentCooldownForTests } from './typesafeJudgments';

// Structural shortlist/permutation contracts; not semantic relevance or live UI acceptance.
describe('prompt additive ranking contract', () => {
    const candidates = Array.from({ length: 12 }, (_, index) => ({ tag: `Option ${index}`, count: 20 - index }));
    beforeEach(() => {
        vi.clearAllMocks(); __resetJudgmentCooldownForTests(); mocks.enabled.mockReturnValue(true);
        mocks.call.mockResolvedValue({ data: { answers: { bestFit: { type: 'choice', choice: 'cand_1', confidence: 0.9 } } } });
    });
    it('promotes one candidate without losing the unjudged tail or changing input order', async () => {
        const input = Object.freeze([...candidates]);
        const result = await judgeCreativePromptAdditiveSuggestions('album artwork', input);
        expect(result).toHaveLength(12);
        expect(result[0]).toBe(input[1]);
        expect(result.slice(1)).toEqual([input[0], ...input.slice(2)]);
        expect(input.map(item => item.tag)).toEqual(candidates.map(item => item.tag));
        expect(mocks.call.mock.calls[0]?.[0].state.candidates).toHaveLength(8);
    });
    it('binds offered IDs to the deterministic shortlist, not raw input positions', async () => {
        const input = [candidates[8]!, candidates[0]!, candidates[3]!];
        const result = await judgeCreativePromptAdditiveSuggestions('artwork', input);
        expect(mocks.call.mock.calls[0]?.[0].state.candidates).toEqual([candidates[0]!.tag, candidates[3]!.tag, candidates[8]!.tag]);
        expect(result).toEqual([candidates[3], candidates[0], candidates[8]]);
    });
    it.each(['cand_1junk', 'cand_01', 'cand_+1', 'cand_1.0', 'cand_-1', 'cand_8', 'none', '__proto__'])('does not adopt an undeclared ID: %s', async choice => {
        mocks.call.mockResolvedValue({ data: { answers: { bestFit: { type: 'choice', choice, confidence: 0.99 } } } });
        expect(await judgeCreativePromptAdditiveSuggestions('artwork', candidates)).toEqual(rankAdditivesDeterministically('artwork', candidates));
    });
    it.each([undefined, null, NaN, Infinity, -0.1, 1.1, '0.9', 0.2])('keeps the complete baseline on invalid/low confidence: %s', async confidence => {
        mocks.call.mockResolvedValue({ data: { answers: { bestFit: { type: 'choice', choice: 'cand_1', confidence } } } });
        expect(await judgeCreativePromptAdditiveSuggestions('artwork', candidates)).toEqual(rankAdditivesDeterministically('artwork', candidates));
    });
    it('rejects a confident non-Choice answer and retains repeated candidate entries', async () => {
        mocks.call.mockResolvedValueOnce({ data: { answers: { bestFit: { type: 'score', choice: 'cand_1', confidence: 0.99 } } } });
        expect(await judgeCreativePromptAdditiveSuggestions('artwork', candidates)).toEqual(candidates);
        const input = [candidates[0]!, candidates[0]!, candidates[2]!];
        const adopted = await judgeCreativePromptAdditiveSuggestions('artwork', input);
        expect(adopted).toHaveLength(3);
        expect(adopted.filter(item => item === candidates[0])).toHaveLength(2);
    });
    it('retains all candidates when disabled or when the provider fails', async () => {
        mocks.enabled.mockReturnValue(false);
        expect(await judgeCreativePromptAdditiveSuggestions('artwork', candidates)).toEqual(candidates);
        expect(mocks.call).not.toHaveBeenCalled();
        mocks.enabled.mockReturnValue(true);
        mocks.call.mockRejectedValueOnce(new Error('unavailable'));
        expect(await judgeCreativePromptAdditiveSuggestions('artwork', candidates)).toEqual(candidates);
    });
});
