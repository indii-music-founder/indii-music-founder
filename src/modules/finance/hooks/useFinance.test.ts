import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useFinance } from './useFinance';
import { financeService } from '@/services/finance/FinanceService';
import * as Sentry from '@sentry/react';

// Mock dependencies
vi.mock('@/core/store', () => ({
    useStore: vi.fn(),
}));

vi.mock('@/core/context/ToastContext', () => ({
    useToast: vi.fn(),
}));

vi.mock('@/services/finance/FinanceService', () => ({
    financeService: {
        getExpenses: vi.fn(),
        addExpense: vi.fn(),
        fetchEarnings: vi.fn(),
        subscribeToEarnings: vi.fn(),
        subscribeToExpenses: vi.fn()
    }
}));

vi.mock('@sentry/react', () => ({
    captureException: vi.fn(),
}));

import { useStore } from '@/core/store';
import { useToast } from '@/core/context/ToastContext';

describe('useFinance', () => {
    const mockFetchEarnings = vi.fn();
    const mockUserProfile = { id: 'user-123' };
    const mockFinanceState = {
        earningsSummary: null,
        loading: false,
        error: null,
    };
    const mockToast = {
        error: vi.fn(),
        success: vi.fn(),
        showToast: vi.fn(),
        info: vi.fn(),
        warning: vi.fn(),
        loading: vi.fn(),
        dismiss: vi.fn(),
        updateProgress: vi.fn(),
        promise: vi.fn()
    };

    beforeEach(() => {
        vi.clearAllMocks();

        vi.mocked(useStore).mockReturnValue({
            finance: mockFinanceState,
            fetchEarnings: mockFetchEarnings,
            userProfile: mockUserProfile,
        } as any);

        vi.mocked(useToast).mockReturnValue(mockToast);
    });

    it('should initialize with default states', () => {
        // Mock subscription to return a cleanup function
        vi.mocked(financeService.subscribeToEarnings).mockReturnValue(() => { });
        vi.mocked(financeService.subscribeToExpenses).mockReturnValue(() => { });

        const { result } = renderHook(() => useFinance());

        // Initial state
        expect(result.current.earningsSummary).toBeNull();
        expect(result.current.expenses).toEqual([]);
        expect(result.current.expensesLoading).toBe(true); // Should be true initially
    });

    it('should load earnings on mount if user is logged in', () => {
        const mockUnsubscribe = vi.fn();
        vi.mocked(financeService.subscribeToEarnings).mockImplementation((userId, callback) => {
            callback(null); // Simulate immediate update
            return mockUnsubscribe;
        });
        vi.mocked(financeService.subscribeToExpenses).mockReturnValue(() => { });

        renderHook(() => useFinance());

        expect(financeService.subscribeToEarnings).toHaveBeenCalledWith('user-123', expect.any(Function));
    });

    it('should load expenses successfully', async () => {
        const mockExpenses = [{ id: '1', amount: 100 }];
        const mockUnsubscribe = vi.fn();

        vi.mocked(financeService.subscribeToEarnings).mockReturnValue(() => { });
        vi.mocked(financeService.subscribeToExpenses).mockImplementation((userId, callback) => {
            // callback is typed as (data: Expense[]) => void
            callback(mockExpenses as any);
            return mockUnsubscribe;
        });

        const { result } = renderHook(() => useFinance());

        // Since subscription callback is synchronous in our mock, state should update immediately
        expect(result.current.expenses).toEqual(mockExpenses);
        expect(result.current.expensesLoading).toBe(false);
        expect(financeService.subscribeToExpenses).toHaveBeenCalledWith('user-123', expect.any(Function));
    });

    it('should add expense successfully', async () => {
        vi.mocked(financeService.addExpense).mockResolvedValue('new-id');
        vi.mocked(financeService.subscribeToEarnings).mockReturnValue(() => { });
        vi.mocked(financeService.subscribeToExpenses).mockReturnValue(() => { });

        const { result } = renderHook(() => useFinance());
        const newExpense = {
            amount: 50,
            vendor: 'Test',
            userId: 'user-123',
            category: 'general',
            date: new Date().toISOString(),
            description: 'Test expense'
        };

        let success;
        await act(async () => {
            success = await result.current.actions.addExpense(newExpense);
        });

        expect(success).toBe(true);
        expect(financeService.addExpense).toHaveBeenCalledWith(newExpense);
    });
});
