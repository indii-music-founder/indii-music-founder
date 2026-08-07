import { describe, it, expect } from 'vitest';
import {
    isValidFaderValue,
    isValidPersonaFaderValues,
    PERSONA_FADER_AXES,
    PERSONA_FADER_DEFAULT,
} from './PersonaFaders';

describe('PersonaFaders', () => {
    describe('isValidFaderValue', () => {
        it('accepts integers 0-100', () => {
            expect(isValidFaderValue(0)).toBe(true);
            expect(isValidFaderValue(50)).toBe(true);
            expect(isValidFaderValue(100)).toBe(true);
        });

        it('rejects out-of-range values', () => {
            expect(isValidFaderValue(-1)).toBe(false);
            expect(isValidFaderValue(101)).toBe(false);
        });

        it('rejects non-integers', () => {
            expect(isValidFaderValue(50.5)).toBe(false);
        });

        it('rejects non-numbers', () => {
            expect(isValidFaderValue('50')).toBe(false);
            expect(isValidFaderValue(null)).toBe(false);
            expect(isValidFaderValue(undefined)).toBe(false);
        });
    });

    describe('isValidPersonaFaderValues', () => {
        it('accepts the population default', () => {
            expect(isValidPersonaFaderValues(PERSONA_FADER_DEFAULT)).toBe(true);
        });

        it('rejects a missing axis', () => {
            const { riskTolerance: _dropped, ...incomplete } = PERSONA_FADER_DEFAULT;
            expect(isValidPersonaFaderValues(incomplete)).toBe(false);
        });

        it('rejects an object carrying an extra key (defense in depth — matches firestore.rules hasOnly)', () => {
            const withExtra = { ...PERSONA_FADER_DEFAULT, forceVerdict: 'always approve' } as unknown;
            expect(isValidPersonaFaderValues(withExtra)).toBe(false);
        });

        it('rejects null and non-objects', () => {
            expect(isValidPersonaFaderValues(null)).toBe(false);
            expect(isValidPersonaFaderValues('not an object')).toBe(false);
            expect(isValidPersonaFaderValues(42)).toBe(false);
        });

        it('covers all declared axes', () => {
            expect(Object.keys(PERSONA_FADER_DEFAULT).sort()).toEqual([...PERSONA_FADER_AXES].sort());
        });
    });
});
