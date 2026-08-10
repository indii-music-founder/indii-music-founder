import type { PersonaFaderValues } from '@indii/shared';

export const PERSONA_FADER_SOURCES = ['saved', 'absent-default', 'invalid-default'] as const;
export type PersonaFaderSource = typeof PERSONA_FADER_SOURCES[number];

export interface PersonaFaderResolution {
    values: PersonaFaderValues;
    source: PersonaFaderSource;
}
