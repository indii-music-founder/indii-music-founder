/**
 * Evolas Phase T1.6 — Implicit feedback instrumentation (docs/EVOLAS_BUILD_PLAN.md).
 *
 * Writes observational signals only — never a rating, never a verdict,
 * never anything that could feed back into what a response says. See
 * PersonaInteractionSignal.ts for the plan-correction note on why this is
 * a new, parallel type rather than an extension of AgentFeedbackEvent.
 *
 * Client-side and Firestore-direct (unlike the persona/measurement modules
 * in packages/firebase) because this is not a Gemini/Vertex call — it's a
 * plain Firestore write of "what did the user just do," which the renderer
 * is allowed to do directly under its own auth per firestore.rules.
 */

import { collection, addDoc } from 'firebase/firestore';
import { db, auth } from '@/services/firebase';
import type { PersonaSignalType, PersonaInteractionSignal } from '@indii/shared';
import { isValidPersonaInteractionSignal } from '@indii/shared';

export class PersonaInteractionRecorderError extends Error {}

export type PersonaInteractionRecordResult = 'recorded' | 'skipped-unauthenticated';

/**
 * Record one implicit interaction signal. Fire-and-forget by design from
 * the caller's perspective — callers should not block a user-facing action
 * on this write; call it and move on. Throws only on genuinely invalid
 * input (a programming error), never on "no user signed in" (a no-op,
 * since there's nowhere to attribute the signal).
 */
export async function recordSignal(
    personaId: string,
    responseId: string,
    signalType: PersonaSignalType
): Promise<void> {
    await recordSignalWithResult(personaId, responseId, signalType);
}

/**
 * Record a signal and report whether Firestore accepted it. This keeps the
 * original fire-and-forget contract above intact while allowing a real user
 * action to surface an honest persistence acknowledgement.
 */
export async function recordSignalWithResult(
    personaId: string,
    responseId: string,
    signalType: PersonaSignalType
): Promise<PersonaInteractionRecordResult> {
    const uid = auth.currentUser?.uid;
    if (!uid) {
        return 'skipped-unauthenticated';
    }

    const signal: PersonaInteractionSignal = {
        personaId,
        responseId,
        signalType,
        occurredAt: Date.now(),
    };

    if (!isValidPersonaInteractionSignal(signal)) {
        throw new PersonaInteractionRecorderError(
            `Invalid interaction signal for persona "${personaId}", response "${responseId}", type "${signalType}"`
        );
    }

    await addDoc(collection(db, 'users', uid, 'personaInteractionSignals'), signal);
    return 'recorded';
}

export const recordCopied = (personaId: string, responseId: string): Promise<void> =>
    recordSignal(personaId, responseId, 'copied');

export const recordActedOn = (personaId: string, responseId: string): Promise<void> =>
    recordSignal(personaId, responseId, 'actedOn');

export const recordReAsked = (personaId: string, responseId: string): Promise<void> =>
    recordSignal(personaId, responseId, 'reAsked');

export const recordPersonaSwitched = (personaId: string, responseId: string): Promise<void> =>
    recordSignal(personaId, responseId, 'personaSwitched');

export const recordThreadAbandoned = (personaId: string, responseId: string): Promise<void> =>
    recordSignal(personaId, responseId, 'threadAbandoned');
