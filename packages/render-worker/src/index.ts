/**
 * Cloud render worker entrypoint — a small HTTP service for Cloud Run.
 *
 * POST /v1/render  {"jobPath": "users/{uid}/videoRenderJobs/{jobId}"}
 *   Authorization: Bearer <RENDER_WORKER_SECRET>
 *   Executes the job end-to-end and returns the artifact URL.
 * GET /healthz — liveness.
 *
 * Firestore access uses the service's Application Default Credentials
 * (workload identity in GCP); no credentials live in the container.
 */

import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';

import { initializeApp, cert, applicationDefault, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';

import { executeRenderJob } from './job.js';
import type { ArtifactUploader } from './job.js';
import type { MediaFetcher } from './stage.js';
import { downloadOwnedRenderMedia } from './mediaSource.js';
import { createFirestoreJobStore } from './firestoreJobStore.js';

const PORT = Number(process.env.PORT ?? 8080);
const SECRET = process.env.RENDER_WORKER_SECRET ?? '';
/** Where completed MP4s land inside the default storage bucket. */
const ARTIFACT_PREFIX = process.env.RENDER_ARTIFACT_PREFIX ?? 'video-render-jobs';

if (getApps().length === 0) {
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
        initializeApp({ credential: cert(process.env.GOOGLE_APPLICATION_CREDENTIALS) });
    } else {
        initializeApp({ credential: applicationDefault() });
    }
}

const db = getFirestore();
const bucket = () => getStorage().bucket();

const mediaFetcherFor = (jobPath: string): MediaFetcher => {
    const uid = /^users\/([^/]+)\/videoRenderJobs\/[A-Za-z0-9_-]{1,128}$/.exec(jobPath)?.[1];
    if (!uid) throw new Error('Invalid render job owner path.');
    let remainingBytes = 2 * 1024 * 1024 * 1024;
    return async (url, destination) => {
        remainingBytes -= await downloadOwnedRenderMedia(url, destination, uid, remainingBytes);
    };
};

const uploadArtifact: ArtifactUploader = async (localPath, jobPath, outputName) => {
    const objectPath = `${ARTIFACT_PREFIX}/${jobPath.split('/').filter(Boolean).join('-')}-${randomUUID()}-${outputName}`;
    await bucket().upload(localPath, { destination: objectPath });
    const file = bucket().file(objectPath);
    const [metadata] = await file.getMetadata();
    const generation = String(metadata.generation ?? '');
    const [url] = await file.getSignedUrl({
        action: 'read',
        expires: Date.now() + 24 * 60 * 60 * 1000,
    });
    return { url, generation };
};

const json = (res: import('node:http').ServerResponse, status: number, body: unknown) => {
    res.writeHead(status, { 'content-type': 'application/json' });
    res.end(JSON.stringify(body));
};

const readBody = (req: import('node:http').IncomingMessage): Promise<Record<string, unknown>> =>
    new Promise((resolve, reject) => {
        const chunks: Buffer[] = [];
        let length = 0;
        req.on('data', chunk => {
            length += chunk.length;
            if (length > 16_384) { reject(new Error('render request body exceeds 16 KB')); req.destroy(); return; }
            chunks.push(Buffer.from(chunk));
        });
        req.on('end', () => {
            try {
                resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}') as Record<string, unknown>);
            } catch {
                reject(new Error('invalid JSON body'));
            }
        });
        req.on('error', reject);
    });

// Cloud Run Job batch execution mode: runs directly to completion and exits
const jobPathFromEnv = process.env.JOB_PATH || process.argv[2];
if (jobPathFromEnv) {
    if (/^users\/[^/]+\/videoRenderJobs\/[A-Za-z0-9_-]{1,128}$/.test(jobPathFromEnv)) {
        console.log(`[render-worker-job] Executing Cloud Run Job for ${jobPathFromEnv}`);
        executeRenderJob(jobPathFromEnv, { store: createFirestoreJobStore(db), fetchToFile: mediaFetcherFor(jobPathFromEnv), uploadArtifact })
            .then(result => {
                console.log(`[render-worker-job] Render completed successfully:`, result);
                process.exit(0);
            })
            .catch(err => {
                console.error(`[render-worker-job] Render failed:`, err);
                process.exit(1);
            });
    } else {
        console.error(`[render-worker-job] Invalid JOB_PATH: ${jobPathFromEnv}`);
        process.exit(2);
    }
} else {
    const server = createServer(async (req, res) => {
        if (req.url === '/healthz') {
            json(res, 200, { ok: true });
            return;
        }
        if (req.method !== 'POST' || req.url !== '/v1/render') {
            json(res, 404, { error: 'not found' });
            return;
        }
        if (!SECRET || req.headers.authorization !== `Bearer ${SECRET}`) {
            json(res, 401, { error: 'unauthorized' });
            return;
        }
        let jobPath = '';
        try {
            const body = await readBody(req);
            jobPath = typeof body.jobPath === 'string' ? body.jobPath : '';
            if (!/^users\/[^/]+\/videoRenderJobs\/[A-Za-z0-9_-]{1,128}$/.test(jobPath)) {
                json(res, 400, { error: 'jobPath must be a users/{uid}/videoRenderJobs/{jobId} path' });
                return;
            }

            const result = await executeRenderJob(jobPath, { store: createFirestoreJobStore(db), fetchToFile: mediaFetcherFor(jobPath), uploadArtifact });
            json(res, 200, result);
        } catch (error) {
            console.error('[render-worker] Render attempt failed', { jobPath, error });
            const status = jobPath ? (await db.doc(jobPath).get().catch(() => undefined))?.data()?.status : undefined;
            if (status === 'completed' || status === 'failed') {
                json(res, 200, { status });
            } else {
                json(res, 500, { error: 'RENDER_RETRYABLE' });
            }
        }
    });

    server.listen(PORT, () => {
        console.log(`[render-worker] listening on :${PORT}`);
    });
}
