import {
    PERSONA_IDS,
    isValidPersonaFaderValues,
    type PersonaFaderValues,
    type PersonaId,
} from '@indii/shared';

export const PERSONA_RESPONSE_METADATA_KEY = 'personaResponse';

export interface PersonaResponseMetadata {
    personaId: PersonaId;
    responseId: string;
    isControlGroup: boolean;
    effectiveFaderValues: PersonaFaderValues;
    measurementStatus: 'pending' | 'recorded' | 'failed';
}

export function isPersonaResponseMetadata(value: unknown): value is PersonaResponseMetadata {
    if (typeof value !== 'object' || value === null) return false;
    const candidate = value as Record<string, unknown>;
    return (
        typeof candidate.personaId === 'string' &&
        (PERSONA_IDS as readonly string[]).includes(candidate.personaId) &&
        typeof candidate.responseId === 'string' &&
        candidate.responseId.length > 0 &&
        typeof candidate.isControlGroup === 'boolean' &&
        isValidPersonaFaderValues(candidate.effectiveFaderValues) &&
        (candidate.measurementStatus === 'pending' ||
            candidate.measurementStatus === 'recorded' ||
            candidate.measurementStatus === 'failed')
    );
}

export function getPersonaResponseMetadata(
    metadata: Record<string, unknown> | undefined,
): PersonaResponseMetadata | undefined {
    const candidate = metadata?.[PERSONA_RESPONSE_METADATA_KEY];
    return isPersonaResponseMetadata(candidate) ? candidate : undefined;
}
