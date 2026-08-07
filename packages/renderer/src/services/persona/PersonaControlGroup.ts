/**
 * Evolas Phase T1.7 — Randomized control slice (docs/EVOLAS_BUILD_PLAN.md).
 *
 * "Do this from day one or the offline metrics are unfalsifiable." Without
 * a control group, "did personalization help" can never be answered — every
 * measurement would compare a personalized response against nothing, not
 * against what a population-default response would have looked like.
 *
 * ~5% of responses use PERSONA_FADER_DEFAULT (T1.1) instead of the user's
 * actual fader values, regardless of what the user has set. The random
 * source is injectable so tests are deterministic — never rely on real
 * randomness to prove behavior.
 */

import { PERSONA_FADER_DEFAULT, type PersonaFaderValues } from '@indii/shared';

/** 1 in 20 responses — matches the build plan's "~5%" exactly. */
export const CONTROL_GROUP_RATE = 0.05;

export interface ControlGroupAssignment {
    isControlGroup: boolean;
    effectiveFaderValues: PersonaFaderValues;
}

/**
 * Decide whether this response should be a control-group response.
 * `randomSource` defaults to `Math.random`; tests should always inject a
 * deterministic value instead of relying on real randomness.
 */
export function assignControlGroup(randomSource: () => number = Math.random): boolean {
    return randomSource() < CONTROL_GROUP_RATE;
}

/**
 * Resolve which fader values a response should actually use. Control-group
 * responses ignore the user's set values entirely and use the population
 * default — this is what makes the comparison meaningful; a "control" that
 * still leaks some of the user's preference isn't a control.
 */
export function resolveEffectiveFaderValues(
    userFaderValues: PersonaFaderValues,
    isControlGroup: boolean
): PersonaFaderValues {
    return isControlGroup ? PERSONA_FADER_DEFAULT : userFaderValues;
}

/**
 * Convenience: assign and resolve in one call. Callers who need to record
 * the assignment for telemetry (T1.5's recordMeasurement `isControlGroup`
 * tag) should keep the returned `isControlGroup` flag, not re-derive it —
 * re-rolling would break the correlation between what was actually served
 * and what gets logged.
 */
export function assignAndResolve(
    userFaderValues: PersonaFaderValues,
    randomSource: () => number = Math.random
): ControlGroupAssignment {
    const isControlGroup = assignControlGroup(randomSource);
    return {
        isControlGroup,
        effectiveFaderValues: resolveEffectiveFaderValues(userFaderValues, isControlGroup),
    };
}
