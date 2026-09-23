/**
 * Judgment failure-cooldown tests (ISSUE-1442, "use jev moving forward").
 *
 * The cooldown is module-global state, so it lives in its own test file:
 * after an upstream failure, ALL judgment calls skip the doomed network round
 * trip until the cooldown expires — then calls resume.
 */
import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';

const mocks = vi.hoisted(() => ({
    httpsCallable: vi.fn(),
    enabled: vi.fn(),
}));

vi.mock('firebase/functions', () => ({
    getFunctions: vi.fn(() => ({})),
    httpsCallable: (_fns: unknown, name: string) => {
        expect(name).toBe('typesafeJudge');
        return mocks.httpsCallable(name);
    },
}));

vi.mock('@/config/featureFlags', () => ({
    featureFlags: { isEnabled: mocks.enabled },
    FEATURE_FLAG_NAMES: { TYPESAFE_JUDGMENTS: 'enable_typesafe_judgments' },
}));

import {
    judgeTransientError,
    JUDGMENT_FAILURE_COOLDOWN_MS,
    __resetJudgmentCooldownForTests,
} from './typesafeJudgments';

describe('judgment failure cooldown', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        __resetJudgmentCooldownForTests();
        mocks.enabled.mockReturnValue(true);
    });

    afterAll(() => {
        __resetJudgmentCooldownForTests();
    });

    it('skips judgment calls while the failure cooldown is armed', async () => {
        vi.useFakeTimers();
        try {
            mocks.httpsCallable.mockReturnValue(async () => { throw new Error('TYPESAFE_API_KEY missing'); });

            // First failure arms the cooldown.
            expect(await judgeTransientError(new Error('timeout'), true)).toBeNull();
            const callsAfterFailure = mocks.httpsCallable.mock.calls.length;

            // Within the cooldown: no new network attempt, deterministic baseline answers.
            expect(await judgeTransientError(new Error('timeout'), true)).toBeNull();
            expect(await judgeSkillIntentShim()).toBeNull();
            expect(mocks.httpsCallable.mock.calls.length).toBe(callsAfterFailure);
        } finally {
            vi.useRealTimers();
        }
    });

    it('resumes judgment calls after the cooldown expires', async () => {
        vi.useFakeTimers();
        try {
            mocks.httpsCallable.mockReturnValue(async () => { throw new Error('TYPESAFE_API_KEY missing'); });
            expect(await judgeTransientError(new Error('timeout'), true)).toBeNull();

            vi.advanceTimersByTime(JUDGMENT_FAILURE_COOLDOWN_MS + 1);

            mocks.httpsCallable.mockReturnValue(async () => ({ data: { answers: { transient: 0.9 } } }));
            expect(await judgeTransientError(new Error('timeout'), true)).toBe(true);
        } finally {
            vi.useRealTimers();
            __resetJudgmentCooldownForTests();
        }
    });

    // judgeSkillIntent shares the same cooldown — exercised via the same proxy path.
    async function judgeSkillIntentShim(): Promise<string | null> {
        const { judgeSkillIntent } = await import('./typesafeJudgments');
        return judgeSkillIntent('anything', [{ id: 's', name: 's', description: 's' }]);
    }
});
