import { useCallback, useEffect, useState } from 'react';
import { useStore } from '@/core/store';
import { useToast } from '@/core/context/ToastContext';
import * as Sentry from '@sentry/react';
import { financeService, Expense } from '@/services/finance/FinanceService';
import type { EarningsSummary as DSREarningsSummary } from '@/services/ddex/types/dsr';

export function useFinance() {
    const { userProfile } = useStore();

    const [earningsSummary, setEarningsSummary] = useState<DSREarningsSummary | null>(null);
    const [earningsLoading, setEarningsLoading] = useState(true);
    const [earningsError, setEarningsError] = useState<string | null>(null);

    const toast = useToast();

    // Expenses State
    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [expensesLoading, setExpensesLoading] = useState(true);

    // Subscribe to Earnings
    useEffect(() => {
        if (!userProfile?.id) {
            setEarningsLoading(false);
            return;
        }

        setEarningsLoading(true);
        const unsubscribe = financeService.subscribeToEarnings(userProfile.id, (data: DSREarningsSummary | null) => {
            setEarningsSummary(data);
            setEarningsLoading(false);
        });

        return () => unsubscribe();
    }, [userProfile?.id]);

    // Subscribe to Expenses
    useEffect(() => {
        if (!userProfile?.id) {
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
            await financeService.addExpense(expenseData);
            return true;
        } catch (e) {
            console.error(e);
            Sentry.captureException(e);
            toast.error("Failed to add expense.");
            return false;
        }
    }, [toast]);

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
