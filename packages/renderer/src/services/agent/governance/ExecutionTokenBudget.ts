/** A synchronous reservation ledger shared by the agents in one execution. */
export class ExecutionTokenBudget {
    private consumed = 0;
    private nextReservation = 0;
    private readonly reservations = new Map<number, number>();

    constructor(readonly limit: number) {
        if (!Number.isSafeInteger(limit) || limit <= 0) {
            throw new Error('Execution token limit must be a positive safe integer');
        }
    }

    get remaining(): number {
        return Math.max(0, this.limit - this.consumed);
    }

    reserve(tokens: number): number | null {
        if (!Number.isSafeInteger(tokens) || tokens < 0 || tokens > this.remaining) return null;
        const id = ++this.nextReservation;
        this.consumed += tokens;
        this.reservations.set(id, tokens);
        return id;
    }

    /** Unknown or invalid provider usage retains the conservative reservation. */
    settle(id: number, actualTokens: number | undefined): void {
        const reserved = this.reservations.get(id);
        if (reserved === undefined) throw new Error('Unknown token reservation');
        this.reservations.delete(id);
        if (actualTokens !== undefined && Number.isSafeInteger(actualTokens) && actualTokens > 0) {
            this.consumed += actualTokens - reserved;
        }
    }
}

const budgets = new WeakMap<object, ExecutionTokenBudget>();

export function executionTokenBudget(context: object | undefined, limit: number): ExecutionTokenBudget {
    if (!context) return new ExecutionTokenBudget(limit);
    let budget = budgets.get(context);
    if (!budget) {
        budget = new ExecutionTokenBudget(limit);
        budgets.set(context, budget);
    }
    return budget;
}

/** Context clones must retain the same ledger, never a cloned balance. */
export function inheritExecutionTokenBudget(parent: object | undefined, child: object): void {
    if (parent) {
        const budget = budgets.get(parent);
        if (budget) budgets.set(child, budget);
    }
}
