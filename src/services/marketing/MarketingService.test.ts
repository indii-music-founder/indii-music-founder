import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MarketingService } from './MarketingService';
import { CampaignStatus } from '@/modules/marketing/types';

// --- Mocks ---

const {
    mockGetDoc,
    mockGetDocs,
    mockAddDoc,
    mockCollection,
    mockDoc,
    mockQuery,
    mockWhere,
    mockOrderBy,
    mockInitializeFirestore,
    mockPersistentLocalCache,
    mockPersistentMultipleTabManager
} = vi.hoisted(() => {
    return {
        mockGetDoc: vi.fn(),
        mockGetDocs: vi.fn(),
        mockAddDoc: vi.fn(),
        mockCollection: vi.fn(),
        mockDoc: vi.fn(),
        mockQuery: vi.fn(),
        mockWhere: vi.fn(),
        mockOrderBy: vi.fn(),
        mockInitializeFirestore: vi.fn(),
        mockPersistentLocalCache: vi.fn(),
        mockPersistentMultipleTabManager: vi.fn()
    };
});

vi.mock('firebase/firestore', () => ({
    getDoc: mockGetDoc,
    getDocs: mockGetDocs,
    addDoc: mockAddDoc,
    collection: mockCollection,
    doc: mockDoc,
    query: mockQuery,
    where: mockWhere,
    orderBy: mockOrderBy,
    initializeFirestore: mockInitializeFirestore,
    persistentLocalCache: mockPersistentLocalCache,
    persistentMultipleTabManager: mockPersistentMultipleTabManager,
    getFirestore: vi.fn(),
    serverTimestamp: vi.fn(() => 'MOCK_TIMESTAMP'),
    increment: vi.fn(),
    updateDoc: vi.fn(),
    Timestamp: {
        now: () => ({ toDate: () => new Date() })
    }
}));

vi.mock('@/services/firebase', () => ({
    db: {}
}));

vi.mock('@/core/store', () => ({
    useStore: {
        getState: () => ({
            userProfile: { id: 'test-user-123' }
        })
    }
}));

describe('MarketingService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('getMarketingStats', () => {
        it('should return real stats if the stats document exists', async () => {
            const mockStats = { totalReach: 50000, engagementRate: 5.2, activeCampaigns: 2 };
            mockGetDoc.mockResolvedValueOnce({
                exists: () => true,
                data: () => mockStats
            });

            const stats = await MarketingService.getMarketingStats();
            expect(stats).toEqual(mockStats);
        });

        it('should fall back to aggregation if stats document does not exist', async () => {
            mockGetDoc.mockResolvedValueOnce({
                exists: () => false
            });
            // Mock empty campaigns for aggregation
            mockGetDocs.mockResolvedValueOnce({
                docs: []
            });

            const stats = await MarketingService.getMarketingStats();
            expect(stats.activeCampaigns).toBe(0);
            expect(stats.totalReach).toBe(0); // Mock fallback value
        });
    });

    describe('getCampaigns', () => {
        it('should fetch campaigns for the current user', async () => {
            const mockCampaign = { title: 'Test Campaign', startDate: '2023-12-01' };
            mockGetDocs.mockResolvedValue({
                docs: [{ id: '1', data: () => mockCampaign }]
            });

            const campaigns = await MarketingService.getCampaigns();
            expect(campaigns).toHaveLength(1);
            expect(campaigns[0].title).toBe('Test Campaign');
        });
    });

    describe('createCampaign', () => {
        it('should add a new campaign document with userId', async () => {
            const campaignData = {
                assetType: 'campaign' as const,
                title: 'New Campaign',
                durationDays: 30,
                startDate: '2023-12-25',
                posts: [],
                status: CampaignStatus.PENDING
            };

            mockAddDoc.mockResolvedValueOnce({ id: 'new-id' });

            await MarketingService.createCampaign(campaignData as any);

            expect(mockAddDoc).toHaveBeenCalledWith(
                undefined, // collection ref mock returned undefined by default
                expect.objectContaining({
                    ...campaignData,
                    userId: 'test-user-123'
                })
            );
        });
    });
});
