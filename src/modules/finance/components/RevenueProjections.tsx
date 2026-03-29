import React, { useState } from 'react';
import { motion } from 'motion/react';
import { TrendingUp, DollarSign, Loader2, RefreshCw, Calculator } from 'lucide-react';
import { logger } from '@/utils/logger';

interface ProjectionData {
    gross: { month_1: number; month_6: number; year_1: number };
    manager_fee_saved: { month_1: number; month_6: number; year_1: number };
    net_to_rights_holder: { month_1: number; month_6: number; year_1: number };
}

export const RevenueProjections = () => {
    const [loading, setLoading] = useState(false);
    const [projections, setProjections] = useState<ProjectionData | null>(null);
    const [platform, setPlatform] = useState<'Spotify' | 'Apple Music' | 'Other'>('Spotify');
    const [streams, setStreams] = useState<number>(100000);

    const handleForecast = async () => {
        setLoading(true);
        try {
            const { financeService } = await import('@/services/finance/FinanceService');

            const result = await financeService.forecastRevenue(
                streams,
                platform,
                100 // Assuming independent artist for this view
            );

            if (result.success) {
                setProjections(result.data.projections);
            }
        } catch (error) {
            logger.error("Forecast failed:", error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden flex flex-col h-full"
        >
            <div className="p-6 border-b border-white/5 flex justify-between items-center">
                <div>
                    <h3 className="font-semibold text-white flex items-center gap-2">
                        <Calculator size={16} className="text-dept-royalties" />
                        Revenue Projections
                    </h3>
                    <p className="text-xs text-gray-500 mt-1">AI-powered earnings forecast</p>
                </div>
                {projections && (
                    <button
                        onClick={() => setProjections(null)}
                        className="p-2 hover:bg-white/10 rounded-full text-gray-400 hover:text-white transition-colors"
                        title="Reset"
                    >
                        <RefreshCw size={14} />
                    </button>
                )}
            </div>

            <div className="p-6 flex-1 flex flex-col">
                {!projections ? (
                    <div className="flex-1 flex flex-col justify-center space-y-6">
                        <div className="space-y-4">
                            <div>
                                <label className="text-xs font-medium text-gray-400 mb-1.5 block">Projected Monthly Streams</label>
                                <input
                                    type="number"
                                    value={streams}
                                    onChange={(e) => setStreams(Number(e.target.value))}
                                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white text-sm focus:outline-none focus:border-dept-royalties/50 transition-colors"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-medium text-gray-400 mb-1.5 block">Platform Trend</label>
                                <select
                                    value={platform}
                                    onChange={(e) => setPlatform(e.target.value as 'Spotify' | 'Apple Music' | 'Other')}
                                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white text-sm focus:outline-none focus:border-dept-royalties/50 transition-colors"
                                >
                                    <option value="Spotify">Spotify (Growth)</option>
                                    <option value="Apple Music">Apple Music (High Value)</option>
                                    <option value="Other">Conservative Avg</option>
                                </select>
                            </div>
                        </div>

                        <button
                            onClick={handleForecast}
                            disabled={loading}
                            className="w-full py-3 bg-dept-royalties hover:opacity-90 text-black rounded-lg font-bold text-sm transition-all shadow-lg shadow-dept-royalties/20 flex items-center justify-center gap-2"
                        >
                            {loading ? <Loader2 size={16} className="animate-spin" /> : <TrendingUp size={16} />}
                            Calculate Projection
                        </button>
                    </div>
                ) : (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        {/* 1 Year Projection Highlight */}
                        <div className="bg-dept-royalties/10 border border-dept-royalties/20 rounded-xl p-5 text-center relative overflow-hidden group">
                            <div className="absolute inset-0 bg-dept-royalties/5 group-hover:bg-dept-royalties/10 transition-colors duration-500" />
                            <p className="text-dept-royalties text-xs font-bold uppercase tracking-wider mb-1 relative z-10">1 Year Net Revenue</p>
                            <h2 className="text-3xl font-black text-white relative z-10">${projections.net_to_rights_holder.year_1.toLocaleString(undefined, { maximumFractionDigits: 0 })}</h2>
                        </div>

                        {/* Manager Savings Badge - Gamification */}
                        <div className="bg-dept-royalties/10 border border-dept-royalties/20 rounded-xl p-4 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-dept-royalties/20 flex items-center justify-center text-dept-royalties">
                                    <DollarSign size={20} />
                                </div>
                                <div>
                                    <p className="text-xs text-dept-royalties/70 font-medium">Manager Fees Saved</p>
                                    <p className="text-lg font-bold text-white">${projections.manager_fee_saved.year_1.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                                </div>
                            </div>
                            <div className="text-[10px] bg-dept-royalties/20 text-dept-royalties px-2 py-1 rounded font-bold">
                                20% KEPT
                            </div>
                        </div>

                        {/* Breakdown Grid */}
                        <div className="grid grid-cols-2 gap-3">
                            <div className="bg-white/5 rounded-lg p-3 border border-white/5">
                                <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">1 Month</p>
                                <p className="text-sm font-bold text-white">${projections.net_to_rights_holder.month_1.toLocaleString()}</p>
                            </div>
                            <div className="bg-white/5 rounded-lg p-3 border border-white/5">
                                <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">6 Months</p>
                                <p className="text-sm font-bold text-white">${projections.net_to_rights_holder.month_6.toLocaleString()}</p>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </motion.div>
    );
};
