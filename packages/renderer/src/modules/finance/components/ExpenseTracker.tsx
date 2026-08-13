import React, { useState, useCallback, useMemo } from 'react';
import { motion } from 'motion/react';
import { AlertCircle, DollarSign, Loader2, Plus } from 'lucide-react';
import { useToast } from '@/core/context/ToastContext';
import { useFinance } from '../hooks/useFinance';
import { Expense } from '@/services/finance/FinanceService';
import { useStore } from '@/core/store';
import { useShallow } from 'zustand/react/shallow';
import { ExpenseItem } from './ExpenseItem';
import { ExpenseManualEntryModal } from './ExpenseManualEntryModal';
import { isPaidExpense } from '@/modules/finance/schemas';
import { EmptyState } from '@/components/shared/EmptyState';

export const ExpenseTracker: React.FC = React.memo(() => {
    const { userId } = useStore(useShallow(state => ({
        userId: state.user?.uid
    })));
    const {
        expenses,
        expensesLoading: isLoading,
        actions: { addExpense }
    } = useFinance();

    // Manual Entry State
    const [showManualEntry, setShowManualEntry] = useState(false);

    const toast = useToast();

    // ⚡ Bolt Optimization: Memoize total calculation to avoid O(N) on every keystroke
    const expenseTotals = useMemo(() => {
        return expenses.reduce((totals, expense) => {
            if (isPaidExpense(expense)) totals.paid += expense.amount;
            else if (expense.paymentStatus === 'expected') totals.expected += expense.amount;
            else totals.unclassified += 1;
            return totals;
        }, { paid: 0, expected: 0, unclassified: 0 });
    }, [expenses]);

    // ⚡ Bolt Optimization: Memoize list rendering to avoid re-mapping on form updates
    const expenseList = useMemo(() => {
        if (isLoading) {
            return (
                <div className="flex flex-col items-center justify-center py-20">
                    <Loader2 className="animate-spin text-gray-600 mb-2" />
                    <p className="text-gray-500 text-sm">Loading expenses...</p>
                </div>
            );
        }
        if (expenses.length === 0) {
            return (
                <EmptyState
                    icon="document"
                    title="No expenses recorded"
                    description="Record paid and expected costs separately so forecasts never masquerade as spending."
                    action={{ label: 'Add Expense', onClick: () => setShowManualEntry(true) }}
                    compact
                />
            );
        }
        return expenses.map(expense => (
            <ExpenseItem key={expense.id} expense={expense} />
        ));
    }, [expenses, isLoading]);

    const handleAddExpense = useCallback(async (data: Partial<Expense>) => {
        if (!userId) {
            const error = new Error('An authenticated user profile is required to add an expense.');
            toast.error('Sign in before adding an expense.');
            throw error;
        }

        if (!data.date?.match(/^\d{4}-\d{2}-\d{2}$/) || !data.paymentStatus) {
            const error = new Error('Expense date and payment status are required.');
            toast.error(error.message);
            throw error;
        }

        const expenseData = {
            userId,
            vendor: data.vendor || 'Unknown Vendor',
            date: data.date,
            amount: Number(data.amount),
            category: data.category || 'Other',
            description: data.description || 'Manual Entry',
            paymentStatus: data.paymentStatus,
            evidenceStatus: 'unverified' as const,
        };

        try {
            await addExpense(expenseData);
            toast.success("Expense added manually.");
        } catch (error) {
            toast.error('Failed to add expense.');
            throw error;
        }
    }, [userId, addExpense, toast]);

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-black/40 backdrop-blur-xl rounded-2xl border border-white/10 flex flex-col min-h-[400px] h-full max-h-[600px] md:h-[600px] relative overflow-hidden"
        >
            <div className="p-6 border-b border-white/10 flex justify-between items-center bg-white/5">
                <div>
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-teal-500/10 flex items-center justify-center text-teal-400">
                            <DollarSign size={16} />
                        </div>
                        Expense Tracker
                    </h2>
                    <p className="text-sm text-gray-400 mt-1 ml-10">Paid, expected, and evidence status stay separate</p>
                </div>
                <div className="flex items-center gap-4">
                    <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => setShowManualEntry(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-teal-500/10 hover:bg-teal-500/20 text-teal-400 text-sm font-medium rounded-lg transition-colors border border-teal-500/20"
                    >
                        <Plus size={16} />
                        Add Manual
                    </motion.button>
                    <div className="text-right px-3 py-2 bg-white/5 rounded-lg border border-white/5">
                        <div className="text-xl font-bold text-white">${expenseTotals.paid.toFixed(2)}</div>
                        <div className="text-[10px] uppercase tracking-wider text-gray-500 font-medium">Paid</div>
                    </div>
                    <div className="text-right px-3 py-2 bg-white/5 rounded-lg border border-white/5">
                        <div className="text-xl font-bold text-amber-300">${expenseTotals.expected.toFixed(2)}</div>
                        <div className="text-[10px] uppercase tracking-wider text-gray-500 font-medium">Expected</div>
                    </div>
                </div>
            </div>

            {/* Manual Entry Modal */}
            {showManualEntry && (
                <ExpenseManualEntryModal
                    onClose={() => setShowManualEntry(false)}
                    onAdd={handleAddExpense}
                />
            )}

            <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
                <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                    {expenseList}
                </div>

                {/* Drop Zone */}
                <div className="w-full md:w-1/3 p-4 border-l border-white/10 bg-black/20 flex flex-col items-center justify-center">
                    <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-center">
                        <AlertCircle className="mx-auto mb-3 text-amber-400" size={26} />
                        <p className="text-sm font-semibold text-amber-200">Receipt upload unavailable</p>
                        <p className="mt-2 text-xs leading-relaxed text-gray-400">Secure upload, extraction review, and durable evidence linking are not connected yet. Use manual entry; it will remain unverified.</p>
                        {expenseTotals.unclassified > 0 && (
                            <p className="mt-3 text-[10px] text-amber-300">{expenseTotals.unclassified} older record{expenseTotals.unclassified === 1 ? '' : 's'} need payment classification.</p>
                        )}
                    </div>
                </div>
            </div>
        </motion.div>
    );
});

ExpenseTracker.displayName = 'ExpenseTracker';
