import { useCallback, useEffect, useRef, useState } from 'react';
import { useStore } from '@/core/store';
import { useShallow } from 'zustand/react/shallow';
import * as Sentry from '@sentry/react';
import { financeService, Expense } from '@/services/finance/FinanceService';
import { safeUnsubscribe } from '@/utils/safeUnsubscribe';
import { type EarningsSummary as ValidatedEarningsSummary } from '@/services/revenue/schema';
import { logger } from '@/utils/logger';

export function useFinance() {
    const { user } = useStore(useShallow(state => ({
        user: state.user
    })));

    const [earningsSummary, setEarningsSummary] = useState<ValidatedEarningsSummary | null>(null);
    const [earningsLoading, setEarningsLoading] = useState(true);
    // ISSUE-1278: this previously destructured only the value, with no setter, so
    // the field could never change from null — any earnings-subscription failure
    // was structurally invisible to the UI.
    const [earningsError, setEarningsError] = useState<string | null>(null);

    // Expenses State
    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [expensesLoading, setExpensesLoading] = useState(true);
    const [expensesError, setExpensesError] = useState<string | null>(null);

    // Mounted guard to prevent state updates on unmounted component (Firestore b815 crash fix)
    const isMountedRef = useRef(true);
    useEffect(() => {
        isMountedRef.current = true;
        return () => { isMountedRef.current = false; };
    }, []);

    // Subscribe to Earnings
    useEffect(() => {
        if (!user?.uid) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setEarningsLoading(false);
            return;
        }

        setEarningsLoading(true);
        setEarningsError(null);
        const unsubscribe = financeService.subscribeToEarnings(user.uid, (data) => {
            if (!isMountedRef.current) return;
            setEarningsSummary(data);
            setEarningsLoading(false);
            setEarningsError(null);
            if (!data) {
                logger.info('[useFinance] No validated earnings data available for user.');
            }
        }, (error) => {
            // ISSUE-1278: clear the loading flag on failure. Without this the UI
            // spins forever, indistinguishable from a slow load.
            if (!isMountedRef.current) return;
            setEarningsLoading(false);
            setEarningsError(error.message || 'Failed to load earnings.');
        });

        return () => safeUnsubscribe(unsubscribe);
    }, [user?.uid]);

    // Subscribe to Expenses
    useEffect(() => {
        if (!user?.uid) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setExpensesLoading(false);
            return;
        }

        setExpensesLoading(true);
        setExpensesError(null);
        const unsubscribe = financeService.subscribeToExpenses(user.uid, (data: Expense[]) => {
            if (!isMountedRef.current) return;
            setExpenses(data);
            setExpensesLoading(false);
            setExpensesError(null);
        }, (error) => {
            // ISSUE-1278: as above — surface the failure instead of hanging.
            if (!isMountedRef.current) return;
            setExpensesLoading(false);
            setExpensesError(error.message || 'Failed to load expenses.');
        });

        return () => safeUnsubscribe(unsubscribe);
    }, [user?.uid]);

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
            return newExpense;
        } catch (e: unknown) {
            logger.error("Operation failed:", e);
            Sentry.captureException(e);
            // Rollback optimistic update
            setExpenses(prev => prev.filter(e => e.id !== tempId));
            throw e;
        }
    }, []);

    return {
        // Earnings
        earningsSummary,
        earningsLoading,
        earningsError,

        // Expenses
        expenses,
        expensesLoading,
        expensesError,

        actions: {
            addExpense
        }
    };
}
