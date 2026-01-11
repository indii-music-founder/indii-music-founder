import React, { useState } from 'react';
import { X, Plus, AlertCircle } from 'lucide-react';
import { useToast } from '@/core/context/ToastContext';
import { Expense } from '@/services/finance/FinanceService';
import { motion, AnimatePresence } from 'framer-motion';

interface ExpenseManualEntryModalProps {
    onClose: () => void;
    onAdd: (expenseData: Partial<Expense>) => Promise<void>;
}

export const ExpenseManualEntryModal: React.FC<ExpenseManualEntryModalProps> = ({ onClose, onAdd }) => {
    const [manualForm, setManualForm] = useState<Partial<Expense>>({
        date: new Date().toISOString().split('T')[0],
        category: 'Equipment',
        vendor: '',
        amount: 0,
        description: ''
    });

    const [isSubmitting, setIsSubmitting] = useState(false);
    const toast = useToast();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!manualForm.vendor || !manualForm.amount || manualForm.amount <= 0) {
            toast.error("Valid Vendor and Amount are required.");
            return;
        }

        setIsSubmitting(true);
        try {
            await onAdd(manualForm);
            onClose();
        } catch (error) {
            console.error(error);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-xl flex items-center justify-center p-4">
                <motion.div
                    initial={{ opacity: 0, scale: 0.9, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, y: 20 }}
                    className="bg-black/80 backdrop-blur-2xl border border-white/10 rounded-3xl w-full max-w-md overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.5)] border-white/20"
                >
                    <div className="p-8 pb-4 flex justify-between items-center bg-white/5">
                        <div>
                            <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                <Plus size={20} className="text-teal-400" />
                                Add Expense
                            </h3>
                            <p className="text-xs text-gray-400 mt-1 uppercase tracking-widest font-bold">Manual Ledger Entry</p>
                        </div>
                        <motion.button
                            whileHover={{ scale: 1.1, rotate: 90 }}
                            whileTap={{ scale: 0.9 }}
                            onClick={onClose}
                            className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-gray-400 hover:text-white transition-colors"
                            type="button"
                        >
                            <X size={20} />
                        </motion.button>
                    </div>

                    <form onSubmit={handleSubmit} className="p-8 space-y-6">
                        <div className="space-y-4">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest ml-1">Vendor / Merchant</label>
                                <input
                                    autoFocus
                                    className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-sm text-white focus:border-teal-500 focus:bg-white/10 outline-none transition-all placeholder:text-gray-600"
                                    placeholder="e.g. Sweetwater"
                                    value={manualForm.vendor || ''}
                                    onChange={e => setManualForm({ ...manualForm, vendor: e.target.value })}
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest ml-1">Date</label>
                                    <input
                                        type="date"
                                        className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-sm text-white focus:border-teal-500 outline-none transition-all"
                                        value={manualForm.date || ''}
                                        onChange={e => setManualForm({ ...manualForm, date: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest ml-1">Amount ($)</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-sm text-white focus:border-emerald-500 outline-none transition-all placeholder:text-gray-600"
                                        placeholder="0.00"
                                        value={manualForm.amount || ''}
                                        onChange={e => setManualForm({ ...manualForm, amount: parseFloat(e.target.value) })}
                                    />
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest ml-1">Category</label>
                                <div className="relative">
                                    <select
                                        className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-sm text-white focus:border-teal-500 outline-none transition-all appearance-none cursor-pointer"
                                        value={manualForm.category || 'Other'}
                                        onChange={e => setManualForm({ ...manualForm, category: e.target.value })}
                                    >
                                        <option className="bg-[#1a1a1a]">Equipment</option>
                                        <option className="bg-[#1a1a1a]">Software / Plugins</option>
                                        <option className="bg-[#1a1a1a]">Marketing</option>
                                        <option className="bg-[#1a1a1a]">Travel</option>
                                        <option className="bg-[#1a1a1a]">Services</option>
                                        <option className="bg-[#1a1a1a]">Other</option>
                                    </select>
                                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500">
                                        <Plus size={14} className="rotate-45" />
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest ml-1">Description (Optional)</label>
                                <textarea
                                    className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-sm text-white focus:border-teal-500 outline-none h-24 resize-none transition-all placeholder:text-gray-600"
                                    placeholder="Details..."
                                    value={manualForm.description || ''}
                                    onChange={e => setManualForm({ ...manualForm, description: e.target.value })}
                                />
                            </div>
                        </div>

                        <div className="pt-2 flex flex-col gap-4">
                            <div className="flex items-center gap-2 px-4 py-2 bg-emerald-500/5 border border-emerald-500/10 rounded-xl">
                                <AlertCircle size={14} className="text-emerald-500" />
                                <span className="text-[10px] text-emerald-400 font-medium tracking-tight">Validating balanced ledger entry...</span>
                            </div>

                            <motion.button
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                type="submit"
                                disabled={isSubmitting}
                                className="w-full bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white font-bold py-4 rounded-2xl transition-all shadow-lg shadow-teal-500/20 disabled:opacity-50"
                            >
                                {isSubmitting ? 'Recording Transaction...' : 'Confirm Ledger Entry'}
                            </motion.button>
                        </div>
                    </form>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};
