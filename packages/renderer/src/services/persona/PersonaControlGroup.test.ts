import { describe, it, expect } from 'vitest';
import { PERSONA_FADER_DEFAULT, type PersonaFaderValues } from '@indii/shared';
import {
    assignControlGroup,
    resolveEffectiveFaderValues,
    assignAndResolve,
    CONTROL_GROUP_RATE,
} from './PersonaControlGroup';

const USER_FADERS: PersonaFaderValues = {
    riskTolerance: 90,
    brevity: 10,
    directness: 95,
    formality: 5,
    reasoningTransparency: 80,
};

describe('PersonaControlGroup', () => {
    it('the control group rate matches the build plan\'s ~5%', () => {
        expect(CONTROL_GROUP_RATE).toBe(0.05);
    });

    describe('assignControlGroup', () => {
        it('assigns control group when the random source lands below the rate', () => {
            expect(assignControlGroup(() => 0.049)).toBe(true);
            expect(assignControlGroup(() => 0)).toBe(true);
        });

        it('assigns treatment (not control) when the random source lands at or above the rate', () => {
            expect(assignControlGroup(() => 0.05)).toBe(false);
            expect(assignControlGroup(() => 0.5)).toBe(false);
            expect(assignControlGroup(() => 0.999)).toBe(false);
        });

        it('defaults to Math.random when no source is provided (smoke test only — real randomness)', () => {
            // Not asserting a specific outcome — just that it runs and returns a boolean.
            expect(typeof assignControlGroup()).toBe('boolean');
        });
    });

    describe('resolveEffectiveFaderValues', () => {
        it('returns the population default when control group is true, ignoring user values entirely', () => {
            const result = resolveEffectiveFaderValues(USER_FADERS, true);
            expect(result).toEqual(PERSONA_FADER_DEFAULT);
            expect(result).not.toEqual(USER_FADERS);
        });

        it('returns the user\'s actual fader values when control group is false', () => {
            const result = resolveEffectiveFaderValues(USER_FADERS, false);
            expect(result).toEqual(USER_FADERS);
        });

        it('a control-group response leaks none of the user\'s preference — every axis matches the default, not a blend', () => {
            const result = resolveEffectiveFaderValues(USER_FADERS, true);
            for (const axis of Object.keys(PERSONA_FADER_DEFAULT) as Array<keyof PersonaFaderValues>) {
                expect(result[axis]).toBe(PERSONA_FADER_DEFAULT[axis]);
                expect(result[axis]).not.toBe(USER_FADERS[axis]);
            }
        });
    });

    describe('assignAndResolve', () => {
        it('returns a consistent assignment: isControlGroup=true pairs with default values', () => {
            const result = assignAndResolve(USER_FADERS, () => 0.01);
            expect(result.isControlGroup).toBe(true);
            expect(result.effectiveFaderValues).toEqual(PERSONA_FADER_DEFAULT);
        });

        it('returns a consistent assignment: isControlGroup=false pairs with user values', () => {
            const result = assignAndResolve(USER_FADERS, () => 0.9);
            expect(result.isControlGroup).toBe(false);
            expect(result.effectiveFaderValues).toEqual(USER_FADERS);
        });
    });

    // ── Statistical sanity check ─────────────────────────────────────────
    // Not a proof of randomness quality — just confirms the threshold
    // comparison produces roughly the expected split over many draws using
    // a real (but seeded-in-effect, via injected sequence) distribution.
    it('over many assignments with a uniform random source, roughly 5% land in the control group', () => {
        const trials = 10_000;
        let controlCount = 0;
        // Deterministic pseudo-uniform sequence (no real randomness) —
        // walks [0, 1) evenly so the result is exactly reproducible.
        for (let i = 0; i < trials; i++) {
            const pseudoRandom = i / trials;
            if (assignControlGroup(() => pseudoRandom)) controlCount++;
        }
        const observedRate = controlCount / trials;
        expect(observedRate).toBeCloseTo(CONTROL_GROUP_RATE, 2);
    });

    // ── Style/substance isolation ─────────────────────────────────────────
    // This module decides WHICH style block to use, never touches substance
    // generation at all — there is no verdict/question parameter anywhere
    // in this file.
    it('no function in this module accepts a verdict, question, or response-content parameter', () => {
        expect(assignControlGroup.length).toBe(0); // (randomSource?) — defaulted, not counted
        expect(resolveEffectiveFaderValues.length).toBe(2); // (userFaderValues, isControlGroup)
        expect(assignAndResolve.length).toBe(1); // (userFaderValues, randomSource?)
    });
});
