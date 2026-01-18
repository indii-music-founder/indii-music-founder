import React, { useState } from 'react';
import { distributionService } from '@/services/distribution/DistributionService';
import { Loader2, DollarSign, FileCheck, Landmark } from 'lucide-react';
import { useToast } from '@/core/context/ToastContext';

export const BankPanel: React.FC = () => {
    const { success, error: toastError } = useToast();
    const [userId, setUserId] = useState('user_123'); // Default mock user
    const [amount, setAmount] = useState('1000');
    const [loading, setLoading] = useState(false);
    const [report, setReport] = useState<import('@/types/distribution').TaxReport | null>(null);

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
                                <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${report.payout_status === 'ACTIVE' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                                    }`}>
                                    Status: {report.payout_status}
                                </span>
                                <span className="text-xs text-zinc-500 font-mono">TIN: {report.tin_masked}</span>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="p-4 rounded-xl bg-black/20 border border-white/5">
                                    <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Withholding Rate</div>
                                    <div className="text-xl font-mono text-white">{(report.withholding_rate * 100).toFixed(1)}%</div>
                                    <div className="text-xs text-zinc-500 mt-1">Article 12 Treaty</div>
                                </div>

                                <div className="p-4 rounded-xl bg-black/20 border border-white/5">
                                    <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Tax Form</div>
                                    <div className="text-xl font-mono text-white">{report.form_type}</div>
                                    <div className="text-xs text-zinc-500 mt-1">Certified: {report.certified ? 'YES' : 'NO'}</div>
                                </div>
                            </div>

                            <div className="bg-black/30 rounded-lg p-4 space-y-3">
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-400">Gross Amount</span>
                                    <span className="text-white font-mono">${parseFloat(amount).toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-rose-400">Tax Withholding</span>
                                    <span className="text-rose-400 font-mono">-${(parseFloat(amount) * report.withholding_rate).toFixed(2)}</span>
                                </div>
                                <div className="border-t border-white/10 pt-3 flex justify-between font-bold">
                                    <span className="text-emerald-400">Net Payable</span>
                                    <span className="text-emerald-400 font-mono">${(parseFloat(amount) * (1 - report.withholding_rate)).toFixed(2)}</span>
                                </div>
                            </div>

                            {report.payout_status !== 'ACTIVE' && (
                                <div className="bg-rose-500/10 border border-rose-500/20 rounded-lg p-3 flex items-start gap-3">
                                    <p className="text-xs text-rose-300">
                                        Payouts are currently HELD. Please update tax certification to release funds.
                                    </p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
