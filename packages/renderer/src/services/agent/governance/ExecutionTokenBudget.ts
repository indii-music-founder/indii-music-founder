/** A synchronous reservation ledger shared by the agents in one execution. */
export class ExecutionTokenBudget {
    private consumed = 0;
    private restoredSpend = 0;
    private restoredThroughReservation = 0;
    private nextReservation = 0;
    private spendOverflowed = false;
    private readonly reservations = new Map<number, number>();

    constructor(readonly limit: number) {
        if (!Number.isSafeInteger(limit) || limit <= 0) {
            throw new Error('Execution token limit must be a positive safe integer');
        }
    }

    get remaining(): number {
        return Math.max(0, this.limit - this.consumed);
    }

    get spent(): number {
        return this.consumed;
    }

    /** Restores the highest durable spend without granting a fresh allowance. */
    ensureSpentAtLeast(tokens: number): void {
        if (!Number.isSafeInteger(tokens) || tokens < 0) {
            throw new Error('Saved execution token usage is invalid');
        }
        // A repeated or older checkpoint cannot absorb reservations made
        // after the highest checkpoint was restored.
        if (tokens <= this.restoredSpend) return;
        this.restoredSpend = tokens;
        this.consumed = Math.max(this.consumed, tokens);
        this.restoredThroughReservation = this.nextReservation;
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
        if (!this.spendOverflowed && actualTokens !== undefined && Number.isSafeInteger(actualTokens) && actualTokens > 0) {
            // An older in-flight call cannot refund usage restored from a
            // durable checkpoint whose accounting may include other calls.
            const adjustment = actualTokens - reserved;
            const charge = id <= this.restoredThroughReservation ? Math.max(0, adjustment) : adjustment;
            if (charge > Number.MAX_SAFE_INTEGER - this.consumed) {
                this.spendOverflowed = true;
                this.consumed = Number.MAX_SAFE_INTEGER;
            } else {
                this.consumed += charge;
            }
        }
    }
}

interface BudgetBinding {
    budget?: ExecutionTokenBudget;
}

const budgets = new WeakMap<object, BudgetBinding>();

function bindingFor(context: object): BudgetBinding {
    let binding = budgets.get(context);
    if (!binding) {
        binding = {};
        budgets.set(context, binding);
    }
    return binding;
}

export function executionTokenBudget(context: object | undefined, limit: number): ExecutionTokenBudget {
    if (!context) return new ExecutionTokenBudget(limit);
    const binding = bindingFor(context);
    return binding.budget ??= new ExecutionTokenBudget(limit);
}

/** Share the binding even when neither context has requested its budget yet. */
export function inheritExecutionTokenBudget<T extends object>(parent: object | undefined, child: T): T {
    if (parent) budgets.set(child, bindingFor(parent));
    return child;
}
