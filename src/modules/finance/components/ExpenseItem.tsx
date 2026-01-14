import React from 'react';
import { CheckCircle, Receipt } from 'lucide-react';
import { Expense } from '@/services/finance/FinanceService';
import { motion } from 'framer-motion';

interface ExpenseItemProps {
    expense: Expense;
}

export const ExpenseItem = React.memo(({ expense }: ExpenseItemProps) => {
    return (
        <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            whileHover={{ scale: 1.01 }}
            className="bg-white/5 backdrop-blur-sm p-4 rounded-xl border border-white/10 flex justify-between items-center hover:bg-white/10 hover:border-white/20 transition-all cursor-default group"
        >
            <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-gray-400 group-hover:text-teal-400 group-hover:border-teal-500/30 transition-all">
                    <Receipt size={18} />
                </div>
                <div>
                    <h4 className="text-white font-medium group-hover:text-teal-500 transition-colors">{expense.vendor}</h4>
                    <p className="text-[10px] text-gray-500 uppercase tracking-wider font-bold mt-0.5">{expense.date} • {expense.category}</p>
                </div>
            </div>
            <div className="flex flex-col items-end">
                <div className="text-white font-mono font-bold text-lg">
                    -${expense.amount.toFixed(2)}
                </div>
                <div className="text-[10px] text-emerald-500 flex items-center gap-1">
                    <CheckCircle size={10} />
                    Verified
                </div>
            </div>
        </motion.div>
    );
});

ExpenseItem.displayName = 'ExpenseItem';
