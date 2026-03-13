import { useCallback, useEffect, useState } from 'react';
import { useStore } from '@/core/store';
import { useToast } from '@/core/context/ToastContext';
import * as Sentry from '@sentry/react';
import { financeService, Expense } from '@/services/finance/FinanceService';
import { safeUnsubscribe } from '@/utils/safeUnsubscribe';
import { type EarningsSummary as ValidatedEarningsSummary } from '@/services/revenue/schema';
import { logger } from '@/utils/logger';

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
        const unsubscribe = financeService.subscribeToEarnings(userProfile.id, (data: any) => {
            setEarningsSummary(data);
            setEarningsLoading(false);
            if (!data) {
                console.info('[useFinance] No validated earnings data available for user.');
            }
        });

        return () => safeUnsubscribe(unsubscribe);
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

        return () => safeUnsubscribe(unsubscribe);
    }, [userProfile?.id]);

    const addExpense = useCallback(async (expenseData: Omit<Expense, 'id' | 'createdAt'>) => {
        const tempId = `temp-${Date.now()}`;
        const tentativeExpense: Expense = {
            ...expenseData,
            id: tempId,
            createdAt: new Date().toISOString()
        };

        // Optimistic UI update
        setExpenses(prev => [tentativeExpense, ...prev]);

        try {
            const newExpense = await financeService.addExpense(expenseData);
            // Replace temporary with actual from server (or rely on subscription)
            setExpenses(prev => prev.map(e => e.id === tempId ? newExpense : e));
            return true;
        } catch (e) {
            logger.error("Operation failed:", e);
            Sentry.captureException(e);
            toast.error("Failed to add expense.");
            // Rollback optimistic update
            setExpenses(prev => prev.filter(e => e.id !== tempId));
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
