import { describe, expect, it, vi } from 'vitest';
import type { PersonaMeasurementRequest } from '@indii/shared';

const mocks = vi.hoisted(() => {
    const callable = vi.fn().mockResolvedValue({
        data: { responseId: 'resp-1', recordedAxes: 5 },
    });
    return {
        callable,
        httpsCallable: vi.fn().mockReturnValue(callable),
    };
});

vi.mock('firebase/functions', () => ({
    httpsCallable: mocks.httpsCallable,
}));

vi.mock('@/services/firebase', () => ({
    functions: { region: 'us-central1' },
}));

import { recordPersonaResponseMeasurement } from './PersonaMeasurementRecorder';

const REQUEST: PersonaMeasurementRequest = {
    personaId: 'manager',
    responseId: 'resp-1',
    responseText: 'Rendered response.',
    setPositions: {
        riskTolerance: 50,
        brevity: 50,
        directness: 50,
        formality: 50,
        reasoningTransparency: 50,
    },
    isControlGroup: true,
};

describe('PersonaMeasurementRecorder', () => {
    it('sends the correlated measurement request to the backend-only callable', async () => {
        await expect(recordPersonaResponseMeasurement(REQUEST)).resolves.toEqual({
            responseId: 'resp-1',
            recordedAxes: 5,
        });

        expect(mocks.httpsCallable).toHaveBeenCalledWith(
            { region: 'us-central1' },
            'recordPersonaResponseMeasurement',
        );
        expect(mocks.callable).toHaveBeenCalledWith(REQUEST);
    });
});
