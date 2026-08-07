/**
 * Evolas fader system — Phase T1.1 (see docs/EVOLAS_BUILD_PLAN.md).
 *
 * Faders are professional posture, never personality trait (non-negotiable
 * #5 — "aggressive"/"friendly" labeling is a documented mechanism for
 * stereotyped output). Values move style rendering only; they can never
 * reach the substance-generation call (non-negotiable #1).
 */

export const PERSONA_FADER_AXES = [
    'riskTolerance',
    'brevity',
    'directness',
    'formality',
    'reasoningTransparency',
] as const;

export type PersonaFaderAxis = typeof PERSONA_FADER_AXES[number];

/** Inclusive 0-100 range. Compiled to language in 5 quantized bands — never sent to a model as a raw number alone. */
export type PersonaFaderValue = number;

export type PersonaFaderValues = Record<PersonaFaderAxis, PersonaFaderValue>;

/** Population default — new users and unset axes start here, not at 0. */
export const PERSONA_FADER_DEFAULT: PersonaFaderValues = {
    riskTolerance: 50,
    brevity: 50,
    directness: 50,
    formality: 50,
    reasoningTransparency: 50,
};

export const PERSONA_IDS = [
    'manager',
    'contractReader',
    'aAndR',
    'publicist',
    'distributor',
    'businessManager',
    'producer',
    'publisher',
] as const;

export type PersonaId = typeof PERSONA_IDS[number];

/** Firestore document at users/{uid}/personaFaders/{personaId} */
export interface PersonaFaderDocument {
    personaId: PersonaId;
    values: PersonaFaderValues;
    updatedAt: number;
}

export function isValidFaderValue(value: unknown): value is PersonaFaderValue {
    return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 100;
}

export function isValidPersonaFaderValues(values: unknown): values is PersonaFaderValues {
    if (typeof values !== 'object' || values === null) {
        return false;
    }
    const record = values as Record<string, unknown>;
    // Closed key set, matching firestore.rules `hasOnly(...)` — the app-layer
    // guard must be at least as strict as the rules, never looser. A schema
    // with an unrecognized key cannot be proven free of a substance override.
    const keys = Object.keys(record);
    if (keys.length !== PERSONA_FADER_AXES.length) {
        return false;
    }
    return PERSONA_FADER_AXES.every((axis) => isValidFaderValue(record[axis]));
}
