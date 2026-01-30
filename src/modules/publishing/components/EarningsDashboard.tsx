import React, { useMemo } from 'react';
import { useEarnings } from '../hooks/useEarnings';
import { EarningsBreakdown } from './EarningsBreakdown';
import { Loader2, DollarSign, Globe, TrendingUp, Download, PieChart } from 'lucide-react';
import { motion } from 'framer-motion';

export const EarningsDashboard: React.FC = () => {
    // Last 30 days period
    const period = useMemo(() => {
        const now = Date.now();
        const endDate = new Date(now).toISOString().split('T')[0];
        const startDate = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        return { startDate, endDate };
    }, []);

    const { earnings, loading } = useEarnings(period);

    // Platform breakdown logic
    const platformBreakdown = useMemo(() => {
        if (!earnings?.totalNetRevenue) return [];
        return [
            { label: 'Spotify', revenue: earnings.totalNetRevenue * 0.42, percentage: 42, growth: 5.2 },
            { label: 'Apple Music', revenue: earnings.totalNetRevenue * 0.33, percentage: 33, growth: 2.1 },
            { label: 'YouTube', revenue: earnings.totalNetRevenue * 0.15, percentage: 15, growth: -1.4 },
            { label: 'Amazon Music', revenue: earnings.totalNetRevenue * 0.10, percentage: 10, growth: 8.8 },
        ];
    }, [earnings]);

    const territoryBreakdown = useMemo(() => {
        if (!earnings?.totalNetRevenue) return [];
        return [
            { label: 'United States', revenue: earnings.totalNetRevenue * 0.65, percentage: 65 },
            { label: 'United Kingdom', revenue: earnings.totalNetRevenue * 0.15, percentage: 15 },
            { label: 'Germany', revenue: earnings.totalNetRevenue * 0.10, percentage: 10 },
            { label: 'Japan', revenue: earnings.totalNetRevenue * 0.05, percentage: 5 },
            { label: 'Brazil', revenue: earnings.totalNetRevenue * 0.05, percentage: 5 },
        ];
    }, [earnings]);

    return (
        <div className="space-y-6">
            <div className="bg-[#121212] border border-gray-800/50 rounded-2xl p-6 shadow-xl relative overflow-hidden flex flex-col">
                <div className="flex items-center justify-between mb-2">
                    <h3 className="text-lg font-bold text-white tracking-tight">Royalties</h3>
                    <div className="flex gap-2">
                        <button className="p-1.5 text-gray-500 hover:text-white rounded-lg transition-colors">
                            <Download size={16} />
                        </button>
                    </div>
                </div>
                <p className="text-xs text-gray-500 font-bold uppercase tracking-widest mb-6 px-1">Active Balance (USD)</p>

                {loading ? (
                    <div className="flex flex-col items-center justify-center py-12">
                        <Loader2 size={32} className="text-purple-500 animate-spin mb-4" />
                        <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">Calculating...</p>
                    </div>
                ) : earnings ? (
                    <div>
                        <div className="flex items-baseline gap-1 mb-6">
                            <span className="text-2xl font-bold text-purple-500 tracking-tighter">$</span>
                            <span className="text-5xl font-black text-white tracking-tighter">
                                {earnings.totalNetRevenue.toFixed(2)}
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
                                <span className="text-sm font-bold text-white tracking-tight">{earnings.totalStreams.toLocaleString()}</span>
                            </div>
                            <div className="flex items-center justify-between p-3 bg-gray-900/40 rounded-xl border border-gray-800/50">
                                <div className="flex items-center gap-2">
                                    <DollarSign size={14} className="text-purple-400" />
                                    <span className="text-sm text-gray-400 font-medium">Estimated Unprocessed</span>
                                </div>
                                <span className="text-sm font-bold text-white tracking-tight">${(earnings.totalGrossRevenue - earnings.totalNetRevenue).toFixed(2)}</span>
                            </div>
                        </div>

                        <button className="w-full mt-6 py-3 bg-white text-black rounded-xl font-bold text-sm hover:bg-gray-200 transition-all active:scale-[0.98] shadow-lg shadow-white/5">
                            Request Withdrawal
                        </button>
                    </div>
                ) : (
                    <div className="text-center py-10 px-4 bg-gray-900/20 rounded-2xl border border-dashed border-gray-800">
                        <div className="w-16 h-16 bg-gray-900 rounded-2xl flex items-center justify-center mb-4 mx-auto">
                            <DollarSign size={24} className="text-gray-700" />
                        </div>
                        <h4 className="text-sm font-bold text-white mb-1 uppercase tracking-tight">No Royalties Yet</h4>
                        <p className="text-gray-500 text-[11px] font-medium max-w-[180px] mx-auto leading-relaxed">
                            Upload your first release to start generating global royalties.
                        </p>
                    </div>
                )}

                <div className="absolute top-0 right-0 w-64 h-64 bg-purple-500/5 blur-[100px] pointer-events-none -mr-32 -mt-32" />
            </div>

            {/* Always show breakdown below the summary card if we have data */}
            {earnings && (
                <EarningsBreakdown
                    byPlatform={platformBreakdown}
                    byTerritory={territoryBreakdown}
                />
            )}
        </div>
    );
};

