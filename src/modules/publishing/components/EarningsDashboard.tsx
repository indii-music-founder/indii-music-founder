import React, { useMemo } from 'react';
import { useStore } from '@/core/store';
import { Loader2, DollarSign, Globe, TrendingUp, Download, PieChart } from 'lucide-react';
import { motion } from 'framer-motion';

export const EarningsDashboard: React.FC = () => {
    const { finance } = useStore();

    // Mock breakdowns if not present in store yet (as per Phase 8 spec)
    const breakdowns = useMemo(() => ({
        platforms: [
            { name: 'Spotify', amount: finance.earningsSummary?.totalNetRevenue ? finance.earningsSummary.totalNetRevenue * 0.42 : 0, percent: 42 },
            { name: 'Apple Music', amount: finance.earningsSummary?.totalNetRevenue ? finance.earningsSummary.totalNetRevenue * 0.33 : 0, percent: 33 },
            { name: 'YouTube', amount: finance.earningsSummary?.totalNetRevenue ? finance.earningsSummary.totalNetRevenue * 0.15 : 0, percent: 15 },
            { name: 'Other', amount: finance.earningsSummary?.totalNetRevenue ? finance.earningsSummary.totalNetRevenue * 0.10 : 0, percent: 10 },
        ]
    }), [finance.earningsSummary]);

    return (
        <div className="bg-[#121212] border border-gray-800/50 rounded-2xl p-6 shadow-xl relative overflow-hidden h-full flex flex-col">
            <div className="flex items-center justify-between mb-2">
                <h3 className="text-lg font-bold text-white tracking-tight">Royalties</h3>
                <div className="flex gap-2">
                    <button className="p-1.5 text-gray-500 hover:text-white rounded-lg transition-colors">
                        <Download size={16} />
                    </button>
                    <button className="p-1.5 text-gray-500 hover:text-white rounded-lg transition-colors">
                        <PieChart size={16} />
                    </button>
                </div>
            </div>
            <p className="text-xs text-gray-500 font-bold uppercase tracking-widest mb-6">Estimated Income (Q4 2025)</p>

            {finance.loading ? (
                <div className="flex-1 flex flex-col items-center justify-center py-12">
                    <Loader2 size={32} className="text-purple-500 animate-spin mb-4" />
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">Calculating Royalties...</p>
                </div>
            ) : finance.earningsSummary ? (
                <div className="flex-1 flex flex-col justify-between">
                    <div>
                        <div className="flex items-baseline gap-1 mb-8">
                            <span className="text-2xl font-bold text-purple-500">$</span>
                            <span className="text-5xl font-black text-white tracking-tighter">
                                {finance.earningsSummary.totalNetRevenue.toFixed(2)}
                            </span>
                            <span className="ml-2 text-sm font-bold text-green-500 flex items-center gap-1 bg-green-500/10 px-2 py-0.5 rounded-full">
                                <TrendingUp size={12} /> +12.5%
                            </span>
                        </div>

                        <div className="space-y-3">
                            <div className="flex items-center justify-between p-3 bg-gray-900/40 rounded-xl border border-gray-800/50">
                                <div className="flex items-center gap-2">
                                    <Globe size={14} className="text-green-400" />
                                    <span className="text-sm text-gray-400 font-medium">Global Streams</span>
                                </div>
                                <span className="text-sm font-bold text-white">{finance.earningsSummary.totalStreams.toLocaleString()}</span>
                            </div>
                            <div className="flex items-center justify-between p-3 bg-gray-900/40 rounded-xl border border-gray-800/50">
                                <div className="flex items-center gap-2">
                                    <DollarSign size={14} className="text-purple-400" />
                                    <span className="text-sm text-gray-400 font-medium">Pending Payouts</span>
                                </div>
                                <span className="text-sm font-bold text-white">${(finance.earningsSummary.totalGrossRevenue - finance.earningsSummary.totalNetRevenue).toFixed(2)}</span>
                            </div>
                        </div>

                        {/* Breakdown Chart (Visual only for now) */}
                        <div className="mt-6 space-y-2">
                            <h4 className="text-xs font-bold text-gray-600 uppercase tracking-wider mb-3">Revenue Source</h4>
                            {breakdowns.platforms.map((p, i) => (
                                <div key={p.name} className="flex items-center gap-2 text-xs">
                                    <div className="w-20 text-gray-400 truncate">{p.name}</div>
                                    <div className="flex-1 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                                        <motion.div
                                            initial={{ width: 0 }}
                                            animate={{ width: `${p.percent}%` }}
                                            transition={{ delay: 0.2 + (i * 0.1) }}
                                            className="h-full bg-purple-500 rounded-full opacity-80"
                                        />
                                    </div>
                                    <div className="w-12 text-right text-gray-300 font-mono">{p.percent}%</div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <button className="w-full mt-6 py-3 bg-white text-black rounded-xl font-bold text-sm hover:bg-gray-200 transition-all active:scale-[0.98] shadow-lg shadow-white/5">
                        Request Withdrawal
                    </button>
                </div>
            ) : (
                <div className="flex-1 flex flex-col justify-center">
                    <div className="group relative text-center py-10 px-4 bg-gray-900/20 rounded-2xl border border-dashed border-gray-800 hover:border-gray-700 transition-all">
                        <div className="w-16 h-16 bg-gray-900 rounded-2xl flex items-center justify-center mb-4 mx-auto group-hover:scale-110 transition-transform">
                            <DollarSign size={24} className="text-gray-700 group-hover:text-purple-500 transition-colors" />
                        </div>
                        <h4 className="text-sm font-bold text-white mb-1 uppercase tracking-tight">Escrow Empty</h4>
                        <p className="text-gray-500 text-[11px] font-medium max-w-[180px] mx-auto leading-relaxed">
                            Connect a distributor or upload your first release to start generating royalties.
                        </p>
                        <div className="absolute inset-0 bg-gradient-to-b from-purple-500/0 to-purple-500/[0.02] pointer-events-none" />
                    </div>
                </div>
            )}

            {/* Background Decoration */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-purple-500/5 blur-[100px] pointer-events-none -mr-32 -mt-32" />
        </div>
    );
};
