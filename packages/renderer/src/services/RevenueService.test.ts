// Mock `import.meta` before importing anything else
// We use a custom loader or just avoid importing the problematic file if possible.
// However, since `firebase.ts` is likely imported deeply, we need to mock it.

import { vi } from 'vitest';

// Use vi.hoisted to define mocks that can be used in factory functions
const mocks = vi.hoisted(() => ({
    addDoc: vi.fn(),
    getDocs: vi.fn(),
    collection: vi.fn(),
    query: vi.fn(),
    where: vi.fn()
}));

vi.mock('@/services/firebase', () => ({
    db: {}, // Mock db object
    storage: {},
    functions: {},
    auth: { currentUser: { uid: 'user-123' } },
    functionsWest1: { region: vi.fn(() => ({ httpsCallable: vi.fn() })) },
    remoteConfig: { defaultConfig: {}, fetchAndActivate: vi.fn(() => Promise.resolve()), getValue: vi.fn(() => ({ asString: () => '', asBoolean: () => false, asNumber: () => 0 })) },
    getFirebaseAI: vi.fn(() => ({})),
    app: { options: {} },
    appCheck: { getToken: vi.fn(() => Promise.resolve({ token: 'mock-token' })) },
    messaging: { getToken: vi.fn() }
}));

vi.mock('firebase/firestore', () => ({
    collection: mocks.collection,
    addDoc: mocks.addDoc,
    getDocs: mocks.getDocs,
    query: mocks.query,
    where: mocks.where,
    Timestamp: {
        fromMillis: vi.fn(t => ({ toDate: () => new Date(t) })),
        fromDate: vi.fn(d => ({ toDate: () => d }))
    },
    orderBy: vi.fn(),
    limit: vi.fn(),
    serverTimestamp: vi.fn()
}));

// Use current directory import since the test is co-located with the service
import { revenueService, RevenueEntry } from './RevenueService';

describe('RevenueService (Production Logic)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('getTotalRevenue should query Firestore with correct filter', async () => {
        // Setup mock response with valid Zod data (requires userId)
        const mockDocs = [
            { data: () => ({ amount: 100, userId: 'user-123', source: 'direct' }) },
            { data: () => ({ amount: 50.50, userId: 'user-123', source: 'direct' }) }
        ];
        mocks.getDocs.mockResolvedValue({
            docs: mockDocs,
            empty: false,
            forEach: (callback: (doc: any) => void) => mockDocs.forEach(callback)
        });

        const total = await revenueService.getTotalRevenue('user-123');

        expect(mocks.collection).toHaveBeenCalledWith(expect.anything(), 'revenue');
        expect(mocks.where).toHaveBeenCalledWith('userId', '==', 'user-123');
        expect(total).toBe(150.50);
    });

    it('getRevenueBySource should aggregate correctly', async () => {
        const mockDocs = [
            { data: () => ({ amount: 100, source: 'direct', userId: 'user-123' }) },
            { data: () => ({ amount: 50, source: 'social_drop', userId: 'user-123' }) },
            { data: () => ({ amount: 25, source: 'direct', userId: 'user-123' }) }
        ];
        mocks.getDocs.mockResolvedValue({
            docs: mockDocs,
            empty: false,
            forEach: (callback: (doc: any) => void) => mockDocs.forEach(callback)
        });

        const breakdown = await revenueService.getRevenueBySource('user-123');

        expect(breakdown.direct).toBe(125);
        expect(breakdown.social).toBe(50);
    });

    it('recordSale should add document to "revenue" collection', async () => {
        const entry: RevenueEntry = {
            productId: 'prod-1',
            amount: 10.00,
            source: 'direct',
            customerId: 'cust-1',
            userId: 'seller-1',
            timestamp: 1234567890,
            status: 'completed',
            currency: 'usd'
        };

        await revenueService.recordSale(entry);

        expect(mocks.addDoc).toHaveBeenCalledWith(
            undefined, // collection result (mocked)
            expect.objectContaining({
                productId: 'prod-1',
                amount: 10.00,
                userId: 'seller-1'
            })
        );
    });

    it('getUserRevenueStats should return history sorted by date', async () => {
        // Mock docs with out-of-order dates
        // Note: getUserRevenueStats uses UTC dates for history keys
        const mockDocs = [
             {
                 data: () => ({
                     amount: 100,
                     userId: 'user-123',
                     createdAt: { toDate: () => new Date('2024-01-05T00:00:00Z') }
                 })
            },
            {
                 data: () => ({
                     amount: 50,
                     userId: 'user-123',
                     createdAt: { toDate: () => new Date('2024-01-01T00:00:00Z') }
                 })
            },
            {
                 data: () => ({
                     amount: 25,
                     userId: 'user-123',
                     createdAt: { toDate: () => new Date('2024-01-03T00:00:00Z') }
                 })
            }
        ];

        mocks.getDocs.mockResolvedValue({
            docs: mockDocs,
            empty: false,
            forEach: (callback: (doc: any) => void) => mockDocs.forEach(callback)
        });

        const stats = await revenueService.getUserRevenueStats('user-123', 'all');

        const dates = stats.history.map(h => h.date);
        expect(dates).toEqual(['2024-01-01', '2024-01-03', '2024-01-05']);
    });

    // ISSUE-1275: trendScore / productionVelocity were hardcoded to 0 and never
    // assigned, and funnelData was three zeroes — so the merch dashboard's gauges
    // showed a permanent fake "no data" state regardless of real activity.
    describe('ISSUE-1275: derived merch analytics', () => {
        const mockWith = (docs: any[]) => {
            mocks.getDocs.mockResolvedValue({
                docs,
                empty: docs.length === 0,
                forEach: (callback: (doc: any) => void) => docs.forEach(callback)
            });
        };

        it('reports funnelData as null (untracked) rather than zeroes posing as measurements', async () => {
            mockWith([{ data: () => ({ amount: 100, userId: 'user-123', createdAt: { toDate: () => new Date('2024-01-01T00:00:00Z') } }) }]);

            const stats = await revenueService.getUserRevenueStats('user-123', 'all');

            expect(stats.funnelData).toBeNull();
        });

        it('derives trendScore from real revenue movement rather than reporting a hardcoded 0', async () => {
            // This mock serves the same docs to the current- and previous-period
            // queries, so revenue is genuinely flat period-over-period.
            mockWith([{ data: () => ({ amount: 500, userId: 'user-123', createdAt: { toDate: () => new Date('2024-01-01T00:00:00Z') } }) }]);

            const stats = await revenueService.getUserRevenueStats('user-123', 'all');

            // Flat revenue scores the neutral midpoint — NOT the old hardcoded 0,
            // which is what proves the value is actually being computed.
            expect(stats.trendScore).toBe(50);
        });

        it('scores a genuinely empty account as 0 rather than inventing momentum', async () => {
            mockWith([]);

            const stats = await revenueService.getUserRevenueStats('user-123', 'all');

            expect(stats.trendScore).toBe(0);
            expect(stats.productionVelocity).toBe(0);
        });

        it('keeps trendScore within the 0-100 range the gauge renders', async () => {
            mockWith([{ data: () => ({ amount: 999999, userId: 'user-123', createdAt: { toDate: () => new Date('2024-01-01T00:00:00Z') } }) }]);

            const stats = await revenueService.getUserRevenueStats('user-123', 'all');

            expect(stats.trendScore).toBeGreaterThanOrEqual(0);
            expect(stats.trendScore).toBeLessThanOrEqual(100);
        });
    });
});
