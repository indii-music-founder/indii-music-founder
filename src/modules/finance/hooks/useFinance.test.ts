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
        const mockExpenses = [{ id: '1', amount: 100 }];
        vi.mocked(financeService.getExpenses).mockResolvedValue(mockExpenses as any);

        const { result } = renderHook(() => useFinance());

        await act(async () => {
            await result.current.actions.loadExpenses();
        });

        expect(result.current.expenses).toEqual(mockExpenses);
        expect(financeService.getExpenses).toHaveBeenCalledWith('user-123');
    });

    it('should handle errors when loading expenses', async () => {
        const error = new Error('Fetch failed');
        vi.mocked(financeService.getExpenses).mockRejectedValue(error);

        const { result } = renderHook(() => useFinance());

        await act(async () => {
            await result.current.actions.loadExpenses();
        });

        expect(Sentry.captureException).toHaveBeenCalledWith(error);
        expect(mockToast.error).toHaveBeenCalledWith('Failed to load expenses.');
        expect(result.current.expenses).toEqual([]);
    });

    it('should add expense successfully', async () => {
        const newExpenseInput = {
            amount: 50,
            vendor: 'Test',
            userId: 'user-123',
            category: 'general',
            date: new Date().toISOString(),
            description: 'Test expense'
        };

        const expectedExpense = {
            ...newExpenseInput,
            id: 'new-id',
            createdAt: new Date().toISOString()
        };

        vi.mocked(financeService.addExpense).mockResolvedValue(expectedExpense as any);
        vi.mocked(financeService.getExpenses).mockResolvedValue([]);

        const { result } = renderHook(() => useFinance());

        await act(async () => {
            const success = await result.current.actions.addExpense(newExpenseInput);
            expect(success).toBe(true);
        });

        expect(financeService.addExpense).toHaveBeenCalledWith(newExpenseInput);

        // ⚡ Bolt Optimization: Verify local state update without re-fetch
        expect(financeService.getExpenses).not.toHaveBeenCalled();
        expect(result.current.expenses).toContainEqual(expectedExpense);
    });
});
