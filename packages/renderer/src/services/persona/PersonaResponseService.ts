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
import { logger } from '@/utils/logger';
import { compilePersonaPrompt } from './PersonaPromptCompiler';
import { assignAndResolve } from './PersonaControlGroup';
import { recordSignal } from './PersonaInteractionRecorder';
import { recordPersonaResponseMeasurement } from './PersonaMeasurementRecorder';
import type {
    PersonaFaderValues,
    PersonaId,
    PersonaMeasurementRequest,
    PersonaSignalType,
} from '@indii/shared';

export type PersonaRiskLevel = 'low' | 'medium' | 'high';

export interface PersonaVerdict {
    verdict: string;
    riskLevel: PersonaRiskLevel;
    caveats: string[];
    escalate: boolean;
}

export interface PersonaResponseResult {
    verdict: PersonaVerdict;
    styledResponse: string;
}

export interface PersonaResponseTracking {
    responseId: string;
    isControlGroup: boolean;
    effectiveFaderValues: PersonaFaderValues;
    measurementRecorded: Promise<boolean>;
    recordInteraction: (signalType: PersonaSignalType) => Promise<void>;
}

export interface InstrumentedPersonaResponseResult extends PersonaResponseResult {
    tracking: PersonaResponseTracking;
}

export interface PersonaResponseRuntimeContext {
    personaId: PersonaId;
    responseId: string;
    randomSource?: () => number;
    measurementRecorder?: (request: PersonaMeasurementRequest) => Promise<unknown>;
    interactionRecorder?: typeof recordSignal;
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
 * Full pipeline: substance then style. The original three-argument contract
 * remains the uninstrumented T1 path. Supplying a runtime context activates
 * the late-T1 control assignment, measurement, and response-bound implicit
 * feedback recorder. Callers who need to reuse one verdict across multiple
 * style renders should call getVerdict() and renderInStyle() separately.
 */
export function getPersonaResponse(
    question: string,
    personaContext: string,
    faderValues: PersonaFaderValues
): Promise<PersonaResponseResult>;
export function getPersonaResponse(
    question: string,
    personaContext: string,
    faderValues: PersonaFaderValues,
    runtime: PersonaResponseRuntimeContext
): Promise<InstrumentedPersonaResponseResult>;
export async function getPersonaResponse(
    question: string,
    personaContext: string,
    faderValues: PersonaFaderValues,
    runtime: PersonaResponseRuntimeContext | undefined = undefined
): Promise<PersonaResponseResult | InstrumentedPersonaResponseResult> {
    const verdict = await getVerdict(question, personaContext);

    // Preserve the original three-argument T1 contract exactly. The runtime
    // context is the explicit opt-in boundary for randomized assignment and
    // correlated telemetry; existing callers continue to render the supplied
    // faders without a silent behavioral change.
    if (!runtime) {
        const styledResponse = await renderInStyle(verdict, faderValues);
        return { verdict, styledResponse };
    }

    // Assignment occurs only after the non-personalized verdict is fixed, so
    // neither the control flag nor either fader set can reach getVerdict().
    const assignment = assignAndResolve(faderValues, runtime.randomSource);
    const styledResponse = await renderInStyle(verdict, assignment.effectiveFaderValues);
    const measurementRecorder = runtime.measurementRecorder ?? recordPersonaResponseMeasurement;
    const measurementRecorded = measurementRecorder({
        personaId: runtime.personaId,
        responseId: runtime.responseId,
        responseText: styledResponse,
        setPositions: assignment.effectiveFaderValues,
        isControlGroup: assignment.isControlGroup,
    }).then(() => true).catch(() => {
        // Measurement is observational. An unavailable telemetry backend must
        // never discard a valid verdict/response that has already completed.
        logger.warn('[PersonaResponseService] Persona measurement could not be recorded.', {
            personaId: runtime.personaId,
            isControlGroup: assignment.isControlGroup,
        });
        return false;
    });

    const interactionRecorder = runtime.interactionRecorder ?? recordSignal;
    return {
        verdict,
        styledResponse,
        tracking: {
            responseId: runtime.responseId,
            isControlGroup: assignment.isControlGroup,
            effectiveFaderValues: assignment.effectiveFaderValues,
            measurementRecorded,
            recordInteraction: (signalType) => interactionRecorder(
                runtime.personaId,
                runtime.responseId,
                signalType,
            ),
        },
    };
}
