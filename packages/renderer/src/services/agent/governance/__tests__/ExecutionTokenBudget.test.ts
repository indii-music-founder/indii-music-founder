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

    it.each([NaN, Infinity, -1, 1.5])('rejects an invalid reservation (%s)', amount => {
        const budget = new ExecutionTokenBudget(100);
        expect(budget.reserve(amount)).toBeNull();
        expect(budget.remaining).toBe(100);
    });
});
