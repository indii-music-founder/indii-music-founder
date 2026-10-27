import { HttpsError, onCall, type CallableRequest } from 'firebase-functions/v2/https';
import { arcjetKey } from '../../config/secrets';
import { validateAppCheckV2 } from '../../middleware/appCheck';
import { protectAuthenticatedApiRequest } from '../security/arcjet';
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
    { secrets: [arcjetKey], enforceAppCheck: false, memory: '512MiB', cpu: 'gcf_gen1', concurrency: 1 },
    async (request: CallableRequest<unknown>) => {
        validateAppCheckV2(request);
        if (!request.auth) {
            throw new HttpsError(
                'unauthenticated',
                'User must be authenticated to record persona measurements.',
            );
        }
        if (request.auth.token?.firebase?.sign_in_provider === 'anonymous') {
            throw new HttpsError('permission-denied', 'Anonymous accounts may not perform this operation.');
        }
        if (request.rawRequest) {
            const protection = await protectAuthenticatedApiRequest(request.rawRequest as never, {
                userId: request.auth.uid,
                policy: 'verified-free',
                operationId: `persona-measurement:${request.auth.uid}`,
            });
            if (!protection.allowed) {
                throw new HttpsError('resource-exhausted', 'Request rate limit exceeded. Please try again later.');
            }
        }

        return handlePersonaMeasurement(request.data, request.auth.uid);
    },
);
