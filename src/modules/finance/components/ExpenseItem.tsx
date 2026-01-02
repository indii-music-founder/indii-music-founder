import React from 'react';
import { CheckCircle } from 'lucide-react';
import { Expense } from '@/services/finance/FinanceService';

interface ExpenseItemProps {
    expense: Expense;
}

export const ExpenseItem = React.memo(({ expense }: ExpenseItemProps) => {
    return (
        <div className="bg-[#161b22] p-4 rounded-lg border border-gray-800 flex justify-between items-center hover:border-gray-700 transition-colors">
            <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center text-gray-400">
                    <CheckCircle size={18} />
                </div>
                <div>
                    <h4 className="text-white font-medium">{expense.vendor}</h4>
                    <p className="text-xs text-gray-400">{expense.date} • {expense.category}</p>
                </div>
            </div>
            <div className="text-white font-mono font-bold">
                -${expense.amount.toFixed(2)}
            </div>
        </div>
    );
});

ExpenseItem.displayName = 'ExpenseItem';
