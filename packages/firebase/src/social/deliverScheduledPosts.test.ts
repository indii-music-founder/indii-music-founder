import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Timestamp } from 'firebase-admin/firestore';

vi.mock('firebase-functions/v2/scheduler', () => ({
    onSchedule: vi.fn((_options, handler) => ({ run: handler })),
}));

const logMocks = vi.hoisted(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
}));

vi.mock('firebase-functions', () => ({ logger: logMocks }));

import { deliverScheduledPostsHandler } from './deliverScheduledPosts';

type StoredDocument = Record<string, unknown>;
type CollectionName = 'scheduledPosts' | 'campaigns';

interface MemoryReference {
    collectionName: CollectionName;
    id: string;
}

function comparable(value: unknown): unknown {
    return value && typeof value === 'object' && 'toMillis' in value
        ? (value as { toMillis: () => number }).toMillis()
        : value;
}

function createMemoryDb(initial: {
    scheduledPosts?: Record<string, StoredDocument>;
    campaigns?: Record<string, StoredDocument>;
} = {}) {
    const stores = {
        scheduledPosts: new Map(Object.entries(initial.scheduledPosts ?? {})),
        campaigns: new Map(Object.entries(initial.campaigns ?? {})),
    };
    let queryFailure: Error | null = null;
    let beforeNextTransaction: (() => void) | null = null;

    const snapshot = (ref: MemoryReference) => {
        const data = stores[ref.collectionName].get(ref.id);
        return {
            id: ref.id,
            ref,
            exists: data !== undefined,
            data: () => data,
        };
    };

    const applyUpdate = (ref: MemoryReference, update: StoredDocument) => {
        const current = stores[ref.collectionName].get(ref.id);
        if (!current) throw new Error(`Missing ${ref.collectionName}/${ref.id}`);
        stores[ref.collectionName].set(ref.id, { ...current, ...update });
    };

    const makeQuery = (
        collectionName: CollectionName,
        filters: Array<{ field: string; operator: string; value: unknown }> = [],
    ): Record<string, unknown> => ({
        where: (field: string, operator: string, value: unknown) => makeQuery(
            collectionName,
            [...filters, { field, operator, value }],
        ),
        limit: () => makeQuery(collectionName, filters),
        get: async () => {
            if (queryFailure) throw queryFailure;
            const docs = [...stores[collectionName].entries()]
                .filter(([, data]) => filters.every(filter => {
                    const actual = comparable(data[filter.field]);
                    const expected = comparable(filter.value);
                    if (filter.operator === '==') return actual === expected;
                    if (filter.operator === '<=') {
                        return typeof actual === 'number'
                            && typeof expected === 'number'
                            && actual <= expected;
                    }
                    throw new Error(`Unsupported operator ${filter.operator}`);
                }))
                .map(([id]) => snapshot({ collectionName, id }));
            return { docs, size: docs.length };
        },
        doc: (id: string) => ({ collectionName, id }),
    });

    const db = {
        collection: (collectionName: CollectionName) => makeQuery(collectionName),
        runTransaction: async (handler: (transaction: {
            get: (ref: MemoryReference) => Promise<ReturnType<typeof snapshot>>;
            update: (ref: MemoryReference, update: StoredDocument) => void;
        }) => Promise<unknown>) => {
            const beforeTransaction = beforeNextTransaction;
            beforeNextTransaction = null;
            beforeTransaction?.();
            return handler({
                get: async ref => snapshot(ref),
                update: applyUpdate,
            });
        },
    };

    return {
        db,
        scheduledPost: (id: string) => stores.scheduledPosts.get(id),
        campaign: (id: string) => stores.campaigns.get(id),
        failQueriesWith: (error: Error) => { queryFailure = error; },
        beforeTransaction: (callback: () => void) => { beforeNextTransaction = callback; },
        setScheduledPost: (id: string, data: StoredDocument) => stores.scheduledPosts.set(id, data),
    };
}

const NOW = Timestamp.fromMillis(Date.parse('2026-08-09T20:00:00.000Z'));
const DUE = Timestamp.fromMillis(NOW.toMillis() - 60_000);

function pendingPost(overrides: StoredDocument = {}): StoredDocument {
    return {
        userId: 'artist-uid',
        platform: 'twitter',
        text: 'A real release announcement',
        scheduledAt: DUE,
        status: 'pending',
        campaignId: 'campaign-1',
        campaignPostId: 'campaign-post-1',
        retryCount: 0,
        ...overrides,
    };
}

function campaign(): StoredDocument {
    return {
        userId: 'artist-uid',
        status: 'EXECUTING',
        posts: [{ id: 'campaign-post-1', status: 'EXECUTING' }],
    };
}

describe('deliverScheduledPostsHandler production worker path', () => {
    beforeEach(() => vi.clearAllMocks());

    it('rejects query failures so Cloud Scheduler records a failed invocation', async () => {
        const memory = createMemoryDb();
        memory.failQueriesWith(new Error('9 FAILED_PRECONDITION: The query requires an index'));
        const dispatch = vi.fn();

        await expect(deliverScheduledPostsHandler({
            db: memory.db as never,
            now: NOW,
            dispatch,
        })).rejects.toThrow(/requires an index/);

        expect(dispatch).not.toHaveBeenCalled();
        expect(logMocks.error).toHaveBeenCalledWith(expect.objectContaining({
            errorCode: 'DELIVERY_FAILED',
        }));
    });

    it('schedules a visible retry when the user has no platform token', async () => {
        const memory = createMemoryDb({
            scheduledPosts: { 'queue-1': pendingPost() },
            campaigns: { 'campaign-1': campaign() },
        });
        const getToken = vi.fn().mockResolvedValue(null);

        await deliverScheduledPostsHandler({
            db: memory.db as never,
            now: NOW,
            getToken,
        });

        expect(memory.scheduledPost('queue-1')).toMatchObject({
            status: 'failed',
            retryCount: 1,
            deliveryError: 'No OAuth token for twitter',
        });
        expect((memory.scheduledPost('queue-1')?.nextRetryAt as Timestamp).toMillis()).toBeGreaterThan(NOW.toMillis());
        expect(memory.campaign('campaign-1')).toMatchObject({
            status: 'EXECUTING',
            posts: [expect.objectContaining({
                id: 'campaign-post-1',
                postId: 'queue-1',
                status: 'EXECUTING',
                errorMessage: expect.stringMatching(/retry scheduled/i),
            })],
        });
    });

    it('persists the platform receipt and completes the correlated campaign', async () => {
        const memory = createMemoryDb({
            scheduledPosts: { 'queue-1': pendingPost() },
            campaigns: { 'campaign-1': campaign() },
        });
        const dispatch = vi.fn().mockResolvedValue({ success: true, postId: 'twitter-987' });

        await deliverScheduledPostsHandler({
            db: memory.db as never,
            now: NOW,
            getToken: vi.fn().mockResolvedValue({ accessToken: 'genuine-shape-token' }),
            dispatch,
        });

        expect(dispatch).toHaveBeenCalledOnce();
        expect(memory.scheduledPost('queue-1')).toMatchObject({
            status: 'delivered',
            platformPostId: 'twitter-987',
        });
        expect(memory.campaign('campaign-1')).toMatchObject({
            status: 'DONE',
            posts: [expect.objectContaining({
                postId: 'queue-1',
                status: 'DONE',
            })],
        });
    });

    it('never lets an owner-created queue record update another user\'s campaign', async () => {
        const victimCampaign = {
            ...campaign(),
            userId: 'victim-uid',
        };
        const memory = createMemoryDb({
            scheduledPosts: { 'hostile-queue': pendingPost() },
            campaigns: { 'campaign-1': victimCampaign },
        });

        await deliverScheduledPostsHandler({
            db: memory.db as never,
            now: NOW,
            getToken: vi.fn().mockResolvedValue({ accessToken: 'attacker-token' }),
            dispatch: vi.fn().mockResolvedValue({ success: true, postId: 'external-post-id' }),
        });

        expect(memory.scheduledPost('hostile-queue')).toMatchObject({ status: 'delivered' });
        expect(memory.campaign('campaign-1')).toEqual(victimCampaign);
        expect(logMocks.error).toHaveBeenCalledWith(expect.stringMatching(/Refusing cross-owner campaign update/));
    });

    it('never labels a platform response delivered without a receipt ID', async () => {
        const memory = createMemoryDb({
            scheduledPosts: { 'queue-1': pendingPost() },
            campaigns: { 'campaign-1': campaign() },
        });

        await deliverScheduledPostsHandler({
            db: memory.db as never,
            now: NOW,
            getToken: vi.fn().mockResolvedValue({ accessToken: 'genuine-shape-token' }),
            dispatch: vi.fn().mockResolvedValue({ success: true }),
        });

        expect(memory.scheduledPost('queue-1')).toMatchObject({
            status: 'failed',
            retryCount: 1,
            deliveryError: 'The platform did not confirm delivery.',
        });
        expect(memory.campaign('campaign-1')).toMatchObject({ status: 'EXECUTING' });
    });

    it('fails legacy TikTok queue items terminal without initiating an unverifiable post', async () => {
        const memory = createMemoryDb({
            scheduledPosts: { 'queue-1': pendingPost({ platform: 'tiktok', mediaUrl: 'https://cdn.indii.music/video.mp4' }) },
            campaigns: { 'campaign-1': campaign() },
        });

        await deliverScheduledPostsHandler({
            db: memory.db as never,
            now: NOW,
            getToken: vi.fn().mockResolvedValue({ accessToken: 'analytics-only-token' }),
        });

        expect(memory.scheduledPost('queue-1')).toMatchObject({
            status: 'failed',
            retryCount: 3,
            deliveryError: expect.stringMatching(/publish-status verification/i),
        });
        expect(memory.campaign('campaign-1')).toMatchObject({ status: 'FAILED' });
    });

    it('marks stale ambiguous claims terminal instead of risking duplicate public posts', async () => {
        const memory = createMemoryDb({
            scheduledPosts: {
                'queue-1': pendingPost({
                    status: 'delivering',
                    deliveryStartedAt: Timestamp.fromMillis(NOW.toMillis() - 11 * 60_000),
                }),
            },
            campaigns: { 'campaign-1': campaign() },
        });
        const dispatch = vi.fn();

        await deliverScheduledPostsHandler({ db: memory.db as never, now: NOW, dispatch });

        expect(dispatch).not.toHaveBeenCalled();
        expect(memory.scheduledPost('queue-1')).toMatchObject({
            status: 'failed',
            retryCount: 3,
            deliveryError: expect.stringMatching(/manual review/i),
        });
        expect(memory.campaign('campaign-1')).toMatchObject({
            status: 'FAILED',
            posts: [expect.objectContaining({ status: 'FAILED' })],
        });
    });

    it('does not overwrite a delivery that completed after the stale query', async () => {
        const stale = pendingPost({
            status: 'delivering',
            deliveryStartedAt: Timestamp.fromMillis(NOW.toMillis() - 11 * 60_000),
        });
        const memory = createMemoryDb({
            scheduledPosts: { 'queue-1': stale },
            campaigns: { 'campaign-1': campaign() },
        });
        memory.beforeTransaction(() => {
            memory.setScheduledPost('queue-1', {
                ...stale,
                status: 'delivered',
                platformPostId: 'twitter-race-winner',
            });
        });

        await deliverScheduledPostsHandler({ db: memory.db as never, now: NOW });

        expect(memory.scheduledPost('queue-1')).toMatchObject({
            status: 'delivered',
            platformPostId: 'twitter-race-winner',
        });
        expect(memory.scheduledPost('queue-1')?.deliveryError).toBeUndefined();
    });

    it('does not reclaim terminal failures returned by the broad retry query', async () => {
        const memory = createMemoryDb({
            scheduledPosts: {
                'queue-1': pendingPost({
                    status: 'failed',
                    retryCount: 3,
                    nextRetryAt: DUE,
                }),
            },
            campaigns: { 'campaign-1': campaign() },
        });
        const getToken = vi.fn();

        await deliverScheduledPostsHandler({ db: memory.db as never, now: NOW, getToken });

        expect(getToken).not.toHaveBeenCalled();
        expect(memory.scheduledPost('queue-1')).toMatchObject({ status: 'failed', retryCount: 3 });
    });

    it('enqueues due posts to platform-specific Cloud Tasks queues when tasksClient is configured', async () => {
        const memory = createMemoryDb({
            scheduledPosts: { 'queue-1': pendingPost({ platform: 'instagram' }) },
            campaigns: { 'campaign-1': campaign() },
        });

        const createTaskMock = vi.fn().mockResolvedValue({});
        const queuePathMock = vi.fn().mockReturnValue('projects/test-p/locations/us-central1/queues/social-delivery-instagram');
        const tasksClient = {
            createTask: createTaskMock,
            queuePath: queuePathMock,
        };

        const tasksConfig = {
            project: 'test-p',
            location: 'us-central1',
            workerUrl: 'https://worker.indii.internal',
            serviceAccount: 'sa@indii.iam.gserviceaccount.com',
            audience: 'https://worker.indii.internal',
        };

        const dispatchMock = vi.fn();

        await deliverScheduledPostsHandler({
            db: memory.db as never,
            now: NOW,
            dispatch: dispatchMock,
            tasksClient,
            tasksConfig,
        });

        expect(memory.scheduledPost('queue-1')?.status).toBe('delivering');
        expect(dispatchMock).not.toHaveBeenCalled();
        expect(queuePathMock).toHaveBeenCalledWith('test-p', 'us-central1', 'social-delivery-instagram');
        expect(createTaskMock).toHaveBeenCalledOnce();
        const taskCall = createTaskMock.mock.calls[0][0];
        expect(taskCall.parent).toBe('projects/test-p/locations/us-central1/queues/social-delivery-instagram');
        expect(taskCall.task.httpRequest.oidcToken.serviceAccountEmail).toBe('sa@indii.iam.gserviceaccount.com');
    });
});
