import { HttpsError, onCall, type CallableRequest } from 'firebase-functions/v2/https';
import {
    PERSONA_FADER_AXES,
    PERSONA_IDS,
    isValidPersonaFaderValues,
    type PersonaMeasurementReceipt,
    type PersonaMeasurementRequest,
} from '@indii/shared';
import {
    measureAllAxes,
    recordMeasurement,
    type AxisMeasurement,
    type PersonaMeasurementCorrelation,
} from '../../lib/PersonaMeasurement';
import { enforceRateLimit, RATE_LIMITS } from '../../lib/rateLimit';

const RESPONSE_ID_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/;
const MAX_RESPONSE_TEXT_LENGTH = 100_000;

export interface PersonaMeasurementDependencies {
    measureAllAxes: typeof measureAllAxes;
    recordMeasurement: (
        personaId: string,
        measurement: AxisMeasurement,
        isControlGroup: boolean,
        correlation?: PersonaMeasurementCorrelation,
    ) => Promise<void>;
    enforceRateLimit: typeof enforceRateLimit;
}

const defaultDependencies: PersonaMeasurementDependencies = {
    measureAllAxes,
    recordMeasurement,
    enforceRateLimit,
};

function isPersonaId(value: unknown): value is PersonaMeasurementRequest['personaId'] {
    return typeof value === 'string' && (PERSONA_IDS as readonly string[]).includes(value);
}

export function validatePersonaMeasurementRequest(value: unknown): PersonaMeasurementRequest {
    if (typeof value !== 'object' || value === null) {
        throw new HttpsError('invalid-argument', 'Persona measurement request is malformed.');
    }

    const request = value as Record<string, unknown>;
    const keys = Object.keys(request);
    const expectedKeys = ['personaId', 'responseId', 'responseText', 'setPositions', 'isControlGroup'];
    const hasOnlyExpectedKeys =
        keys.length === expectedKeys.length && keys.every((key) => expectedKeys.includes(key));

    if (
        !hasOnlyExpectedKeys ||
        !isPersonaId(request.personaId) ||
        typeof request.responseId !== 'string' ||
        !RESPONSE_ID_PATTERN.test(request.responseId) ||
        typeof request.responseText !== 'string' ||
        request.responseText.trim().length === 0 ||
        request.responseText.length > MAX_RESPONSE_TEXT_LENGTH ||
        !isValidPersonaFaderValues(request.setPositions) ||
        typeof request.isControlGroup !== 'boolean'
    ) {
        throw new HttpsError('invalid-argument', 'Persona measurement request is malformed.');
    }

    return request as unknown as PersonaMeasurementRequest;
}

export function createPersonaMeasurementHandler(
    dependencies: PersonaMeasurementDependencies = defaultDependencies,
): (data: unknown, userId: string) => Promise<PersonaMeasurementReceipt> {
    return async (data, userId) => {
        const request = validatePersonaMeasurementRequest(data);
        await dependencies.enforceRateLimit(
            userId,
            'recordPersonaResponseMeasurement',
            RATE_LIMITS.generation,
        );

        const measurements = await dependencies.measureAllAxes(
            request.responseText,
            request.setPositions,
        );
        const correlation = { userId, responseId: request.responseId };

        await Promise.all(measurements.map((measurement) =>
            dependencies.recordMeasurement(
                request.personaId,
                measurement,
                request.isControlGroup,
                correlation,
            )
        ));

        return {
            responseId: request.responseId,
            recordedAxes: PERSONA_FADER_AXES.length,
        };
    };
}

const handlePersonaMeasurement = createPersonaMeasurementHandler();

export const recordPersonaResponseMeasurement = onCall(
    { enforceAppCheck: true, memory: '512MiB', cpu: 'gcf_gen1', concurrency: 1 },
    async (request: CallableRequest<unknown>) => {
        if (!request.auth) {
            throw new HttpsError(
                'unauthenticated',
                'User must be authenticated to record persona measurements.',
            );
        }

        return handlePersonaMeasurement(request.data, request.auth.uid);
    },
);
