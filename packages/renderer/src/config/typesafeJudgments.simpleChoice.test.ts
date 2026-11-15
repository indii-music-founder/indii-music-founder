import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ call: vi.fn() }));
vi.mock('firebase/functions', () => ({ getFunctions: () => ({}), httpsCallable: () => mocks.call }));
vi.mock('@/config/featureFlags', () => ({ featureFlags: { isEnabled: () => true }, FEATURE_FLAG_NAMES: { TYPESAFE_JUDGMENTS: 'enable_typesafe_judgments' } }));
import {
    judgeSkillIntent,
    judgePreviewErrorGuidance,
    judgeUpscaleModel,
    judgeBoardroomIntent,
    judgeCreativeJourneyIntent,
    judgeCatalogCollisionRisk,
    invokeTypesafeJudge,
    __resetJudgmentCooldownForTests,
} from './typesafeJudgments';
import { ExecutionTokenBudget } from '@/services/agent/governance/ExecutionTokenBudget';

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

describe('invokeTypesafeJudge & answer shape hardening', () => {
    beforeEach(() => { vi.clearAllMocks(); __resetJudgmentCooldownForTests(); });

    it('returns null without throwing when result.data or answers is missing', async () => {
        mocks.call.mockResolvedValue({});
        expect(await invokeTypesafeJudge({ state: {}, questions: {} })).toBeNull();
        expect(await judgeBoardroomIntent('check split', '')).toBeNull();
    });

    it('skips the remote judge call when SemanticCallAdmission budget is exhausted', async () => {
        const budget = new ExecutionTokenBudget(10);
        budget.reserve(10);
        const result = await judgeSkillIntent(
            'release',
            [{ id: 'distribution', name: 'Distribution', description: 'Release music' }],
            { budget, checkpoint: async () => {} },
        );
        expect(result).toBeNull();
        expect(mocks.call).not.toHaveBeenCalled();
    });

    it('rejects wrong types and zero confidence in whitelistedChoice', async () => {
        mocks.call.mockResolvedValueOnce({ data: { answers: { intent: { type: 'score', choice: 'music_video', confidence: 0.9 } } } });
        expect((await judgeCreativeJourneyIntent({ prompt: 'make cover art' })).intent).toBe('album_artwork');

        mocks.call.mockResolvedValueOnce({ data: { answers: { intent: { choice: 'music_video', confidence: 0 } } } });
        expect((await judgeCreativeJourneyIntent({ prompt: 'make cover art' })).intent).toBe('album_artwork');
    });

    it('rejects wrong types in oneIndexedScore', async () => {
        mocks.call.mockResolvedValueOnce({
            data: {
                answers: {
                    disposition: { type: 'choice', choice: 'DELUXE_EDITION', confidence: 0.95 },
                    confidence: { type: 'choice', score: 0 },
                },
            },
        });
        const res = await judgeCatalogCollisionRisk({
            incomingTitle: 'Lunar Eclipse (Deluxe)',
            incomingIsrc: 'USABC2600077',
            existingCatalog: [{ id: 'trk_1', title: 'Lunar Eclipse', isrc: 'USABC2600001' }],
        });
        expect(res.collisionConfidence).toBe(5);
    });
});
