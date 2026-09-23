/**
 * TypeSafe judgment constants + decision-band tests (ISSUE-1442 pilot).
 *
 * The judgment must never change a verdict when it is unavailable, and its
 * probability bands must adopt/reject/keep-heuristic exactly as documented in
 * the constants file.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
    httpsCallable: vi.fn(),
    enabled: vi.fn(),
}));

vi.mock('firebase/functions', () => ({
    getFunctions: vi.fn(() => ({})),
    httpsCallable: (_fns: unknown, name: string) => mocks.httpsCallable(name),
}));

vi.mock('@/config/featureFlags', () => ({
    featureFlags: { isEnabled: mocks.enabled },
    FEATURE_FLAG_NAMES: { TYPESAFE_JUDGMENTS: 'enable_typesafe_judgments' },
}));

import {
    heuristicTransientError,
    judgeTransientError,
    TRANSIENT_ADOPT_MIN,
    TRANSIENT_REJECT_MAX,
} from './typesafeJudgments';

describe('heuristicTransientError (deterministic baseline)', () => {
    it('classifies classic infrastructure failures as transient', () => {
        expect(heuristicTransientError(new Error('Request failed with status 429'))).toBe(true);
        expect(heuristicTransientError(new Error('ETIMEDOUT after 30s'))).toBe(true);
        expect(heuristicTransientError(new Error('fetch failed: ECONNRESET'))).toBe(true);
        expect(heuristicTransientError('Rate limit exceeded for generateContent')).toBe(true);
    });

    it('classifies logical failures as non-transient', () => {
        expect(heuristicTransientError(new Error('Permission denied for user'))).toBe(false);
        expect(heuristicTransientError(new Error('Invalid argument: escrowDocId is required'))).toBe(false);
        expect(heuristicTransientError('')).toBe(false);
    });
});

describe('judgeTransientError decision bands', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns null and never calls the callable when the flag is off', async () => {
        mocks.enabled.mockReturnValue(false);

        const verdict = await judgeTransientError(new Error('timeout'), true);

        expect(verdict).toBeNull();
        expect(mocks.httpsCallable).not.toHaveBeenCalled();
    });

    it('adopts a confident transient verdict', async () => {
        mocks.enabled.mockReturnValue(true);
        mocks.httpsCallable.mockReturnValue(async () => ({ data: { answers: { transient: 0.9 } } }));

        const verdict = await judgeTransientError(new Error('weird phrasing'), false);

        expect(verdict).toBe(true);
        expect(mocks.httpsCallable).toHaveBeenCalledWith('typesafeJudge');
    });

    it('adopts a confident logical verdict even against the heuristic', async () => {
        mocks.enabled.mockReturnValue(true);
        mocks.httpsCallable.mockReturnValue(async () => ({ data: { answers: { transient: 0.1 } } }));

        // Heuristic said transient (message contains 'network'); judgment disagrees confidently.
        const verdict = await judgeTransientError(new Error('network policy rejected the request schema'), true);

        expect(verdict).toBe(false);
    });

    it('keeps the heuristic inside the ambiguous band', async () => {
        mocks.enabled.mockReturnValue(true);
        mocks.httpsCallable.mockReturnValue(async () => ({ data: { answers: { transient: 0.5 } } }));

        expect(await judgeTransientError(new Error('mystery'), true)).toBe(true);
        expect(await judgeTransientError(new Error('mystery'), false)).toBe(false);
    });

    it('returns null when the callable fails, so callers fall back to the heuristic', async () => {
        mocks.enabled.mockReturnValue(true);
        mocks.httpsCallable.mockReturnValue(async () => { throw new Error('unavailable'); });

        const verdict = await judgeTransientError(new Error('timeout'), true);

        expect(verdict).toBeNull();
    });

    it('returns null on a malformed (non-numeric) answer', async () => {
        mocks.enabled.mockReturnValue(true);
        mocks.httpsCallable.mockReturnValue(async () => ({ data: { answers: { transient: 'probably' } } }));

        const verdict = await judgeTransientError(new Error('timeout'), true);

        expect(verdict).toBeNull();
    });

    it('keeps the documented band constants honest', () => {
        expect(TRANSIENT_ADOPT_MIN).toBeGreaterThan(0.5);
        expect(TRANSIENT_REJECT_MAX).toBeLessThan(0.5);
        expect(TRANSIENT_REJECT_MAX).toBeLessThan(TRANSIENT_ADOPT_MIN);
    });
});
