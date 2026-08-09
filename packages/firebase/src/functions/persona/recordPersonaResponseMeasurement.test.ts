import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PERSONA_FADER_AXES, type PersonaFaderValues } from '@indii/shared';
import {
    createPersonaMeasurementHandler,
    recordPersonaResponseMeasurement,
    validatePersonaMeasurementRequest,
    type PersonaMeasurementDependencies,
} from './recordPersonaResponseMeasurement';
import type { AxisMeasurement } from '../../lib/PersonaMeasurement';

const SET_POSITIONS: PersonaFaderValues = {
    riskTolerance: 10,
    brevity: 20,
    directness: 30,
    formality: 40,
    reasoningTransparency: 50,
};

const REQUEST = {
    personaId: 'manager' as const,
    responseId: 'resp-1',
    responseText: 'A rendered response to measure.',
    setPositions: SET_POSITIONS,
    isControlGroup: false,
};

function createDependencies() {
    const measurements: AxisMeasurement[] = PERSONA_FADER_AXES.map((axis, index) => ({
        axis,
        setPosition: SET_POSITIONS[axis],
        measuredPosition: 10 + (index * 20),
        measuredBand: index as AxisMeasurement['measuredBand'],
        confidence: 0.1,
    }));
    const dependencies: PersonaMeasurementDependencies = {
        measureAllAxes: vi.fn().mockResolvedValue(measurements),
        recordMeasurement: vi.fn().mockResolvedValue(undefined),
        enforceRateLimit: vi.fn().mockResolvedValue(undefined),
    };
    return { dependencies, measurements };
}

describe('recordPersonaResponseMeasurement', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('measures the effective treatment positions and correlates every axis with the response', async () => {
        const { dependencies, measurements } = createDependencies();
        const handler = createPersonaMeasurementHandler(dependencies);

        await expect(handler(REQUEST, 'user-1')).resolves.toEqual({
            responseId: 'resp-1',
            recordedAxes: PERSONA_FADER_AXES.length,
        });

        expect(dependencies.measureAllAxes).toHaveBeenCalledWith(
            REQUEST.responseText,
            SET_POSITIONS,
        );
        expect(dependencies.recordMeasurement).toHaveBeenCalledTimes(PERSONA_FADER_AXES.length);
        expect(dependencies.recordMeasurement).toHaveBeenNthCalledWith(
            1,
            'manager',
            measurements[0],
            false,
            { userId: 'user-1', responseId: 'resp-1' },
        );
    });

    it('preserves the assigned control tag on every recorded axis', async () => {
        const { dependencies } = createDependencies();
        const handler = createPersonaMeasurementHandler(dependencies);

        await handler({
            ...REQUEST,
            setPositions: {
                riskTolerance: 50,
                brevity: 50,
                directness: 50,
                formality: 50,
                reasoningTransparency: 50,
            },
            isControlGroup: true,
        }, 'user-1');

        for (const call of vi.mocked(dependencies.recordMeasurement).mock.calls) {
            expect(call[2]).toBe(true);
        }
    });

    it('rejects extra fields and invalid faders at the backend ingress', () => {
        expect(() => validatePersonaMeasurementRequest({
            ...REQUEST,
            substanceOverride: 'change the verdict',
        })).toThrow('malformed');
        expect(() => validatePersonaMeasurementRequest({
            ...REQUEST,
            setPositions: { ...SET_POSITIONS, brevity: 101 },
        })).toThrow('malformed');
    });

    it('requires an authenticated user before invoking measurement work', async () => {
        const callable = recordPersonaResponseMeasurement as unknown as {
            run: (request: unknown) => Promise<unknown>;
        };

        await expect(callable.run({ data: REQUEST })).rejects.toMatchObject({
            code: 'unauthenticated',
        });
    });
});
