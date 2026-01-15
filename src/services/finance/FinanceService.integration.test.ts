import { vi, describe, it, expect, beforeEach } from 'vitest';
import { FinanceService } from '@/services/finance/FinanceService';
import { db, auth } from '@/services/firebase';
import { addDoc, collection } from 'firebase/firestore';

// Mock Firebase
vi.mock('@/services/firebase', () => ({
    db: {},
    auth: {
        currentUser: { uid: 'test-user-id' }
    }
}));

// Mock Firestore
const mockAddDoc = vi.fn();
const mockCollection = vi.fn();

vi.mock('firebase/firestore', () => ({
    collection: (...args: any[]) => mockCollection(...args),
    addDoc: (...args: any[]) => mockAddDoc(...args),
    doc: vi.fn(),
    getDoc: vi.fn(),
    getDocs: vi.fn(),
    query: vi.fn(),
    where: vi.fn(),
    orderBy: vi.fn(),
    runTransaction: vi.fn(),
    Timestamp: {
        now: () => ({ toDate: () => new Date('2024-01-01T00:00:00.000Z') })
    },
    serverTimestamp: vi.fn(),
    onSnapshot: vi.fn()
}));

// Mock RevenueService
vi.mock('@/services/RevenueService', () => ({
    revenueService: {
        getUserRevenueStats: vi.fn().mockResolvedValue({})
    }
}));

describe('FinanceService Integration', () => {
    let financeService: FinanceService;

    beforeEach(() => {
        vi.clearAllMocks();
        mockAddDoc.mockResolvedValue({ id: 'new-expense-id' });
        financeService = new FinanceService();
    });

    it('addExpense successfully adds valid expense', async () => {
        const validExpense = {
            userId: 'test-user-id',
            vendor: 'Sweetwater',
            amount: 299.99,
            category: 'Equipment',
            date: '2024-01-01',
            description: 'New Mic'
        };

        const result = await financeService.addExpense(validExpense);

        expect(result.id).toBe('new-expense-id');
        expect(mockAddDoc).toHaveBeenCalledWith(
            undefined,
            expect.objectContaining({
                vendor: 'Sweetwater',
                amount: 299.99,
                userId: 'test-user-id'
            })
        );
    });

    it('addExpense throws error for negative amount', async () => {
        const invalidExpense = {
            userId: 'test-user-id',
            vendor: 'Refund',
            amount: -50, // Invalid
            category: 'Other',
            date: '2024-01-01',
            description: 'Refund'
        };

        await expect(financeService.addExpense(invalidExpense)).rejects.toThrow(/Invalid expense data/);
    });

    it('addExpense throws error for missing vendor', async () => {
        const invalidExpense = {
            userId: 'test-user-id',
            vendor: '', // Invalid
            amount: 100,
            category: 'Other',
            date: '2024-01-01',
            description: 'Mystery'
        };

        await expect(financeService.addExpense(invalidExpense)).rejects.toThrow(/Invalid expense data/);
    });

    it('addExpense throws error for unauthorized user', async () => {
        const stolenExpense = {
            userId: 'other-user-id', // Mismatch with auth.currentUser
            vendor: 'Theft',
            amount: 1000,
            category: 'Equipment',
            date: '2024-01-01',
            description: 'Stolen'
        };

        await expect(financeService.addExpense(stolenExpense)).rejects.toThrow(/Unauthorized/);
    });
});
