import { randomUUID } from 'node:crypto';
import { CloudTasksClient } from '@google-cloud/tasks';
import * as admin from 'firebase-admin';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import {
    EnqueuePrintJobInputSchema,
    EnqueuePrintJobResult,
    getPrintPreset,
    planPrintOutput,
} from '@indii/shared';
import { validateAppCheckV2 } from '../../middleware/appCheck';
import { requireVerifiedCreativeUser } from '../billing/enforceOperationCost';
import { assertUserOwnsStoragePath, parseStorageUri } from '../../lib/storageUri';
import { enforceRateLimit } from '../../lib/rateLimit';

const SERVICE_ACCOUNT_PATTERN = /^[^\s@]+@[^\s@]+\.iam\.gserviceaccount\.com$/;

interface PrintTasksClient {
    queuePath(project: string, location: string, queue: string): string;
    createTask(request: {
        parent: string;
        task: {
            name: string;
            dispatchDeadline: { seconds: number };
            httpRequest: {
                httpMethod: 'POST';
                url: string;
                body: string;
                headers: Record<string, string>;
                oidcToken: { serviceAccountEmail: string; audience: string };
            };
        };
    }): Promise<unknown>;
}

let tasksClientFactory: () => PrintTasksClient = () => new CloudTasksClient() as unknown as PrintTasksClient;

export function setPrintTasksClientFactoryForTests(factory: () => PrintTasksClient): void {
    tasksClientFactory = factory;
}

function printWorkerConfig(env: NodeJS.ProcessEnv = process.env) {
    const project = env.GCLOUD_PROJECT || env.GOOGLE_CLOUD_PROJECT;
    const workerUrl = env.PRINT_WORKER_URL?.trim();
    const serviceAccount = env.PRINT_WORKER_SERVICE_ACCOUNT?.trim();
    const location = env.PRINT_TASKS_LOCATION?.trim() || 'us-central1';
    const queue = env.PRINT_TASKS_QUEUE?.trim() || 'print-prep-queue';
    if (!project || !workerUrl || !serviceAccount) {
        throw new HttpsError('unavailable', 'Print preparation is temporarily unavailable.');
    }

    let parsedUrl: URL;
    try {
        parsedUrl = new URL(workerUrl);
    } catch {
        throw new HttpsError('failed-precondition', 'Print worker URL configuration is invalid.');
    }
    if (parsedUrl.protocol !== 'https:' || !SERVICE_ACCOUNT_PATTERN.test(serviceAccount)) {
        throw new HttpsError('failed-precondition', 'Print worker authentication configuration is invalid.');
    }

    return {
        project,
        location,
        queue,
        workerUrl: parsedUrl.toString(),
        audience: env.PRINT_WORKER_AUDIENCE?.trim() || parsedUrl.origin,
        serviceAccount,
    };
}

function isAlreadyExists(error: unknown): boolean {
    if (!error || typeof error !== 'object') return false;
    const code = (error as { code?: unknown }).code;
    return code === 6 || code === 'ALREADY_EXISTS';
}

export const enqueuePrintJob = onCall(
    { timeoutSeconds: 30, memory: '512MiB', enforceAppCheck: false },
    async (request): Promise<EnqueuePrintJobResult> => {
        validateAppCheckV2(request);
        const userId = requireVerifiedCreativeUser(request.auth);

        const parsed = EnqueuePrintJobInputSchema.safeParse(request.data);
        if (!parsed.success) {
            throw new HttpsError('invalid-argument', 'Invalid print job parameters.');
        }

        const { imageUri, presetId, bleedMode, focusX, focusY, generateGuide } = parsed.data;

        await enforceRateLimit(userId, 'enqueuePrintJob', { maxRequests: 20, windowMs: 60_000 });

        const preset = getPrintPreset(presetId);
        if (!preset) {
            throw new HttpsError('invalid-argument', `Unknown print preset: ${presetId}`);
        }

        // Validate storage URI ownership
        const storageRef = parseStorageUri(imageUri);
        assertUserOwnsStoragePath(storageRef.path, userId);

        // Fail before writing a queued document if the authenticated worker path
        // is not provisioned. A queued job must always have a durable dispatcher.
        const worker = printWorkerConfig();

        // Assume standard base dimension (1024x1024 or higher) for initial plan
        // The worker will calculate exact pixel plan upon reading the source image
        const initialPlan = planPrintOutput({
            srcWidth: 1024,
            srcHeight: 1024,
            presetId,
        });

        const jobId = `print_${randomUUID()}`;
        const db = admin.firestore();
        const jobRef = db.collection('print_jobs').doc(jobId);

        const planSummary = {
            requiredWidthPx: initialPlan.required.width,
            requiredHeightPx: initialPlan.required.height,
            trimWidthIn: initialPlan.trim.widthIn,
            trimHeightIn: initialPlan.trim.heightIn,
            bleedIn: initialPlan.bleedIn,
            safeIn: initialPlan.safeIn,
            dpi: initialPlan.dpi,
            requiredUpscaleFactor: initialPlan.requiredUpscaleFactor,
            verdict: initialPlan.verdict,
        };

        const now = new Date().toISOString();

        const taskId = jobId.replace(/[^A-Za-z0-9_-]/g, '_');
        const tasksClient = tasksClientFactory();
        const parent = tasksClient.queuePath(worker.project, worker.location, worker.queue);

        await jobRef.set({
            jobId,
            userId,
            sourceUri: imageUri,
            presetId,
            bleedMode,
            focusX,
            focusY,
            generateGuide,
            status: 'dispatching',
            progress: 0,
            plan: planSummary,
            estimatedDurationSec: 25,
            createdAt: now,
            updatedAt: now,
            serverTimestamp: admin.firestore.FieldValue.serverTimestamp(),
        });

        try {
            await tasksClient.createTask({
                parent,
                task: {
                    name: `${parent}/tasks/${taskId}`,
                    dispatchDeadline: { seconds: 1_800 },
                    httpRequest: {
                        httpMethod: 'POST',
                        url: new URL('/process', worker.workerUrl).toString(),
                        body: Buffer.from(JSON.stringify({ jobId })).toString('base64'),
                        headers: { 'Content-Type': 'application/json' },
                        oidcToken: {
                            serviceAccountEmail: worker.serviceAccount,
                            audience: worker.audience,
                        },
                    },
                },
            });
        } catch (error: unknown) {
            if (!isAlreadyExists(error)) {
                await jobRef.update({
                    status: 'failed',
                    error: 'Print job dispatch failed. Please retry.',
                    updatedAt: new Date().toISOString(),
                });
                throw new HttpsError('unavailable', 'Unable to dispatch print preparation. Please retry.');
            }
        }

        await jobRef.update({ status: 'queued', updatedAt: new Date().toISOString() });

        return {
            jobId,
            status: 'queued',
            estimatedDurationSec: 25,
            plan: planSummary,
        };
    }
);
