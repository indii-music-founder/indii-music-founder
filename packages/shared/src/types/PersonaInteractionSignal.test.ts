import { describe, it, expect } from 'vitest';
import {
    isValidPersonaSignalType,
    isValidPersonaInteractionSignal,
    PERSONA_SIGNAL_TYPES,
} from './PersonaInteractionSignal';

describe('PersonaInteractionSignal', () => {
    describe('isValidPersonaSignalType', () => {
        it('accepts every declared signal type', () => {
            for (const t of PERSONA_SIGNAL_TYPES) {
                expect(isValidPersonaSignalType(t)).toBe(true);
            }
        });

        it('rejects an unknown string', () => {
            expect(isValidPersonaSignalType('thumbsUp')).toBe(false);
        });

        it('rejects non-strings', () => {
            expect(isValidPersonaSignalType(1)).toBe(false);
            expect(isValidPersonaSignalType(null)).toBe(false);
        });
    });

    describe('isValidPersonaInteractionSignal', () => {
        const valid = {
            personaId: 'manager',
            responseId: 'resp-123',
            signalType: 'copied' as const,
            occurredAt: Date.now(),
        };

        it('accepts a well-formed signal', () => {
            expect(isValidPersonaInteractionSignal(valid)).toBe(true);
        });

        it('rejects an empty personaId', () => {
            expect(isValidPersonaInteractionSignal({ ...valid, personaId: '' })).toBe(false);
        });

        it('rejects an empty responseId', () => {
            expect(isValidPersonaInteractionSignal({ ...valid, responseId: '' })).toBe(false);
        });

        it('rejects an invalid signalType', () => {
            expect(isValidPersonaInteractionSignal({ ...valid, signalType: 'thumbsUp' })).toBe(false);
        });

        it('rejects a non-numeric occurredAt', () => {
            expect(isValidPersonaInteractionSignal({ ...valid, occurredAt: 'yesterday' })).toBe(false);
        });

        it('rejects null and non-objects', () => {
            expect(isValidPersonaInteractionSignal(null)).toBe(false);
            expect(isValidPersonaInteractionSignal('not an object')).toBe(false);
        });
    });
});
