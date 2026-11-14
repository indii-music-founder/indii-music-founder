import { describe, expect, it } from 'vitest';
import { ExecutionTokenBudget } from '../ExecutionTokenBudget';
import { runBudgetedSemanticCall } from '../SemanticCallBudget';

describe('semantic execution accounting (structural)', () => {
    it('checkpoints the reservation before dispatch and settles a complete receipt', async () => {
        const budget = new ExecutionTokenBudget(100);
        const events: string[] = [];
        const result = await runBudgetedSemanticCall({ budget, checkpoint: async () => {
            events.push('checkpoint');
        } }, async () => {
            events.push('call');
            return { usage: { inputTokens: 15, outputTokens: 5, totalTokens: 20 } };
        });
        expect(result).not.toBeNull();
        expect(events).toEqual(['checkpoint', 'call', 'checkpoint']);
        expect(budget.spent).toBe(20);
    });

    it('does not call when checkpointing fails, retaining a conservative durable floor', async () => {
        const budget = new ExecutionTokenBudget(100);
        let calls = 0;
        await expect(runBudgetedSemanticCall({ budget, checkpoint: async () => { throw new Error('checkpoint failed'); } }, async () => {
            calls++;
            return {};
        })).rejects.toThrow('checkpoint failed');
        expect(calls).toBe(0);
        expect(budget.remaining).toBe(0);
    });

    it.each([undefined, { totalTokens: 2 }, { inputTokens: 1, outputTokens: 1, totalTokens: 3 },
        { inputTokens: -1, outputTokens: 3, totalTokens: 2 }])('retains the reservation for incomplete or invalid usage %j', async usage => {
        const budget = new ExecutionTokenBudget(100);
        await runBudgetedSemanticCall({ budget, checkpoint: async () => {} }, async () => ({ usage }));
        expect(budget.remaining).toBe(0);
        const restarted = new ExecutionTokenBudget(100);
        restarted.ensureSpentAtLeast(budget.spent);
        expect(restarted.reserve(1)).toBeNull();
    });

    it('does not admit a parallel call against the same held allowance', async () => {
        const budget = new ExecutionTokenBudget(100);
        let finish!: () => void;
        let checkpoints = 0;
        const first = runBudgetedSemanticCall({ budget, checkpoint: () => ++checkpoints === 1
            ? new Promise<void>(resolve => { finish = resolve; }) : Promise.resolve() },
            async () => ({ usage: { inputTokens: 10, outputTokens: 0, totalTokens: 10 } }));
        let secondCalled = false;
        expect(await runBudgetedSemanticCall({ budget, checkpoint: async () => {} }, async () => {
            secondCalled = true;
            return {};
        })).toBeNull();
        expect(secondCalled).toBe(false);
        finish();
        await first;
        expect(budget.spent).toBe(10);
    });

    it('keeps separate executions independent and accepts explicit zero usage', async () => {
        const first = new ExecutionTokenBudget(100);
        const second = new ExecutionTokenBudget(100);
        await runBudgetedSemanticCall({ budget: first, checkpoint: async () => {} }, async () => ({}));
        await runBudgetedSemanticCall({ budget: second, checkpoint: async () => {} }, async () => ({
            usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
        }));
        expect(first.spent).toBe(100);
        expect(second.spent).toBe(0);
    });

    it('does not return a judgment when its settlement checkpoint fails', async () => {
        const budget = new ExecutionTokenBudget(100);
        let checkpoints = 0;
        let durableSpend = 0;
        await expect(runBudgetedSemanticCall({ budget, checkpoint: async () => {
            if (++checkpoints === 2) throw new Error('settlement unavailable');
            durableSpend = budget.spent;
        } }, async () => ({ usage: { inputTokens: 15, outputTokens: 5, totalTokens: 20 } })))
            .rejects.toThrow('checkpoint failed');
        expect(budget.spent).toBe(20);
        const restarted = new ExecutionTokenBudget(100);
        restarted.ensureSpentAtLeast(durableSpend);
        expect(restarted.remaining).toBe(0);
    });

    it('retains the held allowance when dispatch throws without a receipt', async () => {
        const budget = new ExecutionTokenBudget(100);
        await expect(runBudgetedSemanticCall({ budget, checkpoint: async () => {} }, async () => {
            throw new Error('transport interrupted');
        })).rejects.toThrow('transport interrupted');
        expect(budget.spent).toBe(100);
    });

    it('records actual overages without reopening the allowance', async () => {
        const budget = new ExecutionTokenBudget(10);
        await runBudgetedSemanticCall({ budget, checkpoint: async () => {} }, async () => ({
            usage: { inputTokens: 15, outputTokens: 5, totalTokens: 20 },
        }));
        expect(budget.spent).toBe(20);
        expect(budget.remaining).toBe(0);
    });
});
