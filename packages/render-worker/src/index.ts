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
import { writeFileSync } from 'node:fs';

import { initializeApp, cert, applicationDefault, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';

import { executeRenderJob } from './job';
import type { ArtifactUploader, JobStore } from './job';
import type { MediaFetcher } from './stage';

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

const fetchToFile: MediaFetcher = async (url: string, destination: string) => {
    // https:// signed URLs and gs:// objects both resolve through the admin
    // storage API; plain http(s) URLs go through fetch.
    if (url.startsWith('gs://')) {
        const file = getStorage().bucket(url.split('/')[2]).file(url.slice(`gs://${url.split('/')[2]}/`.length));
        await file.download({ destination });
        return;
    }
    const response = await fetch(url, { redirect: 'follow' });
    if (!response.ok || !response.body) {
        throw new Error(`media fetch failed (${response.status}) for ${url}`);
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    writeFileSync(destination, buffer);
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

const firestoreStore: JobStore = {
    async getJob(jobPath) {
        const jobSnapshot = await db.doc(jobPath).get();
        const data = jobSnapshot.data();
        if (!jobSnapshot.exists || !data) throw new Error(`job ${jobPath} not found`);
        const projectRef = db.collection('users').doc(data.userId as string).collection('videoProjects').doc(data.projectId as string);
        const projectSnapshot = await projectRef.get();
        const projectData = projectSnapshot.data();
        if (!projectSnapshot.exists || !projectData?.project) throw new Error(`project ${data.projectId} not found for job ${jobPath}`);
        return {
            data: {
                status: data.status as 'queued' | 'running' | 'completed' | 'failed',
                projectId: data.projectId as string,
                userId: data.userId as string,
                ...(typeof data.outputName === 'string' ? { outputName: data.outputName } : {}),
            },
            project: projectData.project as never,
        };
    },
    async setRunning(jobPath) {
        await db.doc(jobPath).update({ status: 'running', executor: 'cloud-worker', updatedAt: FieldValue.serverTimestamp() });
    },
    async setCompleted(jobPath, artifactUrl, generation) {
        await db.doc(jobPath).update({
            status: 'completed',
            artifactUrl,
            artifactGeneration: generation,
            error: null,
            updatedAt: FieldValue.serverTimestamp(),
        });
    },
    async setFailed(jobPath, error) {
        await db.doc(jobPath).update({ status: 'failed', error, updatedAt: FieldValue.serverTimestamp() });
    },
};

const json = (res: import('node:http').ServerResponse, status: number, body: unknown) => {
    res.writeHead(status, { 'content-type': 'application/json' });
    res.end(JSON.stringify(body));
};

const readBody = (req: import('node:http').IncomingMessage): Promise<Record<string, unknown>> =>
    new Promise((resolve, reject) => {
        const chunks: Buffer[] = [];
        req.on('data', chunk => chunks.push(Buffer.from(chunk)));
        req.on('end', () => {
            try {
                resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}') as Record<string, unknown>);
            } catch {
                reject(new Error('invalid JSON body'));
            }
        });
        req.on('error', reject);
    });

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
    try {
        const body = await readBody(req);
        const jobPath = typeof body.jobPath === 'string' ? body.jobPath : '';
        if (!/^users\/[^/]+\/videoRenderJobs\/[A-Za-z0-9_-]{1,128}$/.test(jobPath)) {
            json(res, 400, { error: 'jobPath must be a users/{uid}/videoRenderJobs/{jobId} path' });
            return;
        }
        const result = await executeRenderJob(jobPath, { store: firestoreStore, fetchToFile, uploadArtifact });
        json(res, 200, result);
    } catch (error) {
        json(res, 500, { error: error instanceof Error ? error.message : String(error) });
    }
});

server.listen(PORT, () => {
    console.log(`[render-worker] listening on :${PORT}`);
});
