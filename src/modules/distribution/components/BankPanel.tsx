import React, { useState } from 'react';
import { distributionService } from '@/services/distribution/DistributionService';
import { Loader2, DollarSign, FileCheck, Landmark } from 'lucide-react';
import { useToast } from '@/core/context/ToastContext';

export const BankPanel: React.FC = () => {
    const { success, error: toastError } = useToast();
    const [userId, setUserId] = useState('user_123'); // Default mock user
    const [amount, setAmount] = useState('1000');
    const [loading, setLoading] = useState(false);
    const [report, setReport] = useState<any>(null);

    const handleCalculate = async () => {
        setLoading(true);
        try {
            const result = await distributionService.calculateWithholding(userId, parseFloat(amount));
            setReport(result);
            success('Tax calculation complete');
        } catch (error) {
            console.error('Tax calc failed:', error);
            toastError('Calculation failed. Ensure you are in Electron mode.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-2">
                <h2 className="text-2xl font-bold text-white">Industrial Bank Layer</h2>
                <p className="text-gray-400">
                    Direct integration with the IRS Tax Withholding Engine and Waterfall Payout logic.
                    Executes locally via Python Bridge for maximum security.
                </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Input Panel */}
                <div className="bg-zinc-900/50 border border-white/5 rounded-2xl p-6 space-y-6">
                    <div className="flex items-center gap-2 text-emerald-400 mb-4">
                        <Landmark className="w-5 h-5" />
                        <span className="font-bold uppercase tracking-wider text-sm">Revenue Simulator</span>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Beneficiary User ID</label>
                            <input
                                type="text"
                                value={userId}
                                onChange={(e) => setUserId(e.target.value)}
                                className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-emerald-500/50 transition-colors font-mono"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Gross Revenue (USD)</label>
                            <div className="relative">
                                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                                <input
                                    type="number"
                                    value={amount}
                                    onChange={(e) => setAmount(e.target.value)}
                                    className="w-full bg-black/50 border border-white/10 rounded-lg pl-10 pr-4 py-3 text-white focus:outline-none focus:border-emerald-500/50 transition-colors font-mono"
                                />
                            </div>
                        </div>

                        <button
                            onClick={handleCalculate}
                            disabled={loading}
                            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <FileCheck className="w-5 h-5" />}
                            Execute Compliance Check
                        </button>
                    </div>
                </div>

                {/* Report Panel */}
                <div className="bg-zinc-900/50 border border-white/5 rounded-2xl p-6 relative overflow-hidden">
                    {!report ? (
                        <div className="h-full flex flex-col items-center justify-center text-zinc-600 space-y-4 min-h-[300px]">
                            <div className="p-4 rounded-full bg-white/5">
                                <Landmark className="w-8 h-8 opacity-20" />
                            </div>
                            <p className="text-sm font-medium">Awaiting Calculation Data</p>
                        </div>
                    ) : (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <div className="flex items-center justify-between border-b border-white/5 pb-4">
                                <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${report.status === 'ACTIVE' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                                    }`}>
                                    Status: {report.status}
                                </span>
                                <span className="text-xs text-zinc-500 font-mono">ID: {report.user_id}</span>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="p-4 rounded-xl bg-black/20 border border-white/5">
                                    <span className="block text-[10px] text-zinc-500 uppercase tracking-widest mb-1">Tax Treaty</span>
                                    <span className="text-lg font-mono text-white">{report.country} ({report.treaty_article})</span>
                                </div>
                                <div className="p-4 rounded-xl bg-black/20 border border-white/5">
                                    <span className="block text-[10px] text-zinc-500 uppercase tracking-widest mb-1">Withholding Rate</span>
                                    <span className="text-lg font-mono text-white">{report.withholding_rate}%</span>
                                </div>
                            </div>

                            <div className="p-4 rounded-xl bg-gradient-to-br from-zinc-800 to-zinc-900 border border-white/10 space-y-4">
                                <div className="flex justify-between items-center text-zinc-400 text-sm">
                                    <span>Gross Amount</span>
                                    <span className="font-mono">${parseFloat(amount).toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between items-center text-rose-400 text-sm">
                                    <span>Withheld Tax</span>
                                    <span className="font-mono">-${report.withheld_amount.toFixed(2)}</span>
                                </div>
                                <div className="border-t border-white/10 pt-3 flex justify-between items-center text-white font-bold text-lg">
                                    <span>Net Payable</span>
                                    <span className="font-mono text-emerald-400">${report.payable_amount.toFixed(2)}</span>
                                </div>
                            </div>

                            {report.reason && (
                                <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg text-xs text-rose-300">
                                    {report.reason}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
