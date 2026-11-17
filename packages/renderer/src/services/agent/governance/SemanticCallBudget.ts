import type { ExecutionTokenBudget } from './ExecutionTokenBudget';
import { TokenEstimator } from './TokenEstimator';

export interface SemanticCallAdmission {
    budget: ExecutionTokenBudget;
    checkpoint: () => Promise<void>;
}

export class SemanticCallCheckpointError extends Error {}

export function reportedSemanticTokens(usage: unknown): number | undefined {
    if (!usage || typeof usage !== 'object') return undefined;
    const { inputTokens, outputTokens, totalTokens } = usage as Record<string, unknown>;
    if (typeof inputTokens !== 'number' || !Number.isSafeInteger(inputTokens) || inputTokens < 0 ||
        typeof outputTokens !== 'number' || !Number.isSafeInteger(outputTokens) || outputTokens < 0 ||
        typeof totalTokens !== 'number' || !Number.isSafeInteger(totalTokens) || totalTokens < 0 ||
        inputTokens + outputTokens !== totalTokens) return undefined;
    return totalTokens;
}

/** The exact judgment payload sent to `typesafeJudge`, used to size its hold. */
export interface SemanticCallPayload {
    state: unknown;
    questions: Record<string, unknown>;
}

/** Projected output per judgment question (an answer plus structured framing). */
const OUTPUT_TOKENS_PER_QUESTION = 64;

/** Headroom for the judge's own system framing around the serialized payload. */
const INPUT_OVERHEAD_MULTIPLIER = 2;

/**
 * Bounded token hold for one judgment, derived from the exact payload. Never
 * the whole execution allowance: concurrent agents sharing the run must still
 * be able to reserve their own calls, and a missing usage receipt may only
 * retain this call's projected cost.
 */
export function estimateSemanticCallTokens(payload: SemanticCallPayload): number {
    const estimate = TokenEstimator.estimate(
        JSON.stringify({ state: payload.state, questions: payload.questions }),
        undefined,
        [],
        Number.MAX_SAFE_INTEGER,
        Math.max(1, Object.keys(payload.questions).length) * OUTPUT_TOKENS_PER_QUESTION,
    );
    return estimate.inputTokens * INPUT_OVERHEAD_MULTIPLIER + estimate.projectedOutputTokens;
}

/**
 * Optional judgments have no provider-enforced token ceiling. Hold a bounded
 * estimate of this call's cost until a complete receipt permits settlement.
 * Missing usage keeps that estimate, including across a durable restart. When
 * the estimate does not fit the remaining allowance the judgment abstains.
 * This records actual overages; it cannot enforce a provider-side limit.
 */
export async function runBudgetedSemanticCall<T extends { usage?: unknown }>(
    admission: SemanticCallAdmission,
    payload: SemanticCallPayload,
    call: () => Promise<T>,
): Promise<T | null> {
    const projected = estimateSemanticCallTokens(payload);
    if (projected > admission.budget.remaining) return null;
    const reservation = admission.budget.reserve(projected);
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
        admission.budget.settle(reservation, reportedSemanticTokens(result.usage));
        settled = true;
        await checkpoint();
        return result;
    } finally {
        if (!settled) admission.budget.settle(reservation, undefined);
    }
}
