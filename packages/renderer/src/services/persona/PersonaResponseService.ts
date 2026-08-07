/**
 * Evolas Phase T1.3 — Style/substance split (docs/EVOLAS_BUILD_PLAN.md).
 *
 * This is the load-bearing piece of the whole system. Two structurally
 * separate calls:
 *
 *   1. getVerdict()  — non-personalized. No fader-compiled style block ever
 *      reaches this call. Produces a typed, schema-constrained verdict.
 *   2. renderInStyle() — personalized. Receives the ALREADY-COMPUTED verdict
 *      object as opaque data plus a style instruction block, and is told
 *      explicitly it may not alter verdict/riskLevel/caveats/escalate — only
 *      choose how to phrase them.
 *
 * Non-negotiable #1 (docs/EVOLAS_BUILD_PLAN.md): ratings and fader values
 * can change style. They must never be able to reach getVerdict() — there is
 * no parameter on that function through which they could.
 */

import { AutonomousIntelligence } from '@/services/intelligence/AutonomousIntelligence';
import type { Schema } from '@/shared/types/ai.dto';
import { compilePersonaPrompt } from './PersonaPromptCompiler';
import type { PersonaFaderValues } from '@indii/shared';

export type PersonaRiskLevel = 'low' | 'medium' | 'high';

export interface PersonaVerdict {
    verdict: string;
    riskLevel: PersonaRiskLevel;
    caveats: string[];
    escalate: boolean;
}

const VERDICT_SCHEMA: Schema = {
    type: 'object',
    properties: {
        verdict: { type: 'string' },
        riskLevel: { type: 'string', enum: ['low', 'medium', 'high'] },
        caveats: { type: 'array', items: { type: 'string' } },
        escalate: { type: 'boolean' },
    },
    required: ['verdict', 'riskLevel', 'caveats', 'escalate'],
} as unknown as Schema;

export class PersonaResponseError extends Error {}

function isPersonaVerdict(value: unknown): value is PersonaVerdict {
    if (typeof value !== 'object' || value === null) return false;
    const v = value as Record<string, unknown>;
    return (
        typeof v.verdict === 'string' &&
        (v.riskLevel === 'low' || v.riskLevel === 'medium' || v.riskLevel === 'high') &&
        Array.isArray(v.caveats) &&
        v.caveats.every((c) => typeof c === 'string') &&
        typeof v.escalate === 'boolean'
    );
}

/**
 * Non-personalized substance call. `personaContext` is archetype/domain
 * grounding (e.g. what a Contract Reader is accountable for) — it is NOT a
 * style instruction and must never contain fader-derived language. This
 * function's parameter list is the enforcement: there is no fader/rating
 * input here to leak from.
 */
export async function getVerdict(question: string, personaContext: string): Promise<PersonaVerdict> {
    const result = await AutonomousIntelligence.generateStructuredData(
        [{ text: question }],
        VERDICT_SCHEMA,
        undefined,
        personaContext
    );

    if (!isPersonaVerdict(result)) {
        throw new PersonaResponseError(
            'Substance call returned a malformed verdict object — refusing to pass an unvalidated ' +
            'shape into the style layer.'
        );
    }

    return result;
}

/**
 * Personalized rendering call. Receives the verdict as already-computed
 * data, never the raw question. Cannot alter verdict/riskLevel/caveats/
 * escalate — the prompt instructs this explicitly, and the fields are never
 * re-derived from the model's prose; callers read them from the `verdict`
 * object passed in, not from `styledResponse`.
 */
export async function renderInStyle(
    verdict: PersonaVerdict,
    faderValues: PersonaFaderValues
): Promise<string> {
    const styleBlock = compilePersonaPrompt(faderValues);

    const prompt = [
        'Render the following verdict for the user. Phrase it according to the',
        'style instructions in the system prompt. Do NOT change the verdict,',
        'risk level, caveats, or escalation decision — those are fixed facts.',
        'Your only job is word choice, tone, and structure.',
        '',
        `Verdict: ${verdict.verdict}`,
        `Risk level: ${verdict.riskLevel}`,
        `Caveats: ${verdict.caveats.join('; ') || 'none'}`,
        `Escalate to a human professional: ${verdict.escalate ? 'yes' : 'no'}`,
    ].join('\n');

    return AutonomousIntelligence.generateText(prompt, undefined, styleBlock);
}

/**
 * Full pipeline: substance then style. Exposed for convenience; callers who
 * need to reuse one verdict across multiple style renders (e.g. the T1.3
 * canary check, or re-rendering after a fader change without re-asking the
 * question) should call getVerdict() and renderInStyle() separately instead.
 */
export async function getPersonaResponse(
    question: string,
    personaContext: string,
    faderValues: PersonaFaderValues
): Promise<{ verdict: PersonaVerdict; styledResponse: string }> {
    const verdict = await getVerdict(question, personaContext);
    const styledResponse = await renderInStyle(verdict, faderValues);
    return { verdict, styledResponse };
}
