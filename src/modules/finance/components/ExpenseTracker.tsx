import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { useDropzone } from 'react-dropzone';
import { motion } from 'framer-motion';
import { DollarSign, Camera, Loader2, Plus } from 'lucide-react';
import { FinanceTools } from '@/services/agent/tools/FinanceTools';
import { useToast } from '@/core/context/ToastContext';
import { useFinance } from '../hooks/useFinance';
import { Expense } from '@/services/finance/FinanceService';
import { useStore } from '@/core/store';
import { ExpenseItem } from './ExpenseItem';
import { ExpenseManualEntryModal } from './ExpenseManualEntryModal';
import { ReceiptScanResultSchema } from '@/modules/finance/schemas';

export const ExpenseTracker: React.FC = React.memo(() => {
    const { userProfile } = useStore();
    const {
        expenses,
        expensesLoading: isLoading,
        actions: { addExpense }
    } = useFinance();

    // UI State for analysis only
    const [isAnalyzing, setIsAnalyzing] = useState(false);

    // Manual Entry State
    const [showManualEntry, setShowManualEntry] = useState(false);

    const toast = useToast();

    // ⚡ Bolt Optimization: Memoize total calculation to avoid O(N) on every keystroke
    const totalSpend = useMemo(() => {
        return expenses.reduce((a, b) => a + b.amount, 0).toFixed(2);
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
                <div className="text-center text-gray-500 py-10">
                    No expenses recorded yet. Note your costs to calculate tax deductions.
                </div>
            );
        }
        return expenses.map(expense => (
            <ExpenseItem key={expense.id} expense={expense} />
        ));
    }, [expenses, isLoading]);

    const processFile = useCallback(async (file: File) => {
        if (!userProfile?.id) return;
        setIsAnalyzing(true);

        try {
            const reader = new FileReader();
            reader.onload = async () => {
                try {
                    const base64String = reader.result?.toString().split(',')[1];
                    if (!base64String) {
                        setIsAnalyzing(false);
                        return;
                    }

                    const resultJson = await FinanceTools.analyze_receipt({
                        image_data: base64String,
                        mime_type: file.type
                    });

                    const jsonMatch = resultJson.data?.raw_data?.match(/\{[\s\S]*\}/);
                    if (jsonMatch && userProfile?.id) {
                        const rawData = JSON.parse(jsonMatch[0]);

                        // Zod Validation for AI Output
                        const validation = ReceiptScanResultSchema.safeParse(rawData);
                        if (!validation.success) {
                             throw new Error("Invalid receipt format returned by AI.");
                        }

                        const data = validation.data;

                        const expenseData = {
                            userId: userProfile.id,
                            vendor: data.vendor || 'Unknown Vendor',
                            date: data.date || new Date().toISOString().split('T')[0],
                            amount: Number(data.amount) || 0,
                            category: data.category || 'Other',
                            description: data.description || '',
                        };

                        await addExpense(expenseData);
                        toast.success(`Scanned receipt from ${expenseData.vendor}`);
                    } else {
                        toast.error("Could not read receipt data.");
                    }
                } catch (e) {
                    console.error("Receipt analysis error:", e);
                    toast.error("Failed to analyze receipt.");
                } finally {
                    setIsAnalyzing(false);
                }
            };
            reader.readAsDataURL(file);
        } catch (e) {
            console.error(e);
            toast.error("Failed to read file.");
            setIsAnalyzing(false);
        }
    }, [userProfile?.id, toast, addExpense]);

    const handleAddExpense = useCallback(async (data: Partial<Expense>) => {
        if (!userProfile?.id) return;

        const expenseData = {
            userId: userProfile.id as string,
            vendor: data.vendor || 'Unknown Vendor',
            date: data.date || new Date().toISOString().split('T')[0],
            amount: Number(data.amount),
            category: data.category || 'Other',
            description: data.description || 'Manual Entry',
        };

        await addExpense(expenseData);
        toast.success("Expense added manually.");
    }, [userProfile?.id, addExpense, toast]);

    const onDrop = useCallback((acceptedFiles: File[]) => {
        acceptedFiles.forEach(processFile);
    }, [processFile]);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop, accept: { 'image/*': [] } });

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-black/40 backdrop-blur-xl rounded-2xl border border-white/10 flex flex-col h-[600px] relative overflow-hidden"
        >
            <div className="p-6 border-b border-white/10 flex justify-between items-center bg-white/5">
                <div>
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-teal-500/10 flex items-center justify-center text-teal-400">
                            <DollarSign size={16} />
                        </div>
                        Expense Tracker
                    </h2>
                    <p className="text-sm text-gray-400 mt-1 ml-10">Drag & drop receipts for AI Analysis</p>
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
                    <div className="text-right px-4 py-2 bg-white/5 rounded-lg border border-white/5">
                        <div className="text-2xl font-bold text-white">${totalSpend}</div>
                        <div className="text-[10px] uppercase tracking-wider text-gray-500 font-medium">Total Spend</div>
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
                <div className="w-full md:w-1/3 p-4 border-l border-white/10 bg-black/20">
                    <div
                        {...getRootProps()}
                        className={`h-full border-2 border-dashed rounded-xl flex flex-col items-center justify-center text-center p-6 cursor-pointer transition-all duration-300 ${isDragActive
                            ? 'border-teal-500 bg-teal-500/10 scale-[0.98]'
                            : 'border-white/10 hover:border-white/20 hover:bg-white/5'
                            }`}
                    >
                        <input {...getInputProps()} />
                        {isAnalyzing ? (
                            <div className="flex flex-col items-center">
                                <Loader2 className="animate-spin text-teal-500 mb-4" size={32} />
                                <p className="text-teal-400 font-medium animate-pulse">Analyzing Receipt...</p>
                                <p className="text-xs text-gray-500 mt-2">Extracting Vendor & Amount</p>
                            </div>
                        ) : (
                            <>
                                <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mb-4 text-gray-400 group-hover:text-white transition-colors border border-white/5">
                                    <Camera size={24} />
                                </div>
                                <p className="text-white font-medium mb-2">Scan Receipt</p>
                                <p className="text-xs text-gray-500 max-w-[200px]">
                                    Drop an image here or click to upload. AI will automatically extract details.
                                </p>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </motion.div>
    );
});

ExpenseTracker.displayName = 'ExpenseTracker';
