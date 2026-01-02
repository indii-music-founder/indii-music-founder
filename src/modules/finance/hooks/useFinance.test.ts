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
    FinanceService: vi.fn(), // Class mock if needed, but we use instance
    financeService: {
        getExpenses: vi.fn(),
        addExpense: vi.fn(),
        fetchEarnings: vi.fn()
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
    const mockToast = { error: vi.fn(), success: vi.fn() };

    beforeEach(() => {
        vi.clearAllMocks();

        (useStore as any).mockReturnValue({
            finance: mockFinanceState,
            fetchEarnings: mockFetchEarnings,
            userProfile: mockUserProfile,
        });

        (useToast as any).mockReturnValue(mockToast);
    });

    it('should initialize with default states', () => {
        const { result } = renderHook(() => useFinance());

        expect(result.current.earningsSummary).toBeNull();
        expect(result.current.expenses).toEqual([]);
        expect(result.current.expensesLoading).toBe(false);
    });

    it('should load earnings on mount if user is logged in', () => {
        renderHook(() => useFinance());

        // useEffect should trigger loadEarnings which calls fetchEarnings
        // Note: fetchEarnings is called with a date range
        expect(mockFetchEarnings).toHaveBeenCalled();
    });

    it('should load expenses successfully', async () => {
        const mockExpenses = [{ id: '1', amount: 100 } as any];
        (financeService.getExpenses as any).mockResolvedValue(mockExpenses);

        const { result } = renderHook(() => useFinance());

        await act(async () => {
            await result.current.actions.loadExpenses();
        });

        expect(result.current.expenses).toEqual(mockExpenses);
        expect(financeService.getExpenses).toHaveBeenCalledWith('user-123');
    });

    it('should handle errors when loading expenses', async () => {
        const error = new Error('Fetch failed');
        (financeService.getExpenses as any).mockRejectedValue(error);

        const { result } = renderHook(() => useFinance());

        await act(async () => {
            await result.current.actions.loadExpenses();
        });

        expect(Sentry.captureException).toHaveBeenCalledWith(error);
        expect(mockToast.error).toHaveBeenCalledWith('Failed to load expenses.');
        expect(result.current.expenses).toEqual([]);
    });

    it('should add expense successfully', async () => {
        (financeService.addExpense as any).mockResolvedValue('new-id');
        (financeService.getExpenses as any).mockResolvedValue([]);

        const { result } = renderHook(() => useFinance());
        const newExpense = { amount: 50, vendor: 'Test' } as any;

        await act(async () => {
            const success = await result.current.actions.addExpense(newExpense);
            expect(success).toBe(true);
        });

        expect(financeService.addExpense).toHaveBeenCalledWith(newExpense);
        // It should also reload expenses
        expect(financeService.getExpenses).toHaveBeenCalled();
    });
});
