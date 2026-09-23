/**
 * TypeSafe judgment constants — the single reviewable place for every
 * question, option set, and threshold used with the typesafeJudge callable
 * (ISSUE-1442 pilot; see docs/TYPESAFE_OPPORTUNITIES.md).
 *
 * Review contract: questions and thresholds live HERE and only here. The
 * API key never reaches the renderer — judgments go through the server-side
 * `typesafeJudge` Cloud Function, which forwards { model, state, questions }
 * to the TypeSafe HTTP API verbatim (docs.typesafe.ai/api).
 */

import { httpsCallable, getFunctions } from 'firebase/functions';
import { featureFlags, FEATURE_FLAG_NAMES } from '@/config/featureFlags';
import { logger } from '@/utils/logger';

// ---------------------------------------------------------------------------
// Judgment 2: skill intent routing (consumer: ProductSkillRegistry)
// ---------------------------------------------------------------------------

export interface SkillCandidate {
    id: string;
    name: string;
    description: string;
}

export const SKILL_INTENT_NONE = 'none';

function skillIntentQuestion(candidateCount: number) {
    return {
        type: 'choice' as const,
        instructions:
            'A music-business agent received the user query below. Pick the ONE bundled playbook that best ' +
            `serves the query's actual intent from the ${candidateCount} candidate ids. If none plausibly serves it, pick 'none'.`,
    };
}

/**
 * Choice-judge the best skill for a free-text query. Called only after the
 * deterministic matchers miss. Returns the chosen candidate id (or null when
 * unavailable / 'none' picked / low confidence).
 */
export async function judgeSkillIntent(
    query: string,
    candidates: SkillCandidate[],
): Promise<string | null> {
    if (!typesafeJudgmentsEnabled() || candidates.length === 0) return null;

    try {
        const functions = getFunctions();
        const judgeFn = httpsCallable<
            { state: Record<string, unknown>; questions: Record<string, unknown> },
            { answers: Record<string, unknown> }
        >(functions, 'typesafeJudge');

        const result = await judgeFn({
            state: {
                query,
                candidates: candidates.map(c => ({ id: c.id, name: c.name, description: c.description.slice(0, 160) })),
            },
            questions: {
                skill: {
                    ...skillIntentQuestion(candidates.length),
                    options: { ...Object.fromEntries(candidates.map(c => [c.id, c.name])), [SKILL_INTENT_NONE]: 'No skill applies' },
                },
            },
        });

        const answer = result.data.answers?.skill;
        const choice = typeof answer === 'string' ? answer : (answer as { choice?: unknown })?.choice;
        if (typeof choice !== 'string' || choice === SKILL_INTENT_NONE || !candidates.some(c => c.id === choice)) {
            return null;
        }
        return choice;
    } catch (err: unknown) {
        logger.warn('[typesafeJudgments] skill intent judgment unavailable:', err instanceof Error ? err.message : err);
        return null;
    }
}

// ---------------------------------------------------------------------------
// Feature gate — off until the judgment is evaluated against real outcomes.
// ---------------------------------------------------------------------------
export function typesafeJudgmentsEnabled(): boolean {
    return featureFlags.isEnabled(FEATURE_FLAG_NAMES.TYPESAFE_JUDGMENTS);
}

// ---------------------------------------------------------------------------
// Judgment 1: transient infrastructure failure vs logical failure
// (consumer: services/agent/orchestration/AgentLoopService.ts)
// ---------------------------------------------------------------------------

/**
 * The deterministic baseline (previously AgentLoopService.isTransientError).
 * Always available: no network, no flag. The judgment only refines this.
 */
export function heuristicTransientError(error: unknown): boolean {
    const msg = (error instanceof Error ? error.message : String(error)).toLowerCase();
    return (
        msg.includes('timeout') ||
        msg.includes('etimedout') ||
        msg.includes('429') ||
        msg.includes('503') ||
        msg.includes('504') ||
        msg.includes('rate limit') ||
        msg.includes('resource exhausted') ||
        msg.includes('fetch failed') ||
        msg.includes('network') ||
        msg.includes('aborted') ||
        msg.includes('econnreset')
    );
}

/** Noul question — exact TypeSafe HTTP API question shape. */
export const TRANSIENT_FAILURE_QUESTION = {
    type: 'noul' as const,
    instructions:
        'An automated agent loop failed while executing one action. Judge whether this failure is TRANSIENT ' +
        'infrastructure trouble (worth retrying with backoff: timeouts, rate limits, connection resets, ' +
        'upstream 5xx) or a LOGICAL/PERSISTENT failure (retrying cannot help: invalid arguments, permission ' +
        'denials, malformed requests, policy rejections, unrecoverable data problems).',
    criteria: {
        true: 'Transient infrastructure failure — a retry with backoff has a realistic chance of succeeding.',
        false: 'Logical or persistent failure — the same action will fail again without changing the request.',
    },
};

/** Adopt the judgment's "yes" at or above this probability of transient. */
export const TRANSIENT_ADOPT_MIN = 0.65;
/** Adopt the judgment's "no" at or below this probability of transient. */
export const TRANSIENT_REJECT_MAX = 0.35;
/** Between the bands the judgment is too close to call — keep the heuristic. */
export const TRANSIENT_AMBIGUOUS_KEEP_HEURISTIC = true;

/**
 * Refine the heuristic verdict with a TypeSafe Noul judgment.
 *
 * Returns the refined verdict, or null when the judgment is unavailable
 * (flag off, upstream failure, malformed/ambiguous answer) — callers must
 * fall back to the deterministic heuristic in that case.
 */
export async function judgeTransientError(error: unknown, heuristicVerdict: boolean): Promise<boolean | null> {
    if (!typesafeJudgmentsEnabled()) return null;

    try {
        const functions = getFunctions();
        const judgeFn = httpsCallable<
            { state: Record<string, unknown>; questions: Record<string, unknown> },
            { answers: Record<string, unknown> }
        >(functions, 'typesafeJudge');

        const result = await judgeFn({
            state: {
                errorMessage: error instanceof Error ? error.message : String(error),
                errorName: error instanceof Error ? error.name : typeof error,
                heuristicVerdict,
            },
            questions: { transient: TRANSIENT_FAILURE_QUESTION },
        });

        const answer = result.data.answers?.transient;
        const probability = typeof answer === 'number' ? answer : Number((answer as { noul?: unknown })?.noul);
        if (!Number.isFinite(probability)) {
            logger.warn('[typesafeJudgments] transient judgment returned a non-numeric answer — keeping heuristic.');
            return null;
        }

        if (probability >= TRANSIENT_ADOPT_MIN) return true;
        if (probability <= TRANSIENT_REJECT_MAX) return false;
        return TRANSIENT_AMBIGUOUS_KEEP_HEURISTIC ? heuristicVerdict : null;
    } catch (err: unknown) {
        logger.warn('[typesafeJudgments] transient judgment unavailable — keeping heuristic:', err instanceof Error ? err.message : err);
        return null;
    }
}
