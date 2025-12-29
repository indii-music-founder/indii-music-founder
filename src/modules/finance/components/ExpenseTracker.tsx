import React, { useState, useCallback, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, DollarSign, Camera, CheckCircle, Loader2, Plus, X } from 'lucide-react';
import { FinanceTools } from '@/services/agent/tools/FinanceTools';
import { useToast } from '@/core/context/ToastContext';
import { FinanceService, Expense } from '@/services/finance/FinanceService';
import { useStore } from '@/core/store';

export const ExpenseTracker: React.FC = () => {
    const { user } = useStore();
    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    // Manual Entry State
    const [showManualEntry, setShowManualEntry] = useState(false);
    const [manualForm, setManualForm] = useState<Partial<Expense>>({
        date: new Date().toISOString().split('T')[0],
        category: 'Equipment'
    });

    const toast = useToast();

    const loadExpenses = useCallback(async () => {
        if (!user) return;
        setIsLoading(true);
        try {
            const data = await FinanceService.getExpenses(user.uid);
            setExpenses(data);
        } catch (e) {
            console.error(e);
            toast.error("Failed to load expenses.");
        } finally {
            setIsLoading(false);
        }
    }, [user, toast]);

    useEffect(() => {
        loadExpenses();
    }, [loadExpenses]);

    const processFile = useCallback(async (file: File) => {
        if (!user) return;
        setIsAnalyzing(true);
        try {
            const reader = new FileReader();
            reader.onload = async () => {
                const base64String = reader.result?.toString().split(',')[1];
                if (!base64String) return;

                const resultJson = await FinanceTools.analyze_receipt({
                    image_data: base64String,
                    mime_type: file.type
                });

                const jsonMatch = resultJson.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    let data;
                    try {
                        data = JSON.parse(jsonMatch[0]);
                    } catch (e) {
                         console.error("Failed to parse receipt JSON", e);
                         toast.error("Failed to parse receipt data.");
                         setIsAnalyzing(false);
                         return;
                    }

                    const expenseData = {
                        userId: user.uid,
                        vendor: data.vendor || 'Unknown Vendor',
                        date: data.date || new Date().toISOString().split('T')[0],
                        amount: Number(data.amount) || 0,
                        category: data.category || 'Other',
                        description: data.description || '',
                    };

                    await FinanceService.addExpense(expenseData);
                    loadExpenses();
                    toast.success(`Scanned receipt from ${expenseData.vendor}`);
                } else {
                    toast.error("Could not read receipt data.");
                }
                setIsAnalyzing(false);
            };
            reader.readAsDataURL(file);
        } catch (e) {
            console.error(e);
            toast.error("Failed to analyze receipt.");
            setIsAnalyzing(false);
        }
    }, [user, toast, loadExpenses]);

    const handleManualSubmit = useCallback(async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;
        if (!manualForm.vendor || !manualForm.amount) {
            toast.error("Vendor and Amount are required.");
            return;
        }

        try {
            const expenseData = {
                userId: user.uid,
                vendor: manualForm.vendor,
                date: manualForm.date || new Date().toISOString().split('T')[0],
                amount: Number(manualForm.amount),
                category: manualForm.category || 'Other',
                description: manualForm.description || 'Manual Entry',
            };

            await FinanceService.addExpense(expenseData);
            toast.success("Expense added manually.");
            setShowManualEntry(false);
            setManualForm({
                date: new Date().toISOString().split('T')[0],
                category: 'Equipment',
                vendor: '',
                amount: 0,
                description: ''
            });
            loadExpenses();
        } catch (e) {
            console.error(e);
            toast.error("Failed to add expense.");
        }
    }, [user, manualForm, toast, loadExpenses]);

    const onDrop = useCallback((acceptedFiles: File[]) => {
        acceptedFiles.forEach(processFile);
    }, [processFile]);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop, accept: { 'image/*': [] } });

    return (
        <div className="bg-[#0d1117] rounded-xl border border-gray-800 flex flex-col h-[600px] relative">
            <div className="p-6 border-b border-gray-800 flex justify-between items-center">
                <div>
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <DollarSign className="text-teal-500" />
                        Expense Tracker
                    </h2>
                    <p className="text-sm text-gray-400">Drag & drop receipts for AI Analysis</p>
                </div>
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => setShowManualEntry(true)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-white text-xs rounded-lg transition-colors border border-gray-700"
                    >
                        <Plus size={14} />
                        Add Manual
                    </button>
                    <div className="text-right">
                        <div className="text-2xl font-bold text-white">${expenses.reduce((a, b) => a + b.amount, 0).toFixed(2)}</div>
                        <div className="text-xs text-teal-500 font-mono">TOTAL SPEND</div>
                    </div>
                </div>
            </div>

            {/* Manual Entry Modal */}
            {showManualEntry && (
                <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-[#161b22] border border-gray-700 rounded-xl w-full max-w-md p-6 shadow-2xl animate-in fade-in zoom-in duration-200">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-lg font-bold text-white">Add Manual Expense</h3>
                            <button onClick={() => setShowManualEntry(false)} className="text-gray-400 hover:text-white">
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleManualSubmit} className="space-y-4">
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
                                    className="w-full bg-teal-600 hover:bg-teal-500 text-white font-medium py-2 rounded-lg transition-colors"
                                >
                                    Add Expense
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
                {/* Visual List */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center py-20">
                            <Loader2 className="animate-spin text-gray-600 mb-2" />
                            <p className="text-gray-500 text-sm">Loading expenses...</p>
                        </div>
                    ) : expenses.length === 0 ? (
                        <div className="text-center text-gray-500 py-10">
                            No expenses recorded yet. Note your costs to calculate tax deductions.
                        </div>
                    ) : (
                        expenses.map(expense => (
                            <div key={expense.id} className="bg-[#161b22] p-4 rounded-lg border border-gray-800 flex justify-between items-center hover:border-gray-700 transition-colors">
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
                        ))
                    )}
                </div>

                {/* Drop Zone */}
                <div className="w-full md:w-1/3 p-4 border-l border-gray-800 bg-[#161b22]/50">
                    <div
                        {...getRootProps()}
                        className={`h-full border-2 border-dashed rounded-xl flex flex-col items-center justify-center text-center p-6 cursor-pointer transition-colors ${isDragActive ? 'border-teal-500 bg-teal-500/10' : 'border-gray-700 hover:border-gray-600'
                            }`}
                    >
                        <input {...getInputProps()} />
                        {isAnalyzing ? (
                            <div className="animate-pulse flex flex-col items-center">
                                <Loader2 className="animate-spin text-teal-500 mb-4" size={32} />
                                <p className="text-teal-400 font-medium">Analyzing Receipt...</p>
                                <p className="text-xs text-gray-500 mt-2">Extracting Vendor & Amount</p>
                            </div>
                        ) : (
                            <>
                                <div className="w-16 h-16 bg-gray-800 rounded-full flex items-center justify-center mb-4 text-gray-400">
                                    <Camera size={24} />
                                </div>
                                <p className="text-white font-medium mb-2">Scan Receipt</p>
                                <p className="text-xs text-gray-500">
                                    Drop an image here or click to upload.<br />
                                    AI will extract the details.
                                </p>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

