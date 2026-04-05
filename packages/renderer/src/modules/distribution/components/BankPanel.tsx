
import React, { useState } from 'react';
import { distributionService } from '@/services/distribution/DistributionService';
import { Loader2, DollarSign, FileCheck, Landmark, Users, Plus, Trash2, PieChart, ArrowDownRight, Shield } from 'lucide-react';
import { useToast } from '@/core/context/ToastContext';
import { TaxReport, WaterfallReport, WaterfallData } from '@/types/distribution';
import { logger } from '@/utils/logger';

export const BankPanel: React.FC = () => {
    const { success, error: toastError } = useToast();

    // Global State
    const [amount, setAmount] = useState('1000');
    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState<'TAX' | 'WATERFALL'>('TAX');

    // Tax Engine State
    const [userId, setUserId] = useState('user_123');
    const [taxReport, setTaxReport] = useState<TaxReport | null>(null);

    // Waterfall Engine State
    const [splits, setSplits] = useState<{ userId: string; percentage: number }[]>([
        { userId: 'artist_01', percentage: 0.50 },
        { userId: 'producer_01', percentage: 0.30 },
        { userId: 'label_hq', percentage: 0.20 }
    ]);
    const [waterfallReport, setWaterfallReport] = useState<WaterfallReport | null>(null);

    const handleCalculateTax = async () => {
        setLoading(true);
        try {
            const result = await distributionService.calculateWithholding(userId, parseFloat(amount));
            setTaxReport(result);
            success('Tax compliance verified.');
        } catch (error: unknown) {
            logger.error('Tax calc failed:', error);
            toastError('Tax verification failed.');
        } finally {
            setLoading(false);
        }
    };

    const handleExecuteWaterfall = async () => {
        setLoading(true);
        try {
            const splitMap: Record<string, number> = {};
            splits.forEach(s => splitMap[s.userId] = s.percentage);

            const data: WaterfallData = {
                gross_revenue: parseFloat(amount),
                splits: splitMap
            };

            const result = await distributionService.executeWaterfall(data);
            setWaterfallReport(result);
            success('Revenue waterfall executed.');
        } catch (error: unknown) {
            logger.error('Waterfall failed:', error);
            toastError('Waterfall execution failed.');
        } finally {
            setLoading(false);
        }
    };

    const addSplit = () => {
        setSplits([...splits, { userId: '', percentage: 0 }]);
    };

    const removeSplit = (index: number) => {
        setSplits(splits.filter((_, i) => i !== index));
    };

    const updateSplit = (index: number, field: 'userId' | 'percentage', value: string | number) => {
        const newSplits = [...splits];
        if (!newSplits[index]) return;
        if (field === 'percentage') {
            newSplits[index]!.percentage = parseFloat(value as string) / 100;
        } else {
            newSplits[index]!.userId = value as string;
        }
        setSplits(newSplits);
    };

    const totalPercentage = splits.reduce((sum, s) => sum + s.percentage, 0);

    return (
        <div className="space-y-8 animate-in fade-in duration-700">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="flex flex-col gap-2">
                    <h2 className="text-3xl font-black text-white uppercase italic tracking-tighter">Bank Layer</h2>
                    <p className="text-gray-500 font-medium max-w-xl">
                        Locally processed financial compliance and automated revenue splits.
                        IndiiOS executes all logic via secure-context Python bridges.
                    </p>
                </div>

                <div className="flex p-1 bg-white/5 border border-white/10 rounded-xl backdrop-blur-sm">
                    <button
                        onClick={() => setActiveTab('TAX')}
                        data-testid="distro-subtab-tax"
                        className={`px-6 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'TAX' ? 'bg-white text-black' : 'text-gray-500 hover:text-gray-300'}`}
                    >
                        Tax Engine
                    </button>
                    <button
                        onClick={() => setActiveTab('WATERFALL')}
                        data-testid="distro-subtab-waterfall"
                        className={`px-6 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'WATERFALL' ? 'bg-white text-black' : 'text-gray-500 hover:text-gray-300'}`}
                    >
                        Waterfall
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Global Controls & Simulator Input */}
                <div className="space-y-6">
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-8 backdrop-blur-sm">
                        <div className="flex items-center gap-2 text-dept-licensing mb-6">
                            <DollarSign className="w-5 h-5" />
                            <span className="font-black uppercase tracking-[0.2em] text-[10px]">Revenue Simulator</span>
                        </div>

                        <div className="space-y-6">
                            <div>
                                <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2 ml-1">Simulation Amount (USD)</label>
                                <div className="relative">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-dept-licensing">$</span>
                                    <input
                                        data-testid="bank-simulation-amount"
                                        type="number"
                                        value={amount}
                                        onChange={(e) => setAmount(e.target.value)}
                                        className="w-full bg-black/40 border border-white/10 rounded-xl pl-10 pr-4 py-4 text-xl font-black text-white focus:outline-none focus:border-dept-licensing/50 transition-all italic"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {activeTab === 'TAX' ? (
                        <div className="bg-white/5 border border-white/10 rounded-2xl p-8 space-y-6 animate-in slide-in-from-left-4 duration-500 backdrop-blur-sm">
                            <div className="flex items-center gap-2 text-dept-distribution mb-2">
                                <Landmark className="w-4 h-4" />
                                <span className="font-black uppercase tracking-[0.2em] text-[10px]">Tax Verification</span>
                            </div>

                            <div>
                                <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2 ml-1">Beneficiary ID</label>
                                <input
                                    data-testid="bank-tax-beneficiary-id"
                                    type="text"
                                    value={userId}
                                    onChange={(e) => setUserId(e.target.value)}
                                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm font-bold text-gray-300 focus:outline-none focus:border-dept-distribution/50 transition-all font-mono"
                                />
                            </div>

                            <button
                                data-testid="bank-verify-tax-compliance"
                                onClick={handleCalculateTax}
                                disabled={loading}
                                className="w-full bg-white text-black font-black uppercase tracking-widest py-4 rounded-xl flex items-center justify-center gap-2 hover:bg-gray-200 active:scale-[0.98] transition-all disabled:opacity-50"
                            >
                                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Shield className="w-5 h-5" />}
                                Verify Compliance
                            </button>
                        </div>
                    ) : (
                        <div className="bg-white/5 border border-white/10 rounded-2xl p-8 space-y-6 animate-in slide-in-from-left-4 duration-500 backdrop-blur-sm">
                            <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2 text-dept-creative">
                                    <Users className="w-4 h-4" />
                                    <span className="font-black uppercase tracking-[0.2em] text-[10px]">Equity Splits</span>
                                </div>
                                <button
                                    onClick={addSplit}
                                    className="p-1.5 bg-gray-800 rounded-lg hover:bg-gray-700 text-gray-400 hover:text-white transition-all"
                                >
                                    <Plus className="w-4 h-4" />
                                </button>
                            </div>

                            <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 scrollbar-hide">
                                {splits.map((split, idx) => (
                                    <div key={idx} className="flex items-center gap-3">
                                        <input
                                            data-testid={`bank-split-user-${idx}`}
                                            type="text"
                                            placeholder="User ID"
                                            value={split.userId}
                                            onChange={(e) => updateSplit(idx, 'userId', e.target.value)}
                                            className="flex-1 bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs font-bold text-gray-300 focus:outline-none focus:border-dept-creative/50 transition-all font-mono"
                                        />
                                        <div className="w-24 relative">
                                            <input
                                                data-testid={`bank-split-percent-${idx}`}
                                                type="number"
                                                value={split.percentage * 100}
                                                onChange={(e) => updateSplit(idx, 'percentage', e.target.value)}
                                                className="w-full bg-black/40 border border-white/10 rounded-lg pl-3 pr-7 py-2 text-xs font-bold text-gray-300 focus:outline-none focus:border-dept-creative/50 transition-all font-mono text-right"
                                            />
                                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-gray-600">%</span>
                                        </div>
                                        <button
                                            onClick={() => removeSplit(idx)}
                                            className="p-2 text-gray-600 hover:text-red-500 transition-colors"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                ))}
                            </div>

                            <div className={`flex items-center justify-between px-4 py-3 rounded-xl border ${Math.abs(totalPercentage - 1.0) < 0.001 ? 'bg-dept-licensing/10 border-dept-licensing/20 text-dept-licensing' : 'bg-dept-marketing/10 border-dept-marketing/20 text-dept-marketing'}`}>
                                <span className="text-[10px] font-black uppercase tracking-widest">Total Integrity</span>
                                <span className="text-sm font-black italic">{(totalPercentage * 100).toFixed(1)}%</span>
                            </div>

                            <button
                                data-testid="bank-launch-waterfall"
                                onClick={handleExecuteWaterfall}
                                disabled={loading || Math.abs(totalPercentage - 1.0) > 0.001}
                                className="w-full bg-white text-black font-black uppercase tracking-widest py-4 rounded-xl flex items-center justify-center gap-2 hover:bg-gray-200 active:scale-[0.98] transition-all disabled:opacity-50"
                            >
                                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <PieChart className="w-5 h-5" />}
                                Launch Waterfall
                            </button>
                        </div>
                    )}
                </div>

                {/* Reporting Panel */}
                <div className="bg-white/5 border border-white/10 rounded-2xl p-8 relative overflow-hidden flex flex-col min-h-[500px] backdrop-blur-sm">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-dept-licensing/5 blur-[80px] rounded-full -mr-16 -mt-16" />

                    {activeTab === 'TAX' ? (
                        !taxReport ? (
                            <div className="h-full flex flex-col items-center justify-center text-gray-700 space-y-4">
                                <div className="p-6 bg-black/40 border border-white/10 rounded-3xl">
                                    <Shield className="w-12 h-12 opacity-10" />
                                </div>
                                <p className="text-[10px] font-black uppercase tracking-[0.3em] opacity-30 italic">Awaiting Compliance Hash</p>
                            </div>
                        ) : (
                            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                <div className="flex items-center justify-between border-b border-gray-800 pb-6">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-3 h-3 rounded-full animate-pulse ${taxReport.payout_status === 'ACTIVE' ? 'bg-dept-licensing shadow-[0_0_12px_rgba(34,197,94,0.3)]' : 'bg-dept-marketing'}`} />
                                        <h4 className="text-xl font-black text-white italic uppercase tracking-tighter">Verified Node</h4>
                                    </div>
                                    <div className="px-3 py-1 bg-gray-800 border border-gray-700 rounded-lg text-[10px] font-black text-gray-400 uppercase tracking-widest">
                                        {taxReport.form_type} Protocol
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="p-6 rounded-2xl bg-black/40 border border-white/10 group hover:border-dept-distribution/50 transition-all">
                                        <span className="block text-[10px] font-black text-gray-600 uppercase tracking-widest mb-2">Withholding</span>
                                        <span data-testid="bank-tax-withholding-rate" className="text-2xl font-black text-white italic">{(taxReport.withholding_rate * 100).toFixed(1)}%</span>
                                    </div>
                                    <div className="p-6 rounded-2xl bg-black/40 border border-white/10 group hover:border-dept-licensing/50 transition-all">
                                        <span className="block text-[10px] font-black text-gray-600 uppercase tracking-widest mb-2">Payout Node</span>
                                        <span className="text-2xl font-black text-white italic">{taxReport.payout_status}</span>
                                    </div>
                                </div>

                                <div className="bg-black border border-gray-800 rounded-2xl p-6 space-y-4">
                                    <div className="flex justify-between items-end">
                                        <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Gross Inventory</span>
                                        <span className="text-lg font-black text-gray-300 italic">${parseFloat(amount).toLocaleString()}</span>
                                    </div>
                                    <div className="flex justify-between items-end">
                                        <span className="text-[10px] font-black text-dept-marketing uppercase tracking-widest">Compliance Levy</span>
                                        <span className="text-lg font-black text-dept-marketing italic">-${(parseFloat(amount) * taxReport.withholding_rate).toLocaleString()}</span>
                                    </div>
                                    <div className="border-t border-gray-900 pt-4 flex justify-between items-end">
                                        <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Net Disbursable</span>
                                        <span data-testid="bank-tax-net-disbursable" className="text-3xl font-black text-white italic tracking-tighter shadow-dept-licensing/20 drop-shadow-lg">
                                            ${(parseFloat(amount) * (1 - taxReport.withholding_rate)).toLocaleString()}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        )
                    ) : (
                        !waterfallReport ? (
                            <div className="h-full flex flex-col items-center justify-center text-gray-700 space-y-4">
                                <div className="p-6 bg-black border border-gray-800 rounded-3xl">
                                    <PieChart className="w-12 h-12 opacity-10" />
                                </div>
                                <p className="text-[10px] font-black uppercase tracking-[0.3em] opacity-30 italic">Awaiting Split Signal</p>
                            </div>
                        ) : (
                            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                <div className="flex items-center justify-between border-b border-gray-800 pb-6">
                                    <h4 className="text-xl font-black text-white italic uppercase tracking-tighter">Waterfall Flow</h4>
                                    <div className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Processed: {new Date(waterfallReport.processed_at).toLocaleTimeString()}</div>
                                </div>

                                <div className="space-y-4">
                                    {Object.entries(waterfallReport.distributions).map(([user, distAmount], i) => (
                                        <div key={user} className="flex items-center gap-4 group">
                                            <div className="w-1.5 h-1.5 rounded-full bg-dept-creative group-hover:scale-150 transition-all" />
                                            <div className="flex-1 p-4 bg-black/40 border border-white/10 rounded-xl flex items-center justify-between group-hover:border-dept-creative/30 transition-all">
                                                <div className="flex flex-col">
                                                    <span className="text-[9px] font-black text-gray-600 uppercase tracking-widest">Beneficiary Node</span>
                                                    <span className="text-xs font-bold text-gray-300 font-mono">{user}</span>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <ArrowDownRight className="w-4 h-4 text-dept-creative opacity-20 group-hover:opacity-100 transition-all" />
                                                    <span className="text-xl font-black text-white italic">${distAmount.toLocaleString()}</span>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                <div className="mt-8 pt-6 border-t border-gray-800 flex justify-between items-center">
                                    <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Total Dispersed</span>
                                    <span className="text-3xl font-black text-white italic">${waterfallReport.net_revenue.toLocaleString()}</span>
                                </div>
                            </div>
                        )
                    )}
                </div>
            </div>
        </div>
    );
};
