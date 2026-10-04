import { randomUUID } from 'node:crypto';
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

        await jobRef.set({
            jobId,
            userId,
            sourceUri: imageUri,
            presetId,
            bleedMode,
            focusX,
            focusY,
            generateGuide,
            status: 'queued',
            progress: 0,
            plan: planSummary,
            estimatedDurationSec: 25,
            createdAt: now,
            updatedAt: now,
            serverTimestamp: admin.firestore.FieldValue.serverTimestamp(),
        });

        // Optionally dispatch to Cloud Run worker if configured in environment
        const workerUrl = process.env.PRINT_WORKER_URL;
        if (workerUrl) {
            try {
                fetch(`${workerUrl}/process`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        jobId,
                        userId,
                        sourceUri: imageUri,
                        presetId,
                        bleedMode,
                        focusX,
                        focusY,
                        generateGuide,
                    }),
                }).catch(() => {
                    // Async worker execution fires in background
                });
            } catch {
                // Ignore worker dispatch failure in offline/testing environments
            }
        }

        return {
            jobId,
            status: 'queued',
            estimatedDurationSec: 25,
            plan: planSummary,
        };
    }
);
