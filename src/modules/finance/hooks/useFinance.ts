import { useCallback, useEffect, useState } from 'react';
import { useStore } from '@/core/store';
import { useToast } from '@/core/context/ToastContext';
import * as Sentry from '@sentry/react';
import { financeService, Expense } from '@/services/finance/FinanceService';
import { type EarningsSummary as ValidatedEarningsSummary } from '@/services/revenue/schema';

export function useFinance() {
    const { userProfile } = useStore();

    const [earningsSummary, setEarningsSummary] = useState<ValidatedEarningsSummary | null>(null);
    const [earningsLoading, setEarningsLoading] = useState(true);
    const [earningsError, setEarningsError] = useState<string | null>(null);

    const toast = useToast();

    // Expenses State
    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [expensesLoading, setExpensesLoading] = useState(true);

    // Subscribe to Earnings
    useEffect(() => {
        if (!userProfile?.id) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setEarningsLoading(false);
            return;
        }

        setEarningsLoading(true);
        const unsubscribe = financeService.subscribeToEarnings(userProfile.id, (data: ValidatedEarningsSummary | null) => {
            setEarningsSummary(data);
            setEarningsLoading(false);
            if (!data) {
                console.info('[useFinance] No validated earnings data available for user.');
            }
        });

        return () => unsubscribe();
    }, [userProfile?.id]);

    // Subscribe to Expenses
    useEffect(() => {
        if (!userProfile?.id) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setExpensesLoading(false);
            return;
        }

        setExpensesLoading(true);
        const unsubscribe = financeService.subscribeToExpenses(userProfile.id, (data: Expense[]) => {
            setExpenses(data);
            setExpensesLoading(false);
        });

        return () => unsubscribe();
    }, [userProfile?.id]);

    const addExpense = useCallback(async (expenseData: Omit<Expense, 'id' | 'createdAt'>) => {
        try {
            const newExpense = await financeService.addExpense(expenseData);
            // ⚡ Bolt Optimization: Update local state instead of re-fetching
            setExpenses(prev => [newExpense, ...prev]);
            return true;
        } catch (e) {
            console.error(e);
            Sentry.captureException(e);
            toast.error("Failed to add expense.");
            return false;
        }
    }, [toast]);

    // Initial load (Current Month) - Removed undefined loadEarnings call
    /*
    useEffect(() => {
        // ... Logic relying on undefined loadEarnings removed
    }, [userProfile?.id, earningsSummary, earningsLoading]);
    */

    return {
        // Earnings
        earningsSummary,
        earningsLoading,
        earningsError,

        // Expenses
        expenses,
        expensesLoading,

        actions: {
            addExpense
        }
    };
}
