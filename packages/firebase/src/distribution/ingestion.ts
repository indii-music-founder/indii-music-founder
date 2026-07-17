import { CloudTasksClient } from '@google-cloud/tasks';
import { HttpsError, onCall } from 'firebase-functions/v2/https';

import { verifyMasterAudioObject, VerifyMasterAudioResponse } from '../functions/storage/verifyMasterAudio';
import { validateAppCheckV2 } from '../middleware/appCheck';

const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const SERVICE_ACCOUNT_PATTERN = /^[^\s@]+@[^\s@]+\.iam\.gserviceaccount\.com$/;

interface AudioIngestionInput {
    storagePath: string;
    masterFingerprint: string;
}

interface AudioIngestionRuntimeConfig {
    project: string;
    queue: string;
    location: string;
    engineDspUrl: string;
    engineDspAudience: string;
    engineDspServiceAccount: string;
}

interface CloudTasksClientLike {
    queuePath(project: string, location: string, queue: string): string;
    createTask(request: {
        parent: string;
        task: {
            httpRequest: {
                httpMethod: 'POST';
                url: string;
                body: string;
                headers: Record<string, string>;
                oidcToken: {
                    serviceAccountEmail: string;
                    audience: string;
                };
            };
        };
    }): Promise<unknown>;
}

interface AudioIngestionDependencies {
    env?: NodeJS.ProcessEnv;
    tasksClient?: CloudTasksClientLike;
    verifyMaster?: (
        userId: string,
        input: {
            storagePath: string;
            expectedSha256: string;
            masterFingerprint: string;
        }
    ) => Promise<VerifyMasterAudioResponse>;
}

export interface QueueAudioIngestionResponse {
    success: true;
    status: 'QUEUED_FOR_DSP_PROFILING';
    masterFingerprint: string;
    contentHash: string;
    generation: string;
}

function requiredString(value: unknown, label: string, maximum: number): string {
    if (typeof value !== 'string' || !value.trim() || value.length > maximum) {
        throw new HttpsError('invalid-argument', `${label} is invalid.`);
    }
    return value.trim();
}

function configuredString(value: unknown, label: string, maximum: number): string {
    if (typeof value !== 'string' || !value.trim() || value.length > maximum) {
        throw new HttpsError('failed-precondition', `${label} is missing or invalid.`);
    }
    return value.trim();
}

function requireRuntimeConfig(env: NodeJS.ProcessEnv): AudioIngestionRuntimeConfig {
    const project = configuredString(
        env.GCLOUD_PROJECT || env.GOOGLE_CLOUD_PROJECT,
        'Google Cloud project ID configuration',
        256
    );
    const queue = configuredString(env.DSP_TASKS_QUEUE || 'dsp-processing-queue', 'DSP task queue', 256);
    const location = configuredString(env.DSP_TASKS_LOCATION || 'us-central1', 'DSP task location', 64);
    const engineDspUrl = configuredString(env.ENGINE_DSP_URL, 'ENGINE_DSP_URL configuration', 2_048);
    const engineDspServiceAccount = configuredString(
        env.ENGINE_DSP_SERVICE_ACCOUNT,
        'ENGINE_DSP_SERVICE_ACCOUNT configuration',
        320
    );

    let parsedEngineUrl: URL;
    try {
        parsedEngineUrl = new URL(engineDspUrl);
    } catch {
        throw new HttpsError('failed-precondition', 'ENGINE_DSP_URL must be a valid HTTPS URL.');
    }
    if (parsedEngineUrl.protocol !== 'https:') {
        throw new HttpsError('failed-precondition', 'ENGINE_DSP_URL must be a valid HTTPS URL.');
    }
    if (!SERVICE_ACCOUNT_PATTERN.test(engineDspServiceAccount)) {
        throw new HttpsError(
            'failed-precondition',
            'ENGINE_DSP_SERVICE_ACCOUNT must be a Google service-account email.'
        );
    }
    if (!engineDspServiceAccount.endsWith(`@${project}.iam.gserviceaccount.com`)) {
        throw new HttpsError(
            'failed-precondition',
            'ENGINE_DSP_SERVICE_ACCOUNT must belong to the Cloud Tasks queue project.'
        );
    }

    const engineDspAudience = configuredString(
        env.ENGINE_DSP_AUDIENCE || parsedEngineUrl.origin,
        'ENGINE_DSP_AUDIENCE configuration',
        2_048
    );

    return {
        project,
        queue,
        location,
        engineDspUrl: parsedEngineUrl.toString(),
        engineDspAudience,
        engineDspServiceAccount,
    };
}

function parseInput(rawInput: unknown): AudioIngestionInput & { expectedSha256: string } {
    if (!rawInput || typeof rawInput !== 'object') {
        throw new HttpsError('invalid-argument', 'Missing payload data.');
    }
    const data = rawInput as Record<string, unknown>;
    const storagePath = requiredString(data.storagePath, 'storagePath', 1_024);
    const masterFingerprint = requiredString(data.masterFingerprint, 'masterFingerprint', 256);
    const pathParts = storagePath.split('/');
    const expectedSha256 = pathParts.length === 4 ? pathParts[2] ?? '' : '';
    if (!SHA256_PATTERN.test(expectedSha256)) {
        throw new HttpsError(
            'invalid-argument',
            'storagePath must identify a content-addressed canonical master.'
        );
    }
    return { storagePath, masterFingerprint, expectedSha256 };
}

/**
 * Verifies the immutable canonical master, then queues authenticated DSP profiling.
 * Runtime configuration is validated before verification so a broken downstream
 * route cannot cause a large master to be streamed needlessly.
 */
export async function queueVerifiedAudioIngestion(
    userId: string,
    rawInput: unknown,
    dependencies: AudioIngestionDependencies = {}
): Promise<QueueAudioIngestionResponse> {
    const input = parseInput(rawInput);
    const config = requireRuntimeConfig(dependencies.env ?? process.env);
    const verifyMaster = dependencies.verifyMaster ?? verifyMasterAudioObject;
    const verification = await verifyMaster(userId, {
        storagePath: input.storagePath,
        expectedSha256: input.expectedSha256,
        masterFingerprint: input.masterFingerprint,
    });

    const tasksClient = dependencies.tasksClient ?? new CloudTasksClient();
    const parent = tasksClient.queuePath(config.project, config.location, config.queue);
    const payload = {
        storagePath: verification.storagePath,
        masterFingerprint: input.masterFingerprint,
        contentHash: verification.contentHash,
        generation: verification.generation,
        ownerId: userId,
    };
    const task = {
        httpRequest: {
            httpMethod: 'POST' as const,
            url: config.engineDspUrl,
            body: Buffer.from(JSON.stringify(payload)).toString('base64'),
            headers: { 'Content-Type': 'application/json' },
            oidcToken: {
                serviceAccountEmail: config.engineDspServiceAccount,
                audience: config.engineDspAudience,
            },
        },
    };

    try {
        await tasksClient.createTask({ parent, task });
    } catch (error) {
        console.error('Failed to queue verified audio profiling task:', error);
        throw new HttpsError(
            'internal',
            `Failed to dispatch audio processing task: ${error instanceof Error ? error.message : String(error)}`
        );
    }

    return {
        success: true,
        status: 'QUEUED_FOR_DSP_PROFILING',
        masterFingerprint: input.masterFingerprint,
        contentHash: verification.contentHash,
        generation: verification.generation,
    };
}

/**
 * Ingestion boundary endpoint. Large master files stay in Cloud Storage; only a
 * verified immutable reference is delegated to the private engine-dsp service.
 */
export const processAudioIngestion = onCall(
    { memory: '512MiB', timeoutSeconds: 540, enforceAppCheck: false },
    async request => {
        validateAppCheckV2(request);
        if (!request.auth) {
            throw new HttpsError('unauthenticated', 'User must be authenticated to ingest audio.');
        }
        return queueVerifiedAudioIngestion(request.auth.uid, request.data);
    }
);
