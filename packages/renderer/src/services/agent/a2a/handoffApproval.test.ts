import { describe, it, expect, vi, afterEach } from 'vitest';
import { waitForHandoffDecision, describeHandoffFailure, type HandoffApprovalState } from '@/services/agent/a2a/handoffApproval';

describe('waitForHandoffDecision', () => {
    afterEach(() => vi.useRealTimers());

    it('ends the wait as soon as the user rejects, instead of running out the clock (ISSUE-1628)', async () => {
        vi.useFakeTimers();
        const state: HandoffApprovalState = { approved: false };
        const pending = waitForHandoffDecision(() => state, { pollMs: 1000, timeoutMs: 300_000 });

        await vi.advanceTimersByTimeAsync(3_000);
        state.rejected = true;
        await vi.advanceTimersByTimeAsync(1_000);

        await expect(pending).resolves.toBe('rejected');
    });

    it('returns approved when the user approves', async () => {
        vi.useFakeTimers();
        const state: HandoffApprovalState = { approved: false };
        const pending = waitForHandoffDecision(() => state);
        state.approved = true;
        await vi.advanceTimersByTimeAsync(1_000);
        await expect(pending).resolves.toBe('approved');
    });

    it('times out when nobody answers', async () => {
        vi.useFakeTimers();
        const pending = waitForHandoffDecision(() => ({ approved: false }), { pollMs: 1000, timeoutMs: 5_000 });
        await vi.advanceTimersByTimeAsync(6_000);
        await expect(pending).resolves.toBe('timeout');
    });

    it('stops when the account changes', async () => {
        const result = await waitForHandoffDecision(() => ({ approved: false }), { isCancelled: () => true });
        expect(result).toBe('cancelled');
    });

    it('describes a rejection differently from a timeout', () => {
        expect(describeHandoffFailure('rejected', 'generalist', 'legal')).toMatch(/rejected by the user/);
        expect(describeHandoffFailure('timeout', 'generalist', 'legal')).toMatch(/timed out/);
    });
});
