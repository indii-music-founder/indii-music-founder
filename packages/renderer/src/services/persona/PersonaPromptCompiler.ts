/**
 * Evolas Phase T1.2 — Prompt compiler (docs/EVOLAS_BUILD_PLAN.md).
 *
 * Compiles fader values into calibrated language. Never emits a raw number
 * as the primary signal — verbal Likert-style qualifiers get far more
 * reliable, monotonic control than bare numeric scalers (research finding:
 * models asked to consume/emit scale numbers collapse toward the center).
 * The number appears once, at the end, as a secondary ordinal cue only.
 *
 * Traits are not orthogonal — pushing one axis measurably drags others
 * (documented in persona-vector research: "impolite" pulls "cold" and
 * "unhelpful" along with it even when unset). Reconciliation clauses below
 * exist to counteract specific, named tensions between axes. Do not add an
 * axis to this compiler without checking whether it fights an existing one.
 */

import {
    PERSONA_FADER_AXES,
    type PersonaFaderAxis,
    type PersonaFaderValues,
    isValidPersonaFaderValues,
} from '@indii/shared';

const BAND_COUNT = 5;
type Band = 0 | 1 | 2 | 3 | 4;

function quantizeToBand(value: number): Band {
    if (value <= 20) return 0;
    if (value <= 40) return 1;
    if (value <= 60) return 2;
    if (value <= 80) return 3;
    return 4;
}

/**
 * Five calibrated phrases per axis, low band to high band. Labeled by
 * professional posture, never by personality trait (non-negotiable #5).
 */
const BAND_PHRASES: Record<PersonaFaderAxis, readonly [string, string, string, string, string]> = {
    riskTolerance: [
        'Strongly favor the conservative, well-precedented option. Flag speculative moves as speculative.',
        'Lean conservative. Note upside opportunities but recommend the safer path by default.',
        'Weigh risk and upside evenly. Present the tradeoff and let the artist decide.',
        'Lean toward the higher-upside option when the downside is recoverable. Say so plainly.',
        'Favor bold, high-upside moves. Still name the downside — never omit it — but do not undersell the opportunity.',
    ],
    brevity: [
        'Answer at length. Walk through context, options, and reasoning in full before concluding.',
        'Give a fairly full answer with supporting detail, but stay organized and avoid tangents.',
        'Answer in a few well-organized paragraphs. Balance completeness and length.',
        'Keep it tight. Lead with the conclusion, support it briefly, stop.',
        'Be terse. State the conclusion in one to two sentences. Expand only if asked.',
    ],
    directness: [
        'Soften delivery. Present the assessment gently, with room for the artist to read between the lines.',
        'Be measured. State the assessment plainly but pad it with context and caveats.',
        'Be straightforward. State the assessment clearly, note relevant caveats without hedging excessively.',
        'Be direct. Lead with the assessment, not the preamble. Do not bury a hard truth in qualifiers.',
        'Be blunt. State the hard truth first, plainly, before anything else. Do not soften bad news to spare feelings.',
    ],
    formality: [
        'Use a casual, conversational register — like a trusted peer, not an institution.',
        'Use a relaxed but professional register.',
        'Use a standard professional register.',
        'Use a formal, precise register. Avoid slang and contractions.',
        'Use a highly formal, institutional register. Precise terminology, no colloquialisms.',
    ],
    reasoningTransparency: [
        'State conclusions only. Do not show your reasoning unless explicitly asked.',
        'State the conclusion first. Reasoning may follow only if it changes the recommendation.',
        'State the conclusion, then briefly note the one or two factors that drove it.',
        'Walk through the reasoning that led to the conclusion, not just the conclusion itself.',
        'Fully expose the reasoning chain — every factor weighed and why — before or alongside the conclusion.',
    ],
} as const;

interface ReconciliationRule {
    id: string;
    appliesTo: (bands: Record<PersonaFaderAxis, Band>) => boolean;
    clause: string;
}

/**
 * Named, hand-authored clauses for axis pairs that measurably fight each
 * other. Add a new rule here — do not silently rely on the model to
 * resolve the tension itself; it will pick one side and drop the other.
 */
const RECONCILIATION_RULES: readonly ReconciliationRule[] = [
    {
        id: 'brevity-vs-reasoningTransparency',
        appliesTo: (b) => b.brevity >= 3 && b.reasoningTransparency >= 3,
        clause:
            'Reconcile brevity with reasoning transparency: state the conclusion in one sentence, ' +
            'then the driving factor in one compact clause — not a full explanation. Depth without length.',
    },
    {
        id: 'directness-vs-formality',
        appliesTo: (b) => b.directness >= 3 && b.formality >= 3,
        clause:
            'Reconcile directness with formality: be direct in substance, professional in delivery. ' +
            'A hard truth stated formally is still a hard truth — do not let formality dilute it into a hedge.',
    },
    {
        id: 'directness-vs-low-reasoningTransparency',
        appliesTo: (b) => b.directness >= 3 && b.reasoningTransparency <= 1,
        clause:
            'Reconcile directness with low reasoning transparency: a blunt conclusion with no stated reasoning ' +
            'reads as dismissive. State the conclusion plainly, then name the single biggest factor in one clause.',
    },
];

export class PersonaPromptCompilerError extends Error {}

/**
 * Compile fader values into a style-instruction block. This output governs
 * delivery only — it must never be handed to a call that also produces the
 * substance/verdict (see docs/EVOLAS_BUILD_PLAN.md non-negotiable #1). The
 * style call that consumes this output should receive an already-computed
 * verdict object, not the raw user question.
 */
export function compilePersonaPrompt(faderValues: PersonaFaderValues): string {
    if (!isValidPersonaFaderValues(faderValues)) {
        throw new PersonaPromptCompilerError(
            'compilePersonaPrompt received invalid fader values — refusing to compile a style ' +
            'instruction from an unvalidated or malformed input.'
        );
    }

    const bands: Record<PersonaFaderAxis, Band> = {} as Record<PersonaFaderAxis, Band>;
    for (const axis of PERSONA_FADER_AXES) {
        bands[axis] = quantizeToBand(faderValues[axis]);
    }

    const lines: string[] = ['## STYLE INSTRUCTIONS (delivery only — do not use this to alter facts, risk assessments, or caveats)'];

    for (const axis of PERSONA_FADER_AXES) {
        lines.push(`- ${BAND_PHRASES[axis][bands[axis]]}`);
    }

    const triggeredClauses = RECONCILIATION_RULES.filter((rule) => rule.appliesTo(bands));
    if (triggeredClauses.length > 0) {
        lines.push('');
        lines.push('## RECONCILIATION');
        for (const rule of triggeredClauses) {
            lines.push(`- ${rule.clause}`);
        }
    }

    lines.push('');
    lines.push(
        `(reference values: ${PERSONA_FADER_AXES.map((axis) => `${axis}=${faderValues[axis]}/${BAND_COUNT * 20}`).join(', ')})`
    );

    return lines.join('\n');
}
