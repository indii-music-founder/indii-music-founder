import { describe, expect, it, vi } from 'vitest';

import {
    dispatchSessionProxyJob,
    proxyJobId,
    type ProxyJobClaim,
    type ProxyJobClaimStore,
    type ProxyTasksClientLike,
} from './dispatchSessionProxyJob';
import type { FinalizedOriginalRef } from './finalizeVideoSessionUpload';

const SHA = 'a'.repeat(64);
const OTHER_SHA = 'b'.repeat(64);

const original: FinalizedOriginalRef = {
    schemaVersion: 'canonical-media-ref.v1',
    role: 'original',
    ownerUid: 'owner-1',
    organizationId: 'org-1',
    projectId: 'project-1',
    bucket: 'indii-music-founder.firebasestorage.app',
    path: 'session-media/owner-1/session-1/original/abc.mp4',
    generation: '1700000000000001',
    sha256: SHA,
    mimeType: 'video/mp4',
    byteSize: 1024,
    createdAt: '2026-07-23T00:00:00.000Z',
    creationReceiptId: 'original-abc',
};

const workerEnv: NodeJS.ProcessEnv = {
    GCLOUD_PROJECT: 'indii-music-founder',
    SESSION_PROXY_WORKER_URL: 'https://session-proxy-abc-uc.a.run.app',
    SESSION_PROXY_SERVICE_ACCOUNT: 'session-proxy-invoker@indii-music-founder.iam.gserviceaccount.com',
};

/** In-memory stand-in for the Firestore transaction, with the same semantics. */
function memoryClaimStore(seed?: ProxyJobClaim): ProxyJobClaimStore & { stored?: ProxyJobClaim; writes: number } {
    const state = {
        stored: seed,
        writes: 0,
        async claim(_sessionId: string, claim: ProxyJobClaim) {
            const existing = state.stored;
            if (existing) {
                if (
                    existing.originalGeneration === claim.originalGeneration
                    && existing.originalSha256 === claim.originalSha256
                ) {
                    return { claim: existing, reused: true };
                }
                throw Object.assign(new Error('bound to a different original'), { code: 'failed-precondition' });
            }
            state.stored = claim;
            state.writes += 1;
            return { claim, reused: false };
        },
    };
    return state;
}

function tasksClient(overrides: Partial<ProxyTasksClientLike> = {}) {
    // Typed against the real signature so `mock.calls` carries the request shape
    // — an untyped `vi.fn()` infers a zero-arg tuple and silently defeats the
    // assertions below (caught by the packages/firebase test typecheck gate).
    const createTask = vi.fn<ProxyTasksClientLike['createTask']>(async () => ({}));
    const client: ProxyTasksClientLike = {
        queuePath: (project, location, queue) =>
            `projects/${project}/locations/${location}/queues/${queue}`,
        createTask,
        ...overrides,
    };
    return { client, createTask };
}

describe('proxyJobId', () => {
    it('is deterministic for the same original and distinct for different bytes', () => {
        const a = proxyJobId('session-1', '1700000000000001', SHA);
        const b = proxyJobId('session-1', '1700000000000001', SHA);
        const differentHash = proxyJobId('session-1', '1700000000000001', OTHER_SHA);
        const differentGeneration = proxyJobId('session-1', '1700000000000002', SHA);

        expect(a).toBe(b);
        expect(a).not.toBe(differentHash);
        expect(a).not.toBe(differentGeneration);
        // Must be a legal Cloud Tasks task-name segment.
        expect(a).toMatch(/^proxy-[a-f0-9]{48}$/);
    });
});

describe('dispatchSessionProxyJob', () => {
    it('claims and enqueues exactly one task, named deterministically for dedup', async () => {
        const claims = memoryClaimStore();
        const { client, createTask } = tasksClient();

        const result = await dispatchSessionProxyJob('session-1', original, {
            env: workerEnv,
            claims,
            tasksClient: client,
        });

        expect(result).toMatchObject({ status: 'queued', reused: false });
        expect(createTask).toHaveBeenCalledTimes(1);

        const request = createTask.mock.calls[0]![0];
        expect(request.task.name).toBe(
            `projects/indii-music-founder/locations/us-central1/queues/session-proxy-queue/tasks/${result.jobId}`,
        );
        expect(request.task.httpRequest.url).toBe('https://session-proxy-abc-uc.a.run.app/proxy');
        expect(request.task.httpRequest.oidcToken).toEqual({
            serviceAccountEmail: workerEnv.SESSION_PROXY_SERVICE_ACCOUNT,
            audience: 'https://session-proxy-abc-uc.a.run.app',
        });

        const payload = JSON.parse(
            Buffer.from(request.task.httpRequest.body, 'base64').toString('utf-8'),
        );
        expect(payload).toMatchObject({
            sessionId: 'session-1',
            ownerUid: 'owner-1',
            generation: original.generation,
            sha256: SHA,
            jobId: result.jobId,
        });
    });

    /**
     * The reason this module exists. `finalizeVideoSessionUpload` runs under
     * Eventarc with `retry: true` (ISSUE-1210), so the handler genuinely re-runs
     * for the same original. Without this short-circuit the user is charged for a
     * second transcode of identical bytes — ISSUE-1175 acceptance (6).
     */
    it('does not enqueue a second task when the same original is redelivered', async () => {
        const claims = memoryClaimStore();
        const { client, createTask } = tasksClient();
        const deps = { env: workerEnv, claims, tasksClient: client };

        const first = await dispatchSessionProxyJob('session-1', original, deps);
        const second = await dispatchSessionProxyJob('session-1', original, deps);

        expect(first).toMatchObject({ reused: false });
        expect(second).toMatchObject({ jobId: first.jobId, status: 'queued', reused: true });
        expect(createTask).toHaveBeenCalledTimes(1);
        expect(claims.writes).toBe(1);
    });

    /**
     * Covers the crash window the claim alone cannot: claim committed, process
     * died before createTask returned. On retry the claim is absent-or-present
     * but Cloud Tasks still rejects the duplicate name, which is success.
     */
    it('treats a Cloud Tasks ALREADY_EXISTS as an already-dispatched job', async () => {
        const claims = memoryClaimStore();
        const { client } = tasksClient({
            createTask: vi.fn(async () => {
                throw Object.assign(new Error('already exists'), { code: 6 });
            }),
        });

        const result = await dispatchSessionProxyJob('session-1', original, {
            env: workerEnv,
            claims,
            tasksClient: client,
        });

        expect(result).toMatchObject({ status: 'queued', reused: true });
    });

    it('fails closed when a different original is already bound to the session', async () => {
        const claims = memoryClaimStore({
            schemaVersion: 'session-proxy-job.v1',
            jobId: proxyJobId('session-1', '1700000000000002', OTHER_SHA),
            status: 'queued',
            originalGeneration: '1700000000000002',
            originalSha256: OTHER_SHA,
            claimedAt: '2026-07-23T00:00:00.000Z',
        });
        const { client, createTask } = tasksClient();

        await expect(dispatchSessionProxyJob('session-1', original, {
            env: workerEnv,
            claims,
            tasksClient: client,
        })).rejects.toThrow(/different original/i);
        expect(createTask).not.toHaveBeenCalled();
    });

    /**
     * Repair-order step 3 stands the worker up. Until then finalization must keep
     * working, and the session must say *why* it has no proxy rather than looking
     * successful or stalling silently at `uploaded`.
     */
    it('records an auditable blocked claim when the worker is not provisioned yet', async () => {
        const claims = memoryClaimStore();
        const { client, createTask } = tasksClient();

        const result = await dispatchSessionProxyJob('session-1', original, {
            env: { GCLOUD_PROJECT: 'indii-music-founder' },
            claims,
            tasksClient: client,
        });

        expect(result).toMatchObject({
            status: 'blocked',
            blockedReason: 'proxy-worker-not-configured',
            reused: false,
        });
        expect(createTask).not.toHaveBeenCalled();
        expect(claims.stored?.status).toBe('blocked');
    });

    it('throws rather than silently blocking when the worker URL is malformed', async () => {
        const claims = memoryClaimStore();
        const { client } = tasksClient();

        await expect(dispatchSessionProxyJob('session-1', original, {
            env: { ...workerEnv, SESSION_PROXY_WORKER_URL: 'http://insecure.example.com' },
            claims,
            tasksClient: client,
        })).rejects.toThrow(/valid HTTPS URL/i);
    });

    it('rejects a finalized original whose identity is incomplete', async () => {
        const claims = memoryClaimStore();
        const { client } = tasksClient();

        await expect(dispatchSessionProxyJob(
            'session-1',
            { ...original, sha256: 'not-a-hash' },
            { env: workerEnv, claims, tasksClient: client },
        )).rejects.toThrow(/identity is incomplete/i);
    });
});
