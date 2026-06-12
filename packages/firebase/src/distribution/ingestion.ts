import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getStorage } from 'firebase-admin/storage';
import { CloudTasksClient } from '@google-cloud/tasks';

/**
 * Ingestion Boundary Endpoint
 * 
 * Instead of processing heavy 24-bit WAV files in Node.js (which leads to OOM crashes),
 * this function securely delegates the payload to the Python engine-dsp Cloud Run service.
 */
export const processAudioIngestion = onCall({
    memory: "512MiB",
    timeoutSeconds: 300,
}, async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'User must be authenticated to ingest audio.');
    }

    const { filePath, masterAssetId } = request.data;
    if (!filePath || !masterAssetId) {
        throw new HttpsError('invalid-argument', 'Missing filePath or masterAssetId.');
    }

    // 1. Verify file exists in Cloud Storage and is accessible
    const bucket = getStorage().bucket();
    const file = bucket.file(filePath);
    const [exists] = await file.exists().catch((err) => {
        console.error("Storage access error:", err);
        throw new HttpsError('internal', 'Unable to verify file existence due to storage error.');
    });
    if (!exists) {
        throw new HttpsError('not-found', 'Ingested audio file not found in storage.');
    }

    // 2. Queue asynchronous DSP task to engine-dsp Python service
    console.log(`Dispatching ${masterAssetId} to engine-dsp Cloud Run service via Cloud Tasks...`);
    
    const client = new CloudTasksClient();
    const project = process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || process.env.VITE_FIREBASE_PROJECT_ID || '';
    if (!project) {
        throw new HttpsError('failed-precondition', 'Google Cloud Project ID is not configured.');
    }
    const queue = 'dsp-processing-queue';
    const location = 'us-central1';
    const parent = client.queuePath(project, location, queue);
    
    const engineDspUrl = process.env.ENGINE_DSP_URL || 'https://engine-dsp-service-url/profile';
    
    const task = {
      httpRequest: {
        httpMethod: 'POST' as const,
        url: engineDspUrl,
        body: Buffer.from(JSON.stringify({ filePath, masterAssetId })).toString('base64'),
        headers: {
          'Content-Type': 'application/json',
        },
      },
    };
    
    try {
        await client.createTask({ parent, task });
    } catch (err) {
        console.error("Failed to queue Cloud Task:", err);
        throw new HttpsError('internal', `Failed to dispatch audio processing task: ${err instanceof Error ? err.message : String(err)}`);
    }

    return {
        success: true,
        status: "QUEUED_FOR_DSP_PROFILING",
        masterAssetId
    };
});
