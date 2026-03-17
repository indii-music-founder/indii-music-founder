import React, { useMemo } from 'react';
import { useEarnings } from '../hooks/useEarnings';
import { EarningsBreakdown } from './EarningsBreakdown';
import { Loader2, DollarSign, Globe, TrendingUp, Download, PieChart } from 'lucide-react';
import { motion } from 'motion/react';
import { SkeletonText, Skeleton } from '@/components/ui/Skeleton';

// Compute default period outside component to satisfy react-compiler purity rules
const DEFAULT_PERIOD = (() => {
    const now = Date.now();
    const endDate = new Date(now).toISOString().split('T')[0];
    const startDate = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    return { startDate, endDate };
})();

// Industry-average DSP revenue share (2024 IFPI Global Music Report)
const DSP_SHARES = [
    { label: 'Spotify',        pct: 31 },
    { label: 'Apple Music',    pct: 15 },
    { label: 'Amazon Music',   pct: 13 },
    { label: 'YouTube Music',  pct:  8 },
    { label: 'Tidal',          pct:  2 },
    { label: 'Other DSPs',     pct: 31 },
];

// Top streaming territories by revenue share (2024 IFPI)
const TERRITORY_SHARES = [
    { label: 'United States',  pct: 38 },
    { label: 'United Kingdom', pct:  8 },
    { label: 'Germany',        pct:  6 },
    { label: 'Japan',          pct:  5 },
    { label: 'France',         pct:  4 },
    { label: 'Australia',      pct:  3 },
    { label: 'Canada',         pct:  3 },
    { label: 'Brazil',         pct:  3 },
    { label: 'South Korea',    pct:  2 },
    { label: 'Rest of World',  pct: 28 },
];

export const EarningsDashboard: React.FC = () => {
    const period = DEFAULT_PERIOD;

    const { earnings, loading } = useEarnings(period);

    // Use real byPlatform from Firestore when available; fall back to industry-average estimates
    const platformBreakdown = useMemo(() => {
        if (!earnings?.totalNetRevenue) return [];
        if (earnings.byPlatform && earnings.byPlatform.length > 0) {
            return earnings.byPlatform.map((p: { platformName: string; revenue: number }) => ({
                label: p.platformName,
                revenue: p.revenue,
                percentage: Math.round((p.revenue / earnings.totalNetRevenue) * 100),
            }));
        }
        // Derive from industry-average market share (labeled as estimates)
        const net = earnings.totalNetRevenue;
        return DSP_SHARES.map(d => ({
            label: `${d.label} (Est.)`,
            revenue: Math.round((net * d.pct) / 100 * 100) / 100,
            percentage: d.pct,
        }));
    }, [earnings]);

    // Use real byTerritory when available; fall back to industry-average territory estimates
    const territoryBreakdown = useMemo(() => {
        if (!earnings?.totalNetRevenue) return [];
        if (earnings.byTerritory && earnings.byTerritory.length > 0) {
            return earnings.byTerritory.map((t: { territoryName: string; revenue: number }) => ({
                label: t.territoryName,
                revenue: t.revenue,
                percentage: Math.round((t.revenue / earnings.totalNetRevenue) * 100),
            }));
        }
        const net = earnings.totalNetRevenue;
        return TERRITORY_SHARES.map(t => ({
            label: `${t.label} (Est.)`,
            revenue: Math.round((net * t.pct) / 100 * 100) / 100,
            percentage: t.pct,
        }));
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
                    <div className="py-6 space-y-4">
                        <Skeleton className="h-12 w-48" />
                        <SkeletonText lines={4} />
                    </div>
                ) : earnings ? (
                    <div>
                        <div className="flex items-baseline gap-1 mb-6">
                            <span className="text-2xl font-bold text-purple-500 tracking-tighter">$</span>
                            <span className="text-5xl font-black text-white tracking-tighter">
                                {earnings.totalNetRevenue.toFixed(2)}
                            </span>
                            <span className="ml-2 text-sm font-bold text-gray-500 flex items-center gap-1 bg-gray-500/10 px-2 py-0.5 rounded-full">
                                <TrendingUp size={12} /> --
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
                    byTrack={earnings.byRelease?.map((r: { releaseName: string; revenue: number }) => ({
                        label: r.releaseName,
                        revenue: r.revenue,
                        percentage: earnings.totalNetRevenue > 0
                            ? Math.round((r.revenue / earnings.totalNetRevenue) * 100)
                            : 0,
                        growth: undefined,
                    }))}
                />
            )}
        </div>
    );
};

