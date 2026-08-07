/**
 * Evolas Phase T1.6 — Implicit feedback instrumentation (docs/EVOLAS_BUILD_PLAN.md).
 *
 * PLAN CORRECTION (logged as ISSUE — see ledger): the build plan said to
 * extend the existing `AgentFeedbackEvent` (packages/renderer/src/types/
 * agent-feedback.ts). On inspection, that type is EXPLICIT rating feedback
 * only (`rating: 'positive' | 'negative' | 'neutral'`, fired once when a
 * user rates a response) — a different shape and a different trigger from
 * implicit signals (observed passively on every interaction, much higher
 * volume, no user action required). Conflating them into one document type
 * would make it harder, not easier, to keep "explicit thumbs = low-recall
 * high-precision label" and "implicit signals = primary volume signal"
 * (per the build plan's own framing) as genuinely separate channels. This
 * is a new, parallel type — `AgentFeedbackEvent` is untouched.
 *
 * Implicit signals are observational only. None of them can carry a
 * substance override — they describe what the USER did (copied, re-asked,
 * abandoned), never what the response SHOULD say.
 */

export const PERSONA_SIGNAL_TYPES = [
    'copied',
    'actedOn',
    'reAsked',
    'personaSwitched',
    'threadAbandoned',
] as const;

export type PersonaSignalType = typeof PERSONA_SIGNAL_TYPES[number];

/** Firestore document at users/{uid}/personaInteractionSignals/{signalId} */
export interface PersonaInteractionSignal {
    personaId: string;
    responseId: string;
    signalType: PersonaSignalType;
    occurredAt: number;
}

export function isValidPersonaSignalType(value: unknown): value is PersonaSignalType {
    return typeof value === 'string' && (PERSONA_SIGNAL_TYPES as readonly string[]).includes(value);
}

export function isValidPersonaInteractionSignal(value: unknown): value is PersonaInteractionSignal {
    if (typeof value !== 'object' || value === null) return false;
    const v = value as Record<string, unknown>;
    return (
        typeof v.personaId === 'string' && v.personaId.length > 0 &&
        typeof v.responseId === 'string' && v.responseId.length > 0 &&
        isValidPersonaSignalType(v.signalType) &&
        typeof v.occurredAt === 'number'
    );
}
