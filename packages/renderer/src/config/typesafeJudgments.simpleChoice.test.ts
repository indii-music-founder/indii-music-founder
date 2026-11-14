import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ call: vi.fn() }));
vi.mock('firebase/functions', () => ({ getFunctions: () => ({}), httpsCallable: () => mocks.call }));
vi.mock('@/config/featureFlags', () => ({ featureFlags: { isEnabled: () => true }, FEATURE_FLAG_NAMES: { TYPESAFE_JUDGMENTS: 'enable_typesafe_judgments' } }));
import { judgeSkillIntent, judgePreviewErrorGuidance, judgeUpscaleModel, __resetJudgmentCooldownForTests } from './typesafeJudgments';

// Boundary/abstention checks, not semantic accuracy or production acceptance.
describe.each([
    { name: 'skill routing', key: 'skill', choice: 'distribution', run: () => judgeSkillIntent('release', [{ id: 'distribution', name: 'Distribution', description: 'Release music' }]) },
    { name: 'preview guidance', key: 'guidance', choice: 'fix_media', run: () => judgePreviewErrorGuidance('missing media') },
    { name: 'upscale model', key: 'model', choice: 'realesrgan-x4plus-anime', run: () => judgeUpscaleModel('drawn illustration') },
])('$name uncertainty contract', ({ key, choice, run }) => {
    beforeEach(() => { vi.clearAllMocks(); __resetJudgmentCooldownForTests(); });
    it.each([undefined, null, NaN, Infinity, -Infinity, -0.1, 1.01, '0.9', false, 0.64])('abstains on invalid or low confidence: %s', async confidence => {
        mocks.call.mockResolvedValue({ data: { answers: { [key]: { type: 'choice', choice, confidence } } } });
        expect(await run()).toBeNull();
    });
    it.each([0.65, 0.9, 1])('retains a declared Choice at accepted confidence: %s', async confidence => {
        mocks.call.mockResolvedValue({ data: { answers: { [key]: { type: 'choice', choice, confidence } } } });
        expect(await run()).toBe(choice);
    });
    it.each(['bare', 'wrong-type', 'array', 'unknown'])('abstains on an invalid answer shape: %s', async shape => {
        const answer = shape === 'bare' ? choice : shape === 'array' ? [choice] : { type: shape === 'wrong-type' ? 'score' : 'choice', choice: shape === 'unknown' ? 'not-declared' : choice, confidence: 0.99 };
        mocks.call.mockResolvedValue({ data: { answers: { [key]: answer } } });
        expect(await run()).toBeNull();
    });
});
