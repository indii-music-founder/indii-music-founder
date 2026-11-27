import { describe, expect, it } from 'vitest';
import { ExecutionTokenBudget } from '@/services/agent/governance/ExecutionTokenBudget';
import { estimateSemanticCallTokens, runBudgetedSemanticCall } from '@/services/agent/governance/SemanticCallBudget';

const LIMIT = 100_000;
const payload = {
    state: { utterance: 'stop talking' },
    questions: { stop: { type: 'noul', instructions: 'Is the user asking the agent to stop?' } },
};
const HOLD = estimateSemanticCallTokens(payload);
const noCheckpoint = async () => {};

describe('semantic call estimate (pure)', () => {
    it('is positive, bounded and grows with the payload and question count', () => {
        expect(HOLD).toBeGreaterThan(0);
        expect(HOLD).toBeLessThan(LIMIT);
        expect(estimateSemanticCallTokens({ ...payload, state: { utterance: 'x'.repeat(4_000) } })).toBeGreaterThan(HOLD);
        expect(estimateSemanticCallTokens({
            ...payload,
            questions: { ...payload.questions, other: payload.questions.stop },
        })).toBeGreaterThan(HOLD);
    });
});

describe('semantic execution accounting (structural)', () => {
    it('checkpoints the reservation before dispatch and settles a complete receipt', async () => {
        const budget = new ExecutionTokenBudget(LIMIT);
        const events: string[] = [];
        const result = await runBudgetedSemanticCall({ budget, checkpoint: async () => {
            events.push(`checkpoint:${LIMIT - budget.remaining}`);
        } }, payload, async () => {
            events.push('call');
            return { usage: { inputTokens: 15, outputTokens: 5, totalTokens: 20 } };
        });
        expect(result).not.toBeNull();
        expect(events).toEqual([`checkpoint:${HOLD}`, 'call', 'checkpoint:20']);
        expect(budget.spent).toBe(20);
    });

    it('reserves only the estimate, never the whole allowance', async () => {
        const budget = new ExecutionTokenBudget(LIMIT);
        let heldDuringCall = -1;
        await runBudgetedSemanticCall({ budget, checkpoint: noCheckpoint }, payload, async () => {
            heldDuringCall = LIMIT - budget.remaining;
            return { usage: { inputTokens: 1, outputTokens: 0, totalTokens: 1 } };
        });
        expect(heldDuringCall).toBe(HOLD);
    });

    it('abstains without calling when the estimate does not fit the remaining allowance', async () => {
        const budget = new ExecutionTokenBudget(LIMIT);
        budget.reserve(LIMIT - HOLD + 1);
        let called = false;
        expect(await runBudgetedSemanticCall({ budget, checkpoint: noCheckpoint }, payload, async () => {
            called = true;
            return {};
        })).toBeNull();
        expect(called).toBe(false);
    });

    it('does not call when checkpointing fails, retaining a conservative durable floor', async () => {
        const budget = new ExecutionTokenBudget(LIMIT);
        let calls = 0;
        await expect(runBudgetedSemanticCall({ budget, checkpoint: async () => { throw new Error('checkpoint failed'); } }, payload, async () => {
            calls++;
            return {};
        })).rejects.toThrow('checkpoint failed');
        expect(calls).toBe(0);
        expect(budget.spent).toBe(HOLD);
    });

    it.each([undefined, { totalTokens: 2 }, { inputTokens: 1, outputTokens: 1, totalTokens: 3 },
        { inputTokens: -1, outputTokens: 3, totalTokens: 2 }])('retains only the estimate for incomplete or invalid usage %j', async usage => {
        const budget = new ExecutionTokenBudget(LIMIT);
        await runBudgetedSemanticCall({ budget, checkpoint: noCheckpoint }, payload, async () => ({ usage }));
        expect(budget.spent).toBe(HOLD);
        const restarted = new ExecutionTokenBudget(LIMIT);
        restarted.ensureSpentAtLeast(budget.spent);
        expect(restarted.remaining).toBe(LIMIT - HOLD);
    });

    it('admits a parallel call in the same execution while the first is in flight', async () => {
        const budget = new ExecutionTokenBudget(LIMIT);
        let finish!: () => void;
        let checkpoints = 0;
        const first = runBudgetedSemanticCall({ budget, checkpoint: () => ++checkpoints === 1
            ? new Promise<void>(resolve => { finish = resolve; }) : Promise.resolve() }, payload,
            async () => ({ usage: { inputTokens: 10, outputTokens: 0, totalTokens: 10 } }));
        let secondCalled = false;
        expect(await runBudgetedSemanticCall({ budget, checkpoint: noCheckpoint }, payload, async () => {
            secondCalled = true;
            return { usage: { inputTokens: 5, outputTokens: 0, totalTokens: 5 } };
        })).not.toBeNull();
        expect(secondCalled).toBe(true);
        finish();
        await first;
        expect(budget.spent).toBe(15);
    });

    it('keeps separate executions independent and accepts explicit zero usage', async () => {
        const first = new ExecutionTokenBudget(LIMIT);
        const second = new ExecutionTokenBudget(LIMIT);
        await runBudgetedSemanticCall({ budget: first, checkpoint: noCheckpoint }, payload, async () => ({}));
        await runBudgetedSemanticCall({ budget: second, checkpoint: noCheckpoint }, payload, async () => ({
            usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
        }));
        expect(first.spent).toBe(HOLD);
        expect(second.spent).toBe(0);
    });

    it('does not return a judgment when its settlement checkpoint fails', async () => {
        const budget = new ExecutionTokenBudget(LIMIT);
        let checkpoints = 0;
        let durableSpend = 0;
        await expect(runBudgetedSemanticCall({ budget, checkpoint: async () => {
            if (++checkpoints === 2) throw new Error('settlement unavailable');
            durableSpend = budget.spent;
        } }, payload, async () => ({ usage: { inputTokens: 15, outputTokens: 5, totalTokens: 20 } })))
            .rejects.toThrow('checkpoint failed');
        expect(budget.spent).toBe(20);
        const restarted = new ExecutionTokenBudget(LIMIT);
        restarted.ensureSpentAtLeast(durableSpend);
        expect(restarted.spent).toBe(HOLD);
    });

    it('retains only the estimate when dispatch throws without a receipt', async () => {
        const budget = new ExecutionTokenBudget(LIMIT);
        await expect(runBudgetedSemanticCall({ budget, checkpoint: noCheckpoint }, payload, async () => {
            throw new Error('transport interrupted');
        })).rejects.toThrow('transport interrupted');
        expect(budget.spent).toBe(HOLD);
    });

    it('records actual overages without reopening the allowance', async () => {
        const budget = new ExecutionTokenBudget(LIMIT);
        budget.reserve(LIMIT - HOLD);
        await runBudgetedSemanticCall({ budget, checkpoint: noCheckpoint }, payload, async () => ({
            usage: { inputTokens: HOLD + 10, outputTokens: 5, totalTokens: HOLD + 15 },
        }));
        expect(budget.spent).toBe(LIMIT + 15);
        expect(budget.remaining).toBe(0);
    });
});
