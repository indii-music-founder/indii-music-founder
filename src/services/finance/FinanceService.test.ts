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
    mockCaptureException
} = vi.hoisted(() => {
    return {
        mockAddDoc: vi.fn(),
        mockGetDocs: vi.fn(),
        mockQuery: vi.fn(),
        mockCollection: vi.fn(),
        mockWhere: vi.fn(),
        mockOrderBy: vi.fn(),
        mockGetUserRevenueStats: vi.fn(),
        mockCaptureException: vi.fn(),
    }
});

vi.mock('@sentry/react', () => ({
    captureException: mockCaptureException
}));

vi.mock('@/services/firebase', () => ({
    db: {},
    auth: {
        currentUser: { uid: 'user-123' }
    }
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
    Timestamp: class Timestamp {
        static now() { return { toDate: () => new Date('2024-03-20') }; }
        toDate() { return new Date('2024-03-20'); }
    }
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
        it('should successfully add an expense and return the ID', async () => {
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
                    createdAt: expect.any(Object) // Matches the Timestamp object
                })
            );
            expect(result).toBe('new-expense-id');
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
                        createdAt: { toDate: () => new Date('2024-03-20') }
                    })
                }
            ];

            mockGetDocs.mockResolvedValueOnce({ docs: mockDocs, empty: false });

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
        it('should call revenueService and return mapped earnings data', async () => {
            const mockRevenueStats = {
                period: { startDate: '2024-01-01', endDate: '2024-01-31' },
                totalGrossRevenue: 1000.50,
                totalNetRevenue: 1000.50,
                totalStreams: 1000,
                totalDownloads: 10,
                currencyCode: 'USD',
                byPlatform: [],
                byTerritory: [],
                byRelease: [
                    { releaseId: 'rel-1', title: 'Song 1', revenue: 500.25 },
                    { releaseId: 'rel-2', title: 'Song 2', revenue: 500.25 }
                ]
            };

            mockGetDocs.mockResolvedValueOnce({
                empty: false,
                docs: [{
                    data: () => mockRevenueStats
                }]
            });

            const result = await financeService.fetchEarnings('user-123');

            expect(mockGetDocs).toHaveBeenCalled();
            expect(result).toBeDefined();
            expect(result.totalGrossRevenue).toBe(1000.50);
            expect(result.totalNetRevenue).toBe(1000.50);
            expect(result.byRelease).toHaveLength(2);
            expect(result.byRelease[0].revenue).toBe(500.25);
            expect(result.byPlatform).toEqual([]); // Expect empty until mapped
        });

        it('should handle errors by logging to Sentry', async () => {
            const error = new Error('Test Error');
            mockGetDocs.mockRejectedValueOnce(error);

            await expect(financeService.fetchEarnings('user-123')).rejects.toThrow('Test Error');
            expect(mockCaptureException).toHaveBeenCalledWith(error);
        });
    });
});
