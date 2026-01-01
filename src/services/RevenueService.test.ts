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
    auth: {}
}));

vi.mock('firebase/firestore', () => ({
    collection: mocks.collection,
    addDoc: mocks.addDoc,
    getDocs: mocks.getDocs,
    query: mocks.query,
    where: mocks.where,
    Timestamp: { fromMillis: vi.fn(t => t) },
    orderBy: vi.fn(),
    limit: vi.fn()
}));

// Use current directory import since the test is co-located with the service
import { revenueService, RevenueEntry } from './RevenueService';

describe('RevenueService (Production Logic)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('getUserRevenueStats should query Firestore and aggregate correctly', async () => {
        // Setup mock response
        mocks.getDocs.mockResolvedValue({
            docs: [
                { data: () => ({ amount: 100, source: 'streaming', createdAt: { toDate: () => new Date('2024-01-01') } }) },
                { data: () => ({ amount: 50.50, source: 'merch', createdAt: { toDate: () => new Date('2024-01-02') } }) },
                { data: () => ({ amount: 25, source: 'streaming', createdAt: { toDate: () => new Date('2024-01-01') } }) }
            ]
        });

        const stats = await revenueService.getUserRevenueStats('user-123');

        expect(mocks.collection).toHaveBeenCalledWith(expect.anything(), 'revenue');
        expect(mocks.where).toHaveBeenCalledWith('userId', '==', 'user-123');

        expect(stats.totalRevenue).toBe(175.50);
        expect(stats.sources.streaming).toBe(125);
        expect(stats.sources.merch).toBe(50.50);
        expect(stats.revenueByProduct).toBeDefined();
    });

    it('recordSale should add document to "revenue" collection', async () => {
        const entry: RevenueEntry = {
            productId: 'prod-1',
            amount: 10.00,
            source: 'direct',
            customerId: 'cust-1',
            userId: 'seller-1',
            timestamp: 1234567890
        };

        await revenueService.recordSale(entry);

        // Verify addDoc is called
        expect(mocks.addDoc).toHaveBeenCalled();
        const callArgs = mocks.addDoc.mock.calls[0];
        // The first arg is the collection ref (which is undefined in our mock setup because collection() returns undefined by default)
        // The second arg is the data
        expect(callArgs[1]).toEqual(expect.objectContaining({
            productId: 'prod-1',
            amount: 10.00,
            userId: 'seller-1'
        }));
    });
});
