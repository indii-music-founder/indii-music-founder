import { describe, expect, it, vi } from 'vitest';

import { readVideoRenderReceipt } from './getVideoRenderReceipt';
import {
    cancelOwnedVideoJobTransactionally,
    transitionPrivateRenderJob,
} from './renderJobLifecycle';

const JOB_ID = 'render-race-1';
const OWNER_UID = 'owner-1';
const PROJECT_ID = 'project-1';
const BUCKET = 'project-bucket';
const RESULT_URI = `gs://${BUCKET}/private-renders/${OWNER_UID}/${PROJECT_ID}/${JOB_ID}/master-pass/final_output.mp4`;

type MemoryDocument = Record<string, unknown>;
type MemoryReference = {
    path: string;
    get(): Promise<MemorySnapshot>;
};
type MemorySnapshot = {
    exists: boolean;
    data(): MemoryDocument | undefined;
};

function memoryFirestore(initial: Record<string, MemoryDocument>) {
    const documents = new Map(
        Object.entries(initial).map(([path, value]) => [path, { ...value }]),
    );
    const snapshot = (path: string): MemorySnapshot => ({
        exists: documents.has(path),
        data: () => documents.has(path) ? { ...documents.get(path)! } : undefined,
    });
    const reference = (path: string): MemoryReference => ({
        path,
        get: async () => snapshot(path),
    });
    const db = {
        collection: vi.fn((collectionName: string) => ({
            doc: vi.fn((id: string) => reference(`${collectionName}/${id}`)),
        })),
        runTransaction: vi.fn(async (handler: (transaction: {
            get(ref: MemoryReference): Promise<MemorySnapshot>;
            update(ref: MemoryReference, update: MemoryDocument): void;
        }) => Promise<unknown>) => {
            const pending: Array<{ path: string; update: MemoryDocument }> = [];
            const result = await handler({
                get: async ref => snapshot(ref.path),
                update: (ref, update) => pending.push({ path: ref.path, update }),
            });
            for (const write of pending) {
                documents.set(write.path, {
                    ...(documents.get(write.path) ?? {}),
                    ...write.update,
                });
            }
            return result;
        }),
    };
    return {
        db: db as never,
        read(path: string): MemoryDocument | undefined {
            return documents.get(path);
        },
        merge(path: string, update: MemoryDocument): void {
            documents.set(path, { ...(documents.get(path) ?? {}), ...update });
        },
    };
}

function privateJob(overrides: MemoryDocument = {}): MemoryDocument {
    return {
        id: JOB_ID,
        type: 'render_stitch',
        accessPolicy: 'private-project-render.v1',
        userId: OWNER_UID,
        orgId: 'org-1',
        projectId: PROJECT_ID,
        status: 'queued',
        progress: 0,
        ...overrides,
    };
}

const identity = {
    jobId: JOB_ID,
    ownerUid: OWNER_UID,
    projectId: PROJECT_ID,
};

describe('private render lifecycle cancellation race', () => {
    it('prevents every provider boundary when cancellation is already durable', async () => {
        const memory = memoryFirestore({
            [`videoJobs/${JOB_ID}`]: privateJob(),
        });
        await cancelOwnedVideoJobTransactionally(memory.db, {
            jobId: JOB_ID,
            ownerUid: OWNER_UID,
            cancelledAt: '2026-07-30T20:00:00.000Z',
        });
        const provider = vi.fn();

        const boundary = await transitionPrivateRenderJob(memory.db, {
            identity,
            allowedStatuses: ['queued', 'stitching'],
            nextStatus: 'stitching',
            update: { renderStage: 'submitting_video_concatenation' },
        });
        if (boundary.applied) await provider();

        expect(boundary).toEqual({ applied: false, status: 'cancelled' });
        expect(provider).not.toHaveBeenCalled();
    });

    it('stops after an unavoidable in-flight provider race and keeps its artifact receipt-ineligible', async () => {
        const memory = memoryFirestore({
            [`videoJobs/${JOB_ID}`]: privateJob(),
        });
        let releaseProvider!: () => void;
        const providerDeferred = new Promise<void>(resolve => {
            releaseProvider = resolve;
        });
        const firstProvider = vi.fn(async () => providerDeferred);
        const secondProvider = vi.fn();
        const signObject = vi.fn(async () => 'https://signed.example/private-render');

        const worker = (async () => {
            const firstBoundary = await transitionPrivateRenderJob(memory.db, {
                identity,
                allowedStatuses: ['queued', 'stitching'],
                nextStatus: 'stitching',
                update: { renderStage: 'submitting_video_concatenation' },
            });
            if (!firstBoundary.applied) return;
            await firstProvider();

            const secondBoundary = await transitionPrivateRenderJob(memory.db, {
                identity,
                allowedStatuses: ['stitching'],
                nextStatus: 'stitching',
                update: { renderStage: 'submitting_canonical_master_mix' },
            });
            if (!secondBoundary.applied) return;
            await secondProvider();
            await transitionPrivateRenderJob(memory.db, {
                identity,
                allowedStatuses: ['stitching'],
                nextStatus: 'completed',
                update: {
                    resultUri: RESULT_URI,
                    resultGeneration: '123456789',
                    progress: 100,
                },
            });
        })();

        await vi.waitFor(() => expect(firstProvider).toHaveBeenCalledOnce());
        await cancelOwnedVideoJobTransactionally(memory.db, {
            jobId: JOB_ID,
            ownerUid: OWNER_UID,
            cancelledAt: '2026-07-30T20:00:00.000Z',
        });
        // The already-submitted provider may still materialize an object, but
        // it cannot authorize another stage or a terminal receipt.
        memory.merge(`videoJobs/${JOB_ID}`, {
            resultUri: RESULT_URI,
            resultGeneration: '123456789',
        });
        releaseProvider();
        await worker;

        expect(secondProvider).not.toHaveBeenCalled();
        expect(memory.read(`videoJobs/${JOB_ID}`)).toMatchObject({
            status: 'cancelled',
            cancelledAt: '2026-07-30T20:00:00.000Z',
        });

        const receipt = await readVideoRenderReceipt(OWNER_UID, { jobId: JOB_ID }, {
            bucketName: BUCKET,
            now: () => 1_800_000_000_000,
            getJob: async () => memory.read(`videoJobs/${JOB_ID}`),
            authorizeProject: vi.fn(async () => undefined),
            inspectObject: vi.fn(async () => ({
                generation: '123456789',
                contentType: 'video/mp4',
            })),
            signObject,
        });
        expect(receipt).toMatchObject({
            status: 'failed',
            error: 'The private render was cancelled.',
        });
        expect(signObject).not.toHaveBeenCalled();
    });

    it('preserves owner authorization and never cancels an already completed job', async () => {
        const memory = memoryFirestore({
            [`videoJobs/${JOB_ID}`]: privateJob({ status: 'completed' }),
        });

        await expect(cancelOwnedVideoJobTransactionally(memory.db, {
            jobId: JOB_ID,
            ownerUid: 'attacker',
            cancelledAt: '2026-07-30T20:00:00.000Z',
        })).rejects.toMatchObject({ code: 'permission-denied' });
        await expect(cancelOwnedVideoJobTransactionally(memory.db, {
            jobId: JOB_ID,
            ownerUid: OWNER_UID,
            cancelledAt: '2026-07-30T20:00:00.000Z',
        })).resolves.toEqual({ status: 'completed', changed: false });
        expect(memory.read(`videoJobs/${JOB_ID}`)).toMatchObject({
            status: 'completed',
        });
        expect(memory.read(`videoJobs/${JOB_ID}`)).not.toHaveProperty('cancelledAt');
    });
});
