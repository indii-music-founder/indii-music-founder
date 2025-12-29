import { useCallback, useEffect, useState } from 'react';
import { useStore } from '@/core/store';
import { useToast } from '@/core/context/ToastContext';
import * as Sentry from '@sentry/react';
import { FinanceService, Expense } from '@/services/finance/FinanceService';

export function useFinance() {
    const { finance, fetchEarnings, userProfile } = useStore();
    const { earningsSummary, loading: earningsLoading, error: earningsError } = finance;
    const toast = useToast();

    // Expenses State matching component logic
    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [expensesLoading, setExpensesLoading] = useState(false);

    const loadEarnings = useCallback(async (startDate: string, endDate: string) => {
        if (!userProfile?.id) return;

        try {
            await fetchEarnings({ startDate, endDate });
        } catch (err) {
            console.error("Failed to load earnings:", err);
            Sentry.captureException(err);
            toast.error("Failed to load earnings data.");
        }
    }, [fetchEarnings, userProfile?.id, toast]);

    const loadExpenses = useCallback(async () => {
        if (!userProfile?.id) return;
        setExpensesLoading(true);
        try {
            const data = await FinanceService.getExpenses(userProfile.id);
            setExpenses(data);
        } catch (e) {
            console.error(e);
            Sentry.captureException(e);
            toast.error("Failed to load expenses.");
        } finally {
            setExpensesLoading(false);
        }
    }, [userProfile?.id, toast]);

    const addExpense = useCallback(async (expenseData: Omit<Expense, 'id' | 'createdAt'>) => {
        try {
            await FinanceService.addExpense(expenseData);
            // Optimistic update or refresh
            loadExpenses();
            return true;
        } catch (e) {
            console.error(e);
            Sentry.captureException(e);
            toast.error("Failed to add expense.");
            return false;
        }
    }, [loadExpenses, toast]);

    // Initial load for demo purposes (Current Month)
    useEffect(() => {
        if (userProfile?.id) {
            if (!earningsSummary && !earningsLoading) {
                // Default to current month window
                const now = new Date();
                const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
                const end = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString();
                loadEarnings(start, end);
            }
            // Load expenses implicitly on mount if not loaded? 
            // The component seems to load it on mount, let's keep it explicit in the component or do it here.
            // For now, exposing loadExpenses action is enough.
        }
    }, [userProfile?.id, earningsSummary, earningsLoading, loadEarnings]);

    return {
        // Earnings
        earningsSummary,
        earningsLoading,
        earningsError,

        // Expenses
        expenses,
        expensesLoading,

        actions: {
            loadEarnings,
            loadExpenses,
            addExpense
        }
    };
}
