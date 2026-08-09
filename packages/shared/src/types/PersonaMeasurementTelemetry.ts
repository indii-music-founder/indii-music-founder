import type { PersonaFaderValues, PersonaId } from './PersonaFaders.js';

/**
 * Browser-to-backend telemetry request for one rendered persona response.
 * The response text is measured in the backend and is never persisted.
 */
export interface PersonaMeasurementRequest {
    personaId: PersonaId;
    responseId: string;
    responseText: string;
    setPositions: PersonaFaderValues;
    isControlGroup: boolean;
}

export interface PersonaMeasurementReceipt {
    responseId: string;
    recordedAxes: number;
}
