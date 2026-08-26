/**
 * Cloud video render path — the web-user route through the durable queue
 * protocol (queueCloudVideoRender callable + videoRenderJobs documents).
 * The desktop app keeps its local render; every other surface renders here.
 *
 * All I/O lives behind injectable dependencies so the full lifecycle is
 * unit-testable without Firebase.
 */

import { auth, db, functions } from '@/services/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';

export interface CloudJobSnapshot {
    status: 'queued' | 'running' | 'completed' | 'failed';
    artifactUrl: string | null;
    artifactGeneration: string | null;
    error: string | null;
}

export interface CloudRenderDependencies {
    queue?: (projectId: string, outputName?: string) => Promise<{ renderId: string }>;
    readJob?: (jobPath: string) => Promise<CloudJobSnapshot>;
    uid?: () => string | null;
    sleep?: (ms: number) => Promise<void>;
    now?: () => number;
}

export const DEFAULT_CLOUD_RENDER_TIMEOUT_MS = 20 * 60 * 1000;
export const CLOUD_RENDER_POLL_MS = 2_000;

const defaults = (): Required<CloudRenderDependencies> => ({
    queue: async (projectId, outputName) => {
        const queueCloudVideoRender = httpsCallable<
            { projectId: string; outputName?: string },
            { renderId: string; status: 'queued'; progress: 0 }
        >(functions, 'queueCloudVideoRender');
        const result = await queueCloudVideoRender({ projectId, ...(outputName ? { outputName } : {}) });
        return { renderId: result.data.renderId };
    },
    readJob: async (jobPath): Promise<CloudJobSnapshot> => {
        const snapshot = await getDoc(doc(db, jobPath));
        const data = snapshot.data() ?? {};
        return {
            status: (data.status as CloudJobSnapshot['status']) ?? 'queued',
            artifactUrl: typeof data.artifactUrl === 'string' ? data.artifactUrl : null,
            artifactGeneration: typeof data.artifactGeneration === 'string' ? data.artifactGeneration : null,
            error: typeof data.error === 'string' ? data.error : null,
        };
    },
    uid: () => auth.currentUser?.uid ?? null,
    sleep: ms => new Promise(resolve => setTimeout(resolve, ms)),
    now: () => Date.now(),
});

export async function queueCloudRender(
    projectId: string,
    outputName?: string,
    dependencies: CloudRenderDependencies = {},
): Promise<{ renderId: string }> {
    const deps = { ...defaults(), ...dependencies };
    const uid = deps.uid();
    if (!uid) throw new Error('Sign in is required to queue a cloud render.');
    return deps.queue(projectId, outputName);
}

export interface WaitForCloudRenderOptions {
    timeoutMs?: number;
    pollMs?: number;
    onStatus?: (status: CloudJobSnapshot['status']) => void;
}

export async function waitForCloudRender(
    renderId: string,
    options: WaitForCloudRenderOptions = {},
    dependencies: CloudRenderDependencies = {},
): Promise<{ url: string; generation: string }> {
    const deps = { ...defaults(), ...dependencies };
    const uid = deps.uid();
    if (!uid) throw new Error('Sign in is required to track a cloud render.');

    const timeoutMs = options.timeoutMs ?? DEFAULT_CLOUD_RENDER_TIMEOUT_MS;
    const pollMs = options.pollMs ?? CLOUD_RENDER_POLL_MS;
    const jobPath = `users/${uid}/videoRenderJobs/${renderId}`;
    const deadline = deps.now() + timeoutMs;
    let lastStatus: CloudJobSnapshot['status'] | null = null;

    while (deps.now() <= deadline) {
        const job = await deps.readJob(jobPath);
        if (job.status !== lastStatus) {
            lastStatus = job.status;
            options.onStatus?.(job.status);
        }
        if (job.status === 'completed' && job.artifactUrl) {
            return { url: job.artifactUrl, generation: job.artifactGeneration ?? '' };
        }
        if (job.status === 'failed') {
            throw new Error(job.error || 'The cloud render failed.');
        }
        await deps.sleep(pollMs);
    }
    throw new Error(
        `The cloud render is still running after ${Math.round(timeoutMs / 60000)} minutes. ` +
        `Render id: ${renderId} — the artifact will land in the project history when it finishes.`,
    );
}
