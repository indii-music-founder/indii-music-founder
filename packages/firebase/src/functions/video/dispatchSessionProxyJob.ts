import { createHash } from 'crypto';
import { getFirestore } from 'firebase-admin/firestore';
import { HttpsError } from 'firebase-functions/v2/https';

import type { FinalizedOriginalRef } from './finalizeVideoSessionUpload';

/**
 * Repair-order step 2 (ISSUE-1175): durable worker execution.
 *
 * `finalizeVideoSessionUpload` durably claims the uploaded original — generation
 * pinning, `ifGenerationMatch: 0` promotion, SHA-256 verification — and then
 * stops at `status: 'uploaded'`. Nothing ever produced the `proxyManifest` that
 * `videoEditorStore.ts` already reads (see its `session.proxyManifest` accesses),
 * so every session dead-ends there. This module is the dispatch half: it turns a
 * finalized original into exactly one durable proxy job.
 *
 * The hazard this exists to prevent: the finalizer runs under Eventarc with
 * `retry: true` (ISSUE-1210). A redelivered event re-runs the handler, so a
 * naive "enqueue after finalize" would enqueue a second transcode of the same
 * bytes — duplicate processing and a duplicate charge, which ISSUE-1175
 * acceptance (6) forbids. Idempotency is therefore enforced twice, at two
 * independent layers:
 *
 *   1. A transactional claim on the session document, keyed to the original's
 *      Storage generation + SHA-256. A second attempt for the same original
 *      reads back the existing claim instead of writing a new one.
 *   2. A deterministic Cloud Tasks task name derived from that same identity.
 *      Cloud Tasks rejects a duplicate name with ALREADY_EXISTS, so even if the
 *      claim transaction commits and the process dies before `createTask`
 *      returns, the retry cannot produce a second task.
 *
 * Layer 1 alone is insufficient (claim-commit then crash would lose the task);
 * layer 2 alone is insufficient (task names are only retained for ~1h after
 * completion, so a late redelivery could re-enqueue). Together they are safe.
 *
 * Actual proxy production and PTS mapping are repair-order step 3 and are NOT in
 * this file — this dispatches to the worker, it does not implement it.
 */

const SHA256 = /^[a-f0-9]{64}$/;
const NUMERIC_GENERATION = /^[1-9][0-9]*$/;
const SERVICE_ACCOUNT = /^[^@\s]+@[^@\s]+\.iam\.gserviceaccount\.com$/;

/** Cloud Tasks task-name segment: letters, numbers, hyphens, underscores. */
const TASK_ID = /^[A-Za-z0-9_-]{1,500}$/;

export type ProxyJobStatus = 'dispatching' | 'queued' | 'blocked';

export interface ProxyJobClaim {
    schemaVersion: 'session-proxy-job.v1';
    jobId: string;
    status: ProxyJobStatus;
    /** Pins the claim to the exact original bytes this job was created for. */
    originalGeneration: string;
    originalSha256: string;
    claimedAt: string;
    /** Present after Cloud Tasks accepted this deterministic task name. */
    queuedAt?: string;
    /** Present only when `status` is `blocked`. */
    blockedReason?: string;
}

export interface ProxyJobClaimStore {
    /**
     * Atomically claim proxy work for one finalized original.
     *
     * Returns `reused: true` when a claim already exists for this exact
     * generation + hash, so the caller can skip enqueueing. A claim bound to a
     * *different* original is a genuine conflict and must fail closed rather
     * than be overwritten — that would strand the first job's output.
     */
    claim(sessionId: string, claim: ProxyJobClaim): Promise<{ claim: ProxyJobClaim; reused: boolean }>;
    markQueued(
        sessionId: string,
        jobId: string,
        queuedAt: string,
    ): Promise<{ claim: ProxyJobClaim; reused: boolean }>;
}

export interface ProxyTasksClientLike {
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

interface ProxyWorkerConfig {
    project: string;
    location: string;
    queue: string;
    workerUrl: string;
    audience: string;
    serviceAccount: string;
}

export interface DispatchSessionProxyJobDependencies {
    env?: NodeJS.ProcessEnv;
    claims?: ProxyJobClaimStore;
    tasksClient?: ProxyTasksClientLike;
}

export interface DispatchSessionProxyJobResult {
    jobId: string;
    status: ProxyJobStatus;
    /** True when this original had already been dispatched (no new work). */
    reused: boolean;
    blockedReason?: string;
}

function trimmed(value: unknown, label: string, maximum: number): string {
    if (typeof value !== 'string' || !value.trim() || value.length > maximum) {
        throw new HttpsError('failed-precondition', `${label} is invalid.`);
    }
    return value.trim();
}

/**
 * Deterministic job identity: the same original always yields the same job id,
 * which is what makes both idempotency layers work. Derived from session +
 * generation + hash so that re-uploading different bytes to the same session
 * correctly produces a *different* job.
 */
export function proxyJobId(sessionId: string, generation: string, sha256: string): string {
    const digest = createHash('sha256')
        .update(`${sessionId}\0${generation}\0${sha256}`)
        .digest('hex')
        .slice(0, 48);
    return `proxy-${digest}`;
}

export function createFirestoreProxyJobClaimStore(
    db: FirebaseFirestore.Firestore = getFirestore(),
): ProxyJobClaimStore {
    return {
        async claim(sessionId, claim) {
            const sessionRef = db.collection('videoSessions').doc(sessionId);
            return db.runTransaction(async (transaction) => {
                const snapshot = await transaction.get(sessionRef);
                if (!snapshot.exists) {
                    throw new HttpsError('not-found', 'The video session no longer exists.');
                }
                const current = snapshot.data() as Record<string, unknown>;
                const existing = current.proxyJob as ProxyJobClaim | undefined;

                if (existing) {
                    const sameOriginal = existing.originalGeneration === claim.originalGeneration
                        && existing.originalSha256 === claim.originalSha256;
                    if (sameOriginal) {
                        if (existing.status === 'blocked' && claim.status === 'dispatching') {
                            transaction.update(sessionRef, { proxyJob: claim, updatedAt: claim.claimedAt });
                            return { claim, reused: false };
                        }
                        // Already dispatched for these exact bytes. Re-running is
                        // a no-op, which is precisely what redelivery needs.
                        return { claim: existing, reused: true };
                    }
                    // A claim exists for different bytes. Overwriting would orphan
                    // the in-flight job and its output, so refuse.
                    throw new HttpsError(
                        'failed-precondition',
                        'A proxy job is already bound to a different original for this session.',
                    );
                }

                transaction.update(sessionRef, { proxyJob: claim, updatedAt: claim.claimedAt });
                return { claim, reused: false };
            });
        },
        async markQueued(sessionId, jobId, queuedAt) {
            const sessionRef = db.collection('videoSessions').doc(sessionId);
            return db.runTransaction(async (transaction) => {
                const snapshot = await transaction.get(sessionRef);
                if (!snapshot.exists) {
                    throw new HttpsError('not-found', 'The video session no longer exists.');
                }
                const current = snapshot.data() as Record<string, unknown>;
                const existing = current.proxyJob as ProxyJobClaim | undefined;
                if (!existing || existing.jobId !== jobId) {
                    throw new HttpsError('failed-precondition', 'The proxy dispatch claim changed before enqueue completed.');
                }
                if (existing.status === 'queued') {
                    return { claim: existing, reused: true };
                }
                if (existing.status !== 'dispatching') {
                    throw new HttpsError('failed-precondition', `A ${existing.status} proxy claim cannot become queued.`);
                }
                const queued: ProxyJobClaim = { ...existing, status: 'queued', queuedAt };
                transaction.update(sessionRef, { proxyJob: queued, updatedAt: queuedAt });
                return { claim: queued, reused: false };
            });
        },
    };
}

/**
 * Reads worker routing from the environment. Returns `undefined` — rather than
 * throwing — when the worker is simply not provisioned yet, because repair-order
 * step 3 is what stands that worker up. Callers record an auditable `blocked`
 * state in that case instead of failing the upload, so finalization keeps
 * working and the session honestly reports why no proxy exists.
 *
 * Anything that IS set but malformed still throws: a typo'd URL must not be
 * silently downgraded to "not configured".
 */
function readWorkerConfig(env: NodeJS.ProcessEnv): ProxyWorkerConfig | undefined {
    const workerUrl = env.SESSION_PROXY_WORKER_URL?.trim();
    const serviceAccount = env.SESSION_PROXY_SERVICE_ACCOUNT?.trim();
    if (!workerUrl && !serviceAccount) return undefined;

    const project = trimmed(
        env.GCLOUD_PROJECT || env.GOOGLE_CLOUD_PROJECT,
        'Proxy worker project',
        256,
    );
    const parsed = (() => {
        try {
            return new URL(trimmed(workerUrl, 'SESSION_PROXY_WORKER_URL', 2_048));
        } catch {
            throw new HttpsError('failed-precondition', 'SESSION_PROXY_WORKER_URL must be a valid HTTPS URL.');
        }
    })();
    if (parsed.protocol !== 'https:') {
        throw new HttpsError('failed-precondition', 'SESSION_PROXY_WORKER_URL must be a valid HTTPS URL.');
    }
    const account = trimmed(serviceAccount, 'SESSION_PROXY_SERVICE_ACCOUNT', 256);
    if (!SERVICE_ACCOUNT.test(account)) {
        throw new HttpsError(
            'failed-precondition',
            'SESSION_PROXY_SERVICE_ACCOUNT must be a Google service-account email.',
        );
    }

    return {
        project,
        location: trimmed(env.SESSION_PROXY_TASKS_LOCATION || 'us-central1', 'Proxy queue location', 64),
        queue: trimmed(env.SESSION_PROXY_TASKS_QUEUE || 'session-proxy-queue', 'Proxy queue', 256),
        workerUrl: parsed.toString(),
        audience: trimmed(env.SESSION_PROXY_AUDIENCE || parsed.origin, 'SESSION_PROXY_AUDIENCE', 2_048),
        serviceAccount: account,
    };
}

/**
 * Dispatch exactly one proxy job for a finalized original.
 *
 * Safe to call repeatedly for the same original — that is the whole point, since
 * the caller runs under Eventarc redelivery.
 */
export async function dispatchSessionProxyJob(
    sessionId: string,
    original: FinalizedOriginalRef,
    dependencies: DispatchSessionProxyJobDependencies = {},
): Promise<DispatchSessionProxyJobResult> {
    if (!NUMERIC_GENERATION.test(original.generation) || !SHA256.test(original.sha256)) {
        throw new HttpsError('failed-precondition', 'Finalized original identity is incomplete.');
    }

    const jobId = proxyJobId(sessionId, original.generation, original.sha256);
    if (!TASK_ID.test(jobId)) {
        throw new HttpsError('internal', 'Derived proxy job id is not a valid task name.');
    }

    const config = readWorkerConfig(dependencies.env ?? process.env);
    const claims = dependencies.claims ?? createFirestoreProxyJobClaimStore();
    const claimedAt = new Date().toISOString();

    // Not provisioned yet (repair-order step 3). Record the honest terminal-ish
    // state so the session says *why* it has no proxy, rather than appearing
    // successful or silently stalling at `uploaded`.
    if (!config) {
        const blocked = await claims.claim(sessionId, {
            schemaVersion: 'session-proxy-job.v1',
            jobId,
            status: 'blocked',
            originalGeneration: original.generation,
            originalSha256: original.sha256,
            claimedAt,
            blockedReason: 'proxy-worker-not-configured',
        });
        return {
            jobId: blocked.claim.jobId,
            status: blocked.claim.status,
            reused: blocked.reused,
            blockedReason: blocked.claim.blockedReason,
        };
    }

    const claimed = await claims.claim(sessionId, {
        schemaVersion: 'session-proxy-job.v1',
        jobId,
        status: 'dispatching',
        originalGeneration: original.generation,
        originalSha256: original.sha256,
        claimedAt,
    });
    if (claimed.reused && claimed.claim.status === 'queued') {
        return { jobId: claimed.claim.jobId, status: 'queued', reused: true };
    }

    // Constructed lazily, never at module scope: this module is imported by the
    // Storage-trigger entrypoint, which must stay import-safe (no ambient config
    // reads or client construction at load time).
    const tasksClient = dependencies.tasksClient ?? await defaultTasksClient();
    const parent = tasksClient.queuePath(config.project, config.location, config.queue);
    const payload = {
        sessionId,
        ownerUid: original.ownerUid,
        organizationId: original.organizationId,
        projectId: original.projectId,
        bucket: original.bucket,
        path: original.path,
        generation: original.generation,
        sha256: original.sha256,
        mimeType: original.mimeType,
        byteSize: original.byteSize,
        jobId,
    };

    let alreadyExisted = false;
    try {
        await tasksClient.createTask({
            parent,
            task: {
                // Deterministic name — Cloud Tasks itself refuses duplicates.
                name: `${parent}/tasks/${jobId}`,
                dispatchDeadline: { seconds: 1_800 },
                httpRequest: {
                    httpMethod: 'POST',
                    url: new URL('/proxy', config.workerUrl).toString(),
                    body: Buffer.from(JSON.stringify(payload)).toString('base64'),
                    headers: { 'Content-Type': 'application/json' },
                    oidcToken: {
                        serviceAccountEmail: config.serviceAccount,
                        audience: config.audience,
                    },
                },
            },
        });
    } catch (error: unknown) {
        // ALREADY_EXISTS (gRPC 6) means a previous attempt already enqueued this
        // exact job — the desired end state, not a failure.
        if (isAlreadyExists(error)) {
            alreadyExisted = true;
        } else {
            throw new HttpsError(
                'internal',
                `Failed to dispatch session proxy job: ${error instanceof Error ? error.message : String(error)}`,
            );
        }
    }

    const queued = await claims.markQueued(sessionId, jobId, new Date().toISOString());
    return {
        jobId,
        status: 'queued',
        reused: claimed.reused || alreadyExisted || queued.reused,
    };
}

async function defaultTasksClient(): Promise<ProxyTasksClientLike> {
    const { CloudTasksClient } = await import('@google-cloud/tasks');
    return new CloudTasksClient() as unknown as ProxyTasksClientLike;
}

function isAlreadyExists(error: unknown): boolean {
    if (!error || typeof error !== 'object') return false;
    const code = (error as { code?: unknown }).code;
    return code === 6 || code === 'ALREADY_EXISTS';
}
