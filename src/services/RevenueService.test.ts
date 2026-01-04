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
    auth: { currentUser: { uid: 'user-123' } }
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
    limit: vi.fn()
}));

// Use current directory import since the test is co-located with the service
import { revenueService, RevenueEntry } from './RevenueService';

describe('RevenueService (Production Logic)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('getTotalRevenue should query Firestore with correct filter', async () => {
        // Setup mock response
        const mockDocs = [
            { data: () => ({ amount: 100 }) },
            { data: () => ({ amount: 50.50 }) }
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
            { data: () => ({ amount: 100, source: 'direct' }) },
            { data: () => ({ amount: 50, source: 'social_drop' }) },
            { data: () => ({ amount: 25, source: 'direct' }) }
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
            timestamp: 1234567890
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
});
