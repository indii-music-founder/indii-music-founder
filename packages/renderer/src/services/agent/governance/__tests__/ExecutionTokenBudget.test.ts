import { describe, expect, it } from 'vitest';
import { ExecutionTokenBudget, executionTokenBudget, inheritExecutionTokenBudget } from '../ExecutionTokenBudget';

describe('ExecutionTokenBudget', () => {
    it('reserves atomically before parallel calls can use the same allowance', async () => {
        const budget = new ExecutionTokenBudget(100);
        const calls = await Promise.all([40, 40, 40].map(async amount => budget.reserve(amount)));
        expect(calls.filter(id => id !== null)).toHaveLength(2);
        expect(budget.remaining).toBe(20);
    });

    it('settles from actual usage and retains the reserve when usage is missing', () => {
        const budget = new ExecutionTokenBudget(100);
        const first = budget.reserve(40)!;
        budget.settle(first, 25);
        expect(budget.remaining).toBe(75);
        const second = budget.reserve(40)!;
        budget.settle(second, 0);
        expect(budget.remaining).toBe(35);
        const third = budget.reserve(30)!;
        budget.settle(third, 45);
        expect(budget.remaining).toBe(0);
    });

    it('shares one balance through cloned delegation contexts', () => {
        const root = {};
        const child = { ...root };
        const parentBudget = executionTokenBudget(root, 100);
        inheritExecutionTokenBudget(root, child);
        expect(executionTokenBudget(child, 100)).toBe(parentBudget);
        parentBudget.reserve(80);
        expect(executionTokenBudget(child, 100).reserve(30)).toBeNull();
    });

    it('shares a budget across descendants created before the first reservation', () => {
        const root = {};
        const child = {};
        const grandchild = {};
        inheritExecutionTokenBudget(root, child);
        inheritExecutionTokenBudget(child, grandchild);
        executionTokenBudget(grandchild, 100).reserve(90);
        expect(executionTokenBudget(root, 100).reserve(11)).toBeNull();
        expect(executionTokenBudget(child, 100).remaining).toBe(10);
    });

    it('restores a durable high-water mark without replenishing an active context', () => {
        const budget = new ExecutionTokenBudget(100);
        budget.reserve(30);
        budget.ensureSpentAtLeast(80);
        expect(budget.spent).toBe(80);
        expect(budget.remaining).toBe(20);
        budget.ensureSpentAtLeast(50);
        expect(budget.spent).toBe(80);
        expect(() => budget.ensureSpentAtLeast(NaN)).toThrow(/invalid/);
    });

    it('cannot refund restored durable spend by settling an older reservation', () => {
        const budget = new ExecutionTokenBudget(100);
        const older = budget.reserve(30)!;
        budget.ensureSpentAtLeast(80);
        budget.settle(older, 10);
        expect(budget.spent).toBe(80);
        expect(budget.reserve(21)).toBeNull();

        const fresh = budget.reserve(20)!;
        budget.settle(fresh, 5);
        expect(budget.spent).toBe(85);
        expect(budget.remaining).toBe(15);
    });

    it.each([0, 70, 80])('still refunds a fresh call after restoring stale spend (%s)', staleSpend => {
        const budget = new ExecutionTokenBudget(100);
        budget.ensureSpentAtLeast(80);
        const fresh = budget.reserve(20)!;
        budget.ensureSpentAtLeast(staleSpend);
        budget.settle(fresh, 5);
        expect(budget.spent).toBe(85);
        expect(budget.remaining).toBe(15);
    });

    it('preserves new pending reservations while an older restored call settles', () => {
        const budget = new ExecutionTokenBudget(100);
        const older = budget.reserve(30)!;
        budget.ensureSpentAtLeast(80);
        const fresh = budget.reserve(20)!;
        budget.settle(older, 10);
        expect(budget.remaining).toBe(0);
        budget.settle(fresh, 5);
        expect(budget.spent).toBe(85);
    });

    it('keeps overflowed spend checkpointable and prevents later refunds from reopening the budget', () => {
        const limit = Number.MAX_SAFE_INTEGER;
        const budget = new ExecutionTokenBudget(limit);
        const first = budget.reserve(1)!;
        const second = budget.reserve(10)!;
        budget.settle(first, limit);
        budget.settle(second, 1);
        expect(budget.spent).toBe(limit);
        expect(budget.remaining).toBe(0);
        const restored = new ExecutionTokenBudget(limit);
        restored.ensureSpentAtLeast(budget.spent);
        expect(restored.reserve(1)).toBeNull();
    });

    it.each([NaN, Infinity, -1, 1.5])('rejects an invalid reservation (%s)', amount => {
        const budget = new ExecutionTokenBudget(100);
        expect(budget.reserve(amount)).toBeNull();
        expect(budget.remaining).toBe(100);
    });
});
