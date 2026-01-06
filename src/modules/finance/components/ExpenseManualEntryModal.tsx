import React, { useState } from 'react';
import { X } from 'lucide-react';
import { useToast } from '@/core/context/ToastContext';
import { Expense } from '@/services/finance/FinanceService';

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

        if (!manualForm.vendor || !manualForm.amount) {
            toast.error("Vendor and Amount are required.");
            return;
        }

        setIsSubmitting(true);
        try {
            await onAdd(manualForm);
            // Success toast is handled by parent or we can do it here.
            // The previous implementation had it in the submit handler.
            // Let's rely on the parent's action to succeed or fail, but the parent shows the toast in the original code.
            // Wait, looking at original code: toast.success("Expense added manually.") was inside handleManualSubmit.
            // I'll leave the toast logic in the parent (onAdd wrapper) or put it here?
            // "onAdd" returns Promise<void>.
            // I'll let the parent handle the toast for consistency, or I can do it here.
            // In the plan, I said "Update handleAddExpense to accept data".
            // I'll keep the toast in the parent to keep `onAdd` as the "Business Logic + Feedback" handler.
            onClose();
        } catch (error) {
            console.error(error);
            // Error toast handled by parent usually? In original code, it was inside the try/catch.
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-[#161b22] border border-gray-700 rounded-xl w-full max-w-md p-6 shadow-2xl animate-in fade-in zoom-in duration-200">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-lg font-bold text-white">Add Manual Expense</h3>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-white"
                        type="button"
                    >
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-xs text-gray-400 mb-1">Vendor / Merchant</label>
                        <input
                            autoFocus
                            className="w-full bg-[#0d1117] border border-gray-700 rounded p-2 text-sm text-white focus:border-teal-500 outline-none"
                            placeholder="e.g. Sweetwater"
                            value={manualForm.vendor || ''}
                            onChange={e => setManualForm({ ...manualForm, vendor: e.target.value })}
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs text-gray-400 mb-1">Date</label>
                            <input
                                type="date"
                                className="w-full bg-[#0d1117] border border-gray-700 rounded p-2 text-sm text-white focus:border-teal-500 outline-none"
                                value={manualForm.date || ''}
                                onChange={e => setManualForm({ ...manualForm, date: e.target.value })}
                            />
                        </div>
                        <div>
                            <label className="block text-xs text-gray-400 mb-1">Amount ($)</label>
                            <input
                                type="number"
                                step="0.01"
                                className="w-full bg-[#0d1117] border border-gray-700 rounded p-2 text-sm text-white focus:border-teal-500 outline-none"
                                placeholder="0.00"
                                value={manualForm.amount || ''}
                                onChange={e => setManualForm({ ...manualForm, amount: parseFloat(e.target.value) })}
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs text-gray-400 mb-1">Category</label>
                        <select
                            className="w-full bg-[#0d1117] border border-gray-700 rounded p-2 text-sm text-white focus:border-teal-500 outline-none"
                            value={manualForm.category || 'Other'}
                            onChange={e => setManualForm({ ...manualForm, category: e.target.value })}
                        >
                            <option>Equipment</option>
                            <option>Software / Plugins</option>
                            <option>Marketing</option>
                            <option>Travel</option>
                            <option>Services</option>
                            <option>Other</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-xs text-gray-400 mb-1">Description (Optional)</label>
                        <textarea
                            className="w-full bg-[#0d1117] border border-gray-700 rounded p-2 text-sm text-white focus:border-teal-500 outline-none h-20 resize-none"
                            placeholder="Details..."
                            value={manualForm.description || ''}
                            onChange={e => setManualForm({ ...manualForm, description: e.target.value })}
                        />
                    </div>

                    <div className="pt-2">
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="w-full bg-teal-600 hover:bg-teal-500 text-white font-medium py-2 rounded-lg transition-colors disabled:opacity-50"
                        >
                            {isSubmitting ? 'Adding...' : 'Add Expense'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
