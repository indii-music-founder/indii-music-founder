import { beforeEach, describe, expect, it, vi } from 'vitest';

const adminMocks = vi.hoisted(() => {
    const queueData = new Map<string, Record<string, unknown>>();
    let campaignData: Record<string, unknown> = {};

    const serverTimestamp = vi.fn(() => ({ kind: 'server-timestamp' }));
    const fromDate = vi.fn((date: Date) => ({ toDate: () => date }));

    const snapshotFor = (ref: { collectionName: string; id: string }) => {
        const data = ref.collectionName === 'campaigns'
            ? campaignData
            : queueData.get(ref.id);
        return {
            exists: data !== undefined,
            data: () => data,
        };
    };

    const makeRef = (collectionName: string, id: string) => {
        const ref = {
            collectionName,
            id,
            get: vi.fn(async () => snapshotFor(ref)),
        };
        return ref;
    };

    const doc = vi.fn((collectionName: string, id: string) => makeRef(collectionName, id));
    const add = vi.fn();
    const makeQuery = (
        collectionName: string,
        filters: Array<{ field: string; value: unknown }> = [],
    ): Record<string, unknown> => ({
        collectionName,
        filters,
        doc: (id: string) => doc(collectionName, id),
        add,
        where: (field: string, _operator: string, value: unknown) => makeQuery(
            collectionName,
            [...filters, { field, value }],
        ),
    });
    const collection = vi.fn((collectionName: string) => makeQuery(collectionName));

    const txGet = vi.fn(async (target: {
        collectionName: string;
        id?: string;
        filters?: Array<{ field: string; value: unknown }>;
    }) => {
        if (target.filters) {
            const docs = [...queueData.entries()]
                .filter(([, data]) => target.filters!.every(filter => data[filter.field] === filter.value))
                .map(([id, data]) => ({
                    id,
                    ref: { collectionName: target.collectionName, id },
                    data: () => data,
                }));
            return { docs };
        }
        return snapshotFor(target as { collectionName: string; id: string });
    });
    const txSet = vi.fn((ref: { collectionName: string; id: string }, data: Record<string, unknown>) => {
        if (ref.collectionName === 'scheduledPosts') queueData.set(ref.id, data);
    });
    const txUpdate = vi.fn((ref: { collectionName: string }, data: Record<string, unknown>) => {
        if (ref.collectionName === 'campaigns') campaignData = { ...campaignData, ...data };
    });
    const runTransaction = vi.fn(async (handler: (transaction: {
        get: typeof txGet;
        set: typeof txSet;
        update: typeof txUpdate;
    }) => Promise<unknown>) => handler({ get: txGet, set: txSet, update: txUpdate }));

    const firestore = Object.assign(vi.fn(() => ({ collection, runTransaction })), {
        FieldValue: { serverTimestamp },
        Timestamp: { fromDate },
    });

    return {
        add,
        collection,
        doc,
        firestore,
        fromDate,
        queueData,
        runTransaction,
        serverTimestamp,
        txGet,
        txSet,
        txUpdate,
        getCampaignData: () => campaignData,
        setCampaignData: (data: Record<string, unknown>) => { campaignData = data; },
    };
});

vi.mock('firebase-admin', () => ({ firestore: adminMocks.firestore }));

vi.mock('firebase-functions/v2/https', () => {
    class HttpsError extends Error {
        constructor(public readonly code: string, message: string) {
            super(message);
            this.name = 'HttpsError';
        }
    }
    return {
        HttpsError,
        onCall: vi.fn((optionsOrHandler: unknown, maybeHandler?: unknown) => (
            typeof optionsOrHandler === 'function' ? optionsOrHandler : maybeHandler
        )),
    };
});

vi.mock('firebase-functions/params', () => ({
    defineString: vi.fn(() => ({ value: vi.fn(() => '') })),
}));

import {
    campaignQueueDocumentId,
    executeCampaign,
    normalizeDispatchPlatform,
} from './marketing';

type Callable = (request: {
    data?: Record<string, unknown>;
    auth?: { uid: string };
}) => Promise<{
    success: boolean;
    posts: Array<Record<string, unknown>>;
    status: string;
    message: string;
}>;

const executeCampaignCallable = executeCampaign as unknown as Callable;

function validCampaign(overrides: Record<string, unknown> = {}) {
    return {
        userId: 'artist-uid',
        status: 'EXECUTING',
        posts: [{
            id: 'post-1',
            platform: 'Twitter',
            copy: 'Persisted campaign copy',
            imageAsset: {
                assetType: 'image',
                title: 'Cover',
                imageUrl: 'https://cdn.indii.music/cover.jpg',
                caption: '',
            },
            day: 1,
            status: 'EXECUTING',
        }],
        ...overrides,
    };
}

describe('executeCampaign queue contract (structural)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        adminMocks.queueData.clear();
        adminMocks.setCampaignData(validCampaign());
    });

    it('requires authentication before reading or writing campaign state', async () => {
        await expect(executeCampaignCallable({ data: { campaignId: 'campaign-1' } }))
            .rejects.toMatchObject({ code: 'unauthenticated' });
        expect(adminMocks.runTransaction).not.toHaveBeenCalled();
    });

    it('rejects client-supplied post content so the persisted campaign remains authoritative', async () => {
        await expect(executeCampaignCallable({
            auth: { uid: 'artist-uid' },
            data: { campaignId: 'campaign-1', posts: [{ id: 'attacker-post' }] },
        })).rejects.toMatchObject({ code: 'invalid-argument' });
        expect(adminMocks.runTransaction).not.toHaveBeenCalled();
    });

    it('rejects a campaign owned by another user before creating queue records', async () => {
        adminMocks.setCampaignData(validCampaign({ userId: 'different-user' }));

        await expect(executeCampaignCallable({
            auth: { uid: 'artist-uid' },
            data: { campaignId: 'campaign-1' },
        })).rejects.toMatchObject({ code: 'permission-denied' });

        expect(adminMocks.txSet).not.toHaveBeenCalled();
        expect(adminMocks.txUpdate).not.toHaveBeenCalled();
    });

    it('atomically creates deterministic queue records and persists the exact visible campaign state', async () => {
        const result = await executeCampaignCallable({
            auth: { uid: 'artist-uid' },
            data: { campaignId: 'campaign-1' },
        });
        const expectedQueueId = campaignQueueDocumentId('artist-uid', 'campaign-1', 'post-1');

        expect(adminMocks.txSet).toHaveBeenCalledTimes(1);
        expect(adminMocks.txSet).toHaveBeenCalledWith(
            expect.objectContaining({ collectionName: 'scheduledPosts', id: expectedQueueId }),
            expect.objectContaining({
                userId: 'artist-uid',
                campaignId: 'campaign-1',
                campaignPostId: 'post-1',
                platform: 'twitter',
                text: 'Persisted campaign copy',
                status: 'pending',
                source: 'campaign_manager',
            }),
        );
        expect(adminMocks.add).not.toHaveBeenCalled();
        expect(adminMocks.txUpdate).toHaveBeenCalledWith(
            expect.objectContaining({ collectionName: 'campaigns', id: 'campaign-1' }),
            expect.objectContaining({
                status: 'EXECUTING',
                posts: [expect.objectContaining({
                    id: 'post-1',
                    postId: expectedQueueId,
                    status: 'EXECUTING',
                })],
            }),
        );
        expect(result).toMatchObject({
            success: true,
            status: 'EXECUTING',
            posts: [expect.objectContaining({ postId: expectedQueueId, status: 'EXECUTING' })],
        });
    });

    it('confirms an existing deterministic queue without creating a duplicate', async () => {
        const first = await executeCampaignCallable({
            auth: { uid: 'artist-uid' },
            data: { campaignId: 'campaign-1' },
        });
        adminMocks.txSet.mockClear();

        const second = await executeCampaignCallable({
            auth: { uid: 'artist-uid' },
            data: { campaignId: 'campaign-1' },
        });

        expect(adminMocks.txSet).not.toHaveBeenCalled();
        expect(second.posts[0].postId).toBe(first.posts[0].postId);
        expect(second.message).toMatch(/no duplicate posts/i);
    });

    it('adopts a matching legacy random-ID queue record instead of duplicating a pre-fix side effect', async () => {
        adminMocks.queueData.set('legacy-random-id', {
            userId: 'artist-uid',
            campaignId: 'campaign-1',
            campaignPostId: 'post-1',
            platform: 'twitter',
            text: 'Persisted campaign copy',
            mediaUrl: 'https://cdn.indii.music/cover.jpg',
            scheduledAt: { toDate: () => new Date('2026-08-11T12:00:00.000Z') },
            status: 'pending',
            source: 'campaign_manager',
            retryCount: 0,
        });

        const result = await executeCampaignCallable({
            auth: { uid: 'artist-uid' },
            data: { campaignId: 'campaign-1' },
        });

        expect(adminMocks.txSet).not.toHaveBeenCalled();
        expect(result.posts[0]).toMatchObject({
            postId: 'legacy-random-id',
            scheduledTime: '2026-08-11T12:00:00.000Z',
            status: 'EXECUTING',
        });
    });

    it('rejects changed content instead of relabeling an old queue record as the new copy', async () => {
        await executeCampaignCallable({
            auth: { uid: 'artist-uid' },
            data: { campaignId: 'campaign-1' },
        });
        adminMocks.txSet.mockClear();
        adminMocks.txUpdate.mockClear();
        adminMocks.setCampaignData(validCampaign({
            posts: [{
                ...(validCampaign().posts as Array<Record<string, unknown>>)[0],
                copy: 'Changed after queueing',
            }],
        }));

        await expect(executeCampaignCallable({
            auth: { uid: 'artist-uid' },
            data: { campaignId: 'campaign-1' },
        })).rejects.toMatchObject({ code: 'failed-precondition' });

        expect(adminMocks.txSet).not.toHaveBeenCalled();
        expect(adminMocks.txUpdate).not.toHaveBeenCalled();
    });

    it('validates a dry run against the owned persisted campaign without creating side effects', async () => {
        const result = await executeCampaignCallable({
            auth: { uid: 'artist-uid' },
            data: { campaignId: 'campaign-1', dryRun: true },
        });

        expect(result).toMatchObject({ success: true, status: 'EXECUTING' });
        expect(result.message).toMatch(/no posts were queued/i);
        expect(adminMocks.runTransaction).not.toHaveBeenCalled();
        expect(adminMocks.txSet).not.toHaveBeenCalled();
        expect(adminMocks.txUpdate).not.toHaveBeenCalled();
    });

    it('rejects duplicate persisted post IDs before any queue write', async () => {
        const post = (validCampaign().posts as Array<Record<string, unknown>>)[0];
        adminMocks.setCampaignData(validCampaign({ posts: [post, { ...post }] }));

        await expect(executeCampaignCallable({
            auth: { uid: 'artist-uid' },
            data: { campaignId: 'campaign-1' },
        })).rejects.toMatchObject({ code: 'failed-precondition' });
        expect(adminMocks.txSet).not.toHaveBeenCalled();
    });

    it('rejects stale or duplicate queue records instead of hiding already-scheduled side effects', async () => {
        const legacyRecord = {
            userId: 'artist-uid',
            campaignId: 'campaign-1',
            campaignPostId: 'removed-post',
            platform: 'twitter',
            text: 'Already scheduled',
            mediaUrl: null,
            scheduledAt: { toDate: () => new Date('2026-08-11T12:00:00.000Z') },
            status: 'pending',
            source: 'campaign_manager',
            retryCount: 0,
        };
        adminMocks.queueData.set('stale-queue-record', legacyRecord);

        await expect(executeCampaignCallable({
            auth: { uid: 'artist-uid' },
            data: { campaignId: 'campaign-1' },
        })).rejects.toMatchObject({ code: 'failed-precondition' });

        expect(adminMocks.txSet).not.toHaveBeenCalled();
        expect(adminMocks.txUpdate).not.toHaveBeenCalled();
    });
});

describe('normalizeDispatchPlatform (ISSUE-820)', () => {
    it('maps youtube_shorts (the id the UI actually sends) to the worker-recognized "youtube"', () => {
        expect(normalizeDispatchPlatform('youtube_shorts')).toBe('youtube');
    });

    it('also accepts a plain "youtube" value', () => {
        expect(normalizeDispatchPlatform('youtube')).toBe('youtube');
    });

    it('still normalizes the existing platforms correctly', () => {
        expect(normalizeDispatchPlatform('twitter')).toBe('twitter');
        expect(normalizeDispatchPlatform('x')).toBe('twitter');
        expect(normalizeDispatchPlatform('instagram')).toBe('instagram');
        expect(normalizeDispatchPlatform('ig')).toBe('instagram');
        expect(normalizeDispatchPlatform('meta_reels')).toBe('instagram');
        expect(normalizeDispatchPlatform('tiktok')).toBe('tiktok');
    });

    it('is case/whitespace tolerant', () => {
        expect(normalizeDispatchPlatform('  YouTube_Shorts  ')).toBe('youtube');
        expect(normalizeDispatchPlatform('TIKTOK')).toBe('tiktok');
    });

    it('still rejects a genuinely unsupported platform', () => {
        expect(() => normalizeDispatchPlatform('mastodon')).toThrow(/not wired for native delivery/);
    });
});
