import type { ExecutionTokenBudget } from './ExecutionTokenBudget';

export interface SemanticCallAdmission {
    budget: ExecutionTokenBudget;
    checkpoint: () => Promise<void>;
}

export class SemanticCallCheckpointError extends Error {}

function reportedTokens(usage: unknown): number | undefined {
    if (!usage || typeof usage !== 'object') return undefined;
    const { inputTokens, outputTokens, totalTokens } = usage as Record<string, unknown>;
    if (typeof inputTokens !== 'number' || !Number.isSafeInteger(inputTokens) || inputTokens < 0 ||
        typeof outputTokens !== 'number' || !Number.isSafeInteger(outputTokens) || outputTokens < 0 ||
        typeof totalTokens !== 'number' || !Number.isSafeInteger(totalTokens) || totalTokens < 0 ||
        inputTokens + outputTokens !== totalTokens) return undefined;
    return totalTokens;
}

/**
 * Optional judgments have no provider-enforced token ceiling. Hold the remaining
 * run allowance exclusively until a complete receipt permits settlement. Missing
 * usage keeps that reservation, including across a durable restart. This records
 * actual overages; it cannot enforce a provider-side per-call spending limit.
 */
export async function runBudgetedSemanticCall<T extends { usage?: unknown }>(
    admission: SemanticCallAdmission,
    call: () => Promise<T>,
): Promise<T | null> {
    const allowance = admission.budget.remaining;
    if (allowance === 0) return null;
    const reservation = admission.budget.reserve(allowance);
    if (reservation === null) return null;
    let settled = false;
    const checkpoint = async () => {
        try {
            await admission.checkpoint();
        } catch (cause) {
            throw new SemanticCallCheckpointError('Semantic call checkpoint failed.', { cause });
        }
    };
    try {
        await checkpoint();
        const result = await call();
        admission.budget.settle(reservation, reportedTokens(result.usage));
        settled = true;
        await checkpoint();
        return result;
    } finally {
        if (!settled) admission.budget.settle(reservation, undefined);
    }
}
