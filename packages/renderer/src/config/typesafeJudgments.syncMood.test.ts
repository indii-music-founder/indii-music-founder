import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ call: vi.fn() }));
vi.mock('firebase/functions', () => ({ getFunctions: () => ({}), httpsCallable: () => mocks.call }));
vi.mock('@/config/featureFlags', () => ({ featureFlags: { isEnabled: () => true }, FEATURE_FLAG_NAMES: { TYPESAFE_JUDGMENTS: 'enable_typesafe_judgments' } }));
import { judgeSyncMoods, SYNC_MOOD_MAX_TAGS, __resetJudgmentCooldownForTests } from '@/config/typesafeJudgments';
import { SyncMetadataTaggingService } from '@/services/licensing/SyncMetadataTaggingService';

const answer = (applies: unknown, choice: unknown) => ({
    applies_0: { type: 'noul', noul: applies },
    mood_0: { type: 'choice', choice, confidence: 0.9 },
});

// Decision-table contract with a mocked callable; structural, not semantic accuracy.
describe('judgeSyncMoods', () => {
    beforeEach(() => { vi.clearAllMocks(); __resetJudgmentCooldownForTests(); });

    it('takes the Choice when a mood clearly applies', async () => {
        mocks.call.mockResolvedValue({ data: { answers: answer(0.9, 'Upbeat') } });
        expect(await judgeSyncMoods(['happy'])).toEqual([['Upbeat']]);
    });

    it('writes no mood when no standard mood applies', async () => {
        mocks.call.mockResolvedValue({ data: { answers: answer(0.1, 'Melancholic') } });
        expect(await judgeSyncMoods(['experimental noise'])).toEqual([[]]);
    });

    it.each([0.5, 0.31, 0.69])('defers to the baseline when unsettled (%s)', async p => {
        mocks.call.mockResolvedValue({ data: { answers: answer(p, 'Dark') } });
        expect(await judgeSyncMoods(['dark-pop'])).toEqual([null]);
    });

    it.each([undefined, '0.9', NaN])('defers on an invalid Noul (%s)', async p => {
        mocks.call.mockResolvedValue({ data: { answers: answer(p, 'Chill') } });
        expect(await judgeSyncMoods(['chill'])).toEqual([null]);
    });

    it('defers when the Choice is not a declared mood', async () => {
        mocks.call.mockResolvedValue({ data: { answers: answer(0.95, 'Spooky') } });
        expect(await judgeSyncMoods(['spooky'])).toEqual([null]);
    });

    it('defers every tag when the callable fails, and treats it as an error not a "no"', async () => {
        mocks.call.mockRejectedValue(new Error('unavailable'));
        expect(await judgeSyncMoods(['happy', 'sad'])).toEqual([null, null]);
    });

    it(`judges at most ${SYNC_MOOD_MAX_TAGS} tags per request and defers the rest`, async () => {
        mocks.call.mockResolvedValue({ data: { answers: {} } });
        const tags = Array.from({ length: SYNC_MOOD_MAX_TAGS + 2 }, (_, i) => `tag${i}`);
        const out = await judgeSyncMoods(tags);
        expect(out).toHaveLength(tags.length);
        expect(Object.keys(mocks.call.mock.calls[0][0].questions)).toHaveLength(SYNC_MOOD_MAX_TAGS * 2);
    });
});

describe('SyncMetadataTaggingService.resolveSyncMoods', () => {
    beforeEach(() => { vi.clearAllMocks(); __resetJudgmentCooldownForTests(); });

    it('uses Jev where settled and the deterministic map where not', async () => {
        mocks.call.mockResolvedValue({ data: { answers: {
            applies_0: { type: 'noul', noul: 0.1 }, mood_0: { type: 'choice', choice: 'Melancholic' },
            applies_1: { type: 'noul', noul: 0.5 }, mood_1: { type: 'choice', choice: 'Dark' },
            applies_2: { type: 'noul', noul: 0.9 }, mood_2: { type: 'choice', choice: 'Cinematic' },
        } } });
        const moods = await new SyncMetadataTaggingService().resolveSyncMoods(['unhappy', 'chill', 'epic orchestral']);
        expect(moods).toEqual(['Chill', 'Cinematic']);
    });

    it('falls back fully to the deterministic map when judgments fail', async () => {
        mocks.call.mockRejectedValue(new Error('down'));
        const moods = await new SyncMetadataTaggingService().resolveSyncMoods(['happy', 'sad']);
        expect(moods).toEqual(['Upbeat', 'Melancholic']);
    });
});
