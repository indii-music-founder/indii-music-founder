import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => {
    const mockBatchSet = vi.fn();
    const mockBatchCommit = vi.fn().mockResolvedValue([]);
    const mockBatch = {
        set: mockBatchSet,
        commit: mockBatchCommit,
    };

    const mockGetReleases = vi.fn().mockResolvedValue({
        docs: [
            {
                data: () => ({
                    title: 'Hit Single',
                    artistName: 'Test Artist',
                    coverArtUrl: 'https://example.com/cover.png',
                    releaseDate: new Date(Date.now() + 86400000).toISOString(),
                    distributors: ['Spotify', 'Apple Music'],
                    status: 'submitted',
                }),
            },
        ],
    });

    const mockGetCampaigns = vi.fn().mockResolvedValue({
        docs: [
            {
                data: () => ({
                    title: 'Summer Launch',
                    status: 'active',
                    budget: 500,
                }),
            },
        ],
    });

    const mockGetTasks = vi.fn().mockResolvedValue({
        docs: [
            {
                id: 'task-1',
                data: () => ({
                    title: 'Submit Spotify metadata',
                    module: 'distribution',
                    status: 'pending',
                    priority: 'high',
                    createdAt: Date.now(),
                }),
            },
        ],
    });

    const mockGetPayouts = vi.fn().mockResolvedValue({
        docs: [
            {
                data: () => ({
                    amount: 1250.50,
                    status: 'completed',
                }),
            },
        ],
    });

    const mockDoc: any = vi.fn((path?: string) => ({
        path,
        id: path ? path.split('/').pop() : 'mock-id',
        collection: vi.fn((subCol?: string) => mockCollection(`${path}/${subCol}`)),
    }));

    const mockCollection: any = vi.fn((name?: string) => ({
        doc: vi.fn((subPath?: string) => mockDoc(`${name}/${subPath}`)),
        where: vi.fn().mockReturnValue({
            get: name === 'releases' ? mockGetReleases : mockGetCampaigns,
        }),
        get: name?.endsWith('/tasks') ? mockGetTasks : name?.endsWith('/payouts') ? mockGetPayouts : vi.fn().mockResolvedValue({ docs: [] }),
    }));

    const mockDb = {
        collection: mockCollection,
        batch: vi.fn(() => mockBatch),
    };

    return {
        mockBatchSet,
        mockBatchCommit,
        mockBatch,
        mockGetReleases,
        mockGetCampaigns,
        mockGetTasks,
        mockGetPayouts,
        mockDoc,
        mockCollection,
        mockDb,
    };
});

vi.mock('firebase-admin', () => ({
    firestore: () => mocks.mockDb,
}));

vi.mock('firebase-functions/v2/https', () => ({
    onCall: (_opts: unknown, handler: unknown) => handler,
    HttpsError: class extends Error {
        code: string;
        constructor(code: string, message: string) {
            super(message);
            this.code = code;
        }
    },
}));

vi.mock('../../config/secrets', () => ({
    arcjetKey: 'mock-key',
}));

vi.mock('../../middleware/appCheck', () => ({
    validateAppCheckV2: vi.fn(),
}));

vi.mock('../../functions/security/arcjet', () => ({
    protectAuthenticatedApiRequest: vi.fn().mockResolvedValue({ allowed: true }),
}));

vi.mock('../../observability/logger', () => ({
    logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
    },
}));

import { aggregateUserDashboardStats } from '../aggregateUserDashboardStats';

describe('aggregateUserDashboardStats callable (ISSUE-1595)', () => {
    const TEST_UID = 'user-test-1595';

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('rejects unauthenticated requests with unauthenticated error', async () => {
        const callable = aggregateUserDashboardStats as any;
        await expect(callable({ auth: null })).rejects.toThrow('Authentication required');
    });

    it('aggregates domain collections and writes all dashboard stats', async () => {
        const callable = aggregateUserDashboardStats as any;
        const result = await callable({
            auth: { uid: TEST_UID, token: {} },
            rawRequest: {},
        });

        expect(result.success).toBe(true);
        expect(result.updatedCount).toBe(14);
        expect(mocks.mockBatch.commit).toHaveBeenCalledTimes(1);

        // Check that sales_analytics, dashboard_revenue, marketing, etc. were set in the batch
        expect(mocks.mockBatchSet).toHaveBeenCalled();
        const setCalls = mocks.mockBatchSet.mock.calls;

        // Verify marketing stat
        const marketingCall = setCalls.find((call: any[]) => call[0].path?.includes('marketing'));
        expect(marketingCall).toBeDefined();
        expect(marketingCall![1].activeCampaigns).toBe(1);

        // Verify top track has expected title
        const topTrackCall = setCalls.find((call: any[]) => call[0].path?.includes('top_track'));
        expect(topTrackCall).toBeDefined();
        expect(topTrackCall![1].title).toBe('Hit Single');

        // Verify active campaigns count
        const activeCampaignsCall = setCalls.find((call: any[]) => call[0].path?.includes('active_campaigns'));
        expect(activeCampaignsCall).toBeDefined();
        expect(activeCampaignsCall![1].activeCount).toBe(1);

        // Verify pending tasks count
        const pendingTasksCall = setCalls.find((call: any[]) => call[0].path?.includes('pending_tasks'));
        expect(pendingTasksCall).toBeDefined();
        expect(pendingTasksCall![1].totalCount).toBe(1);

        // Verify revenue stat
        const revenueCall = setCalls.find((call: any[]) => call[0].path?.includes('dashboard_revenue'));
        expect(revenueCall).toBeDefined();
        expect(revenueCall![1].totalRevenue.value).toBe(1250.50);
    });
});
