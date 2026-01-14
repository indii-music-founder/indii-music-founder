import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FinanceService, Expense, financeService } from './FinanceService';

// --- Mocks ---

const {
    mockAddDoc,
    mockGetDocs,
    mockQuery,
    mockCollection,
    mockWhere,
    mockOrderBy,
    mockGetUserRevenueStats,
    mockCaptureException,
    MockTimestamp
} = vi.hoisted(() => {
    class MockTimestamp {
        seconds: number;
        nanoseconds: number;
        constructor(seconds: number, nanoseconds: number) {
            this.seconds = seconds;
            this.nanoseconds = nanoseconds;
        }
        toDate() { return new Date('2024-03-20'); } // Fixed date for tests
        static now() { return new MockTimestamp(1234567890, 0); }
        static fromMillis(ms: number) { return new MockTimestamp(ms / 1000, 0); }
    }

    return {
        mockAddDoc: vi.fn(),
        mockGetDocs: vi.fn(),
        mockQuery: vi.fn(),
        mockCollection: vi.fn(),
        mockWhere: vi.fn(),
        mockOrderBy: vi.fn(),
        mockGetUserRevenueStats: vi.fn(),
        mockCaptureException: vi.fn(),
        MockTimestamp
    }
});

vi.mock('@sentry/react', () => ({
    captureException: mockCaptureException
}));

vi.mock('@/services/firebase', () => ({
    db: {},
    auth: { currentUser: { uid: 'user-123' } }
}));

vi.mock('firebase/firestore', () => ({
    addDoc: mockAddDoc,
    getDocs: mockGetDocs,
    query: mockQuery,
    collection: mockCollection,
    where: mockWhere,
    orderBy: mockOrderBy,
    serverTimestamp: () => 'MOCK_TIMESTAMP',
    doc: vi.fn(),
    updateDoc: vi.fn(),
    increment: vi.fn(),
    Timestamp: MockTimestamp
}));

vi.mock('@/services/RevenueService', () => ({
    revenueService: {
        getUserRevenueStats: mockGetUserRevenueStats
    }
}));

// --- Test Suite ---

describe('FinanceService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockCollection.mockReturnValue('MOCK_COLLECTION_REF');
    });

    describe('addExpense', () => {
        it('should successfully add an expense and return the full object', async () => {
            const expense: Omit<Expense, 'id' | 'createdAt'> = {
                userId: 'user-123',
                vendor: 'Test Vendor',
                amount: 50.00,
                category: 'Equipment',
                date: '2024-03-20',
                description: 'Test expense'
            };

            mockAddDoc.mockResolvedValueOnce({ id: 'new-expense-id' });

            const result = await financeService.addExpense(expense);

            expect(mockCollection).toHaveBeenCalled();
            expect(mockAddDoc).toHaveBeenCalledWith(
                'MOCK_COLLECTION_REF',
                expect.objectContaining({
                    ...expense,
                    createdAt: expect.any(MockTimestamp)
                })
            );

            // Verify full object return
            expect(result.id).toBe('new-expense-id');
            expect(result.vendor).toBe('Test Vendor');
            expect(result.createdAt).toBeDefined(); // Should be ISO string
        });
    });

    describe('getExpenses', () => {
        it('should fetch and format expenses for a user', async () => {
            const mockDocs = [
                {
                    id: 'exp-1',
                    data: () => ({
                        userId: 'user-123',
                        vendor: 'Vendor 1',
                        amount: 100,
                        createdAt: new MockTimestamp(100, 0)
                    })
                }
            ];

            mockGetDocs.mockResolvedValueOnce({ docs: mockDocs });

            const expenses = await financeService.getExpenses('user-123');

            expect(mockQuery).toHaveBeenCalled();
            expect(mockWhere).toHaveBeenCalledWith('userId', '==', 'user-123');
            expect(mockOrderBy).toHaveBeenCalledWith('createdAt', 'desc');
            expect(expenses).toHaveLength(1);
            expect(expenses[0].id).toBe('exp-1');
            expect(expenses[0].vendor).toBe('Vendor 1');
        });
    });

    describe('fetchEarnings', () => {
        it('should return existing earnings report if found', async () => {
            const mockDocs = [{
                data: () => ({
                    userId: 'user-123',
                    period: { startDate: '2024-01-01', endDate: '2024-01-31' },
                    totalGrossRevenue: 1000.50,
                    byRelease: []
                })
            }];

            mockGetDocs.mockResolvedValueOnce({ docs: mockDocs, empty: false });

            const result = await financeService.fetchEarnings('user-123');

            expect(mockGetDocs).toHaveBeenCalled(); // Should check Firestore
            expect(result?.totalGrossRevenue).toBe(1000.50);
        });

        it('should return null if no earnings data is found (no seeding)', async () => {
            mockGetDocs.mockResolvedValueOnce({ docs: [], empty: true });

            const result = await financeService.fetchEarnings('user-123');

            expect(mockGetDocs).toHaveBeenCalled();
            expect(result).toBeNull();
            expect(mockAddDoc).not.toHaveBeenCalled();
        });

        it('should handle errors by logging to Sentry', async () => {
            const error = new Error('Test Error');
            mockGetDocs.mockRejectedValueOnce(error); // Mock Firestore rejection

            await expect(financeService.fetchEarnings('user-123')).rejects.toThrow('Test Error');
            expect(mockCaptureException).toHaveBeenCalledWith(error);
        });
    });
});
