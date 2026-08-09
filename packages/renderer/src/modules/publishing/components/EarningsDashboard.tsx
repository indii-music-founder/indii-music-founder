import React, { useMemo } from 'react';
import { useEarnings } from '../hooks/useEarnings';
import { EarningsBreakdown } from './EarningsBreakdown';
import { DollarSign, Globe, TrendingUp } from 'lucide-react';
import { SkeletonText, Skeleton } from '@/components/ui/Skeleton';
import { getColorForModule } from '@/core/theme/moduleColors';

// Compute default period outside component to satisfy react-compiler purity rules
const DEFAULT_PERIOD = (() => {
    const now = Date.now();
    const endIso = new Date(now).toISOString();
    const startIso = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString();
    return {
        startDate: startIso.substring(0, startIso.indexOf('T')),
        endDate: endIso.substring(0, endIso.indexOf('T')),
    };
})();

export const EarningsDashboard: React.FC = () => {
    const period = DEFAULT_PERIOD;
    const moduleColor = getColorForModule('publishing');

    const { earnings, loading } = useEarnings(period);

    // Never allocate a user's revenue using industry market share. Missing
    // provider detail remains unavailable.
    const platformBreakdown = useMemo(() => {
        if (!earnings?.totalNetRevenue) return [];
        if (earnings.byPlatform && earnings.byPlatform.length > 0) {
            return earnings.byPlatform.map((p) => ({
                label: p.platformName,
                revenue: p.revenue,
                percentage: Math.round((p.revenue / earnings.totalNetRevenue) * 100),
            }));
        }
        return [];
    }, [earnings]);

    // Territory detail also stays unavailable until it exists in the ledger.
    const territoryBreakdown = useMemo(() => {
        if (!earnings?.totalNetRevenue) return [];
        if (earnings.byTerritory && earnings.byTerritory.length > 0) {
            return earnings.byTerritory.map((t) => ({
                label: t.territoryName,
                revenue: t.revenue,
                percentage: Math.round((t.revenue / earnings.totalNetRevenue) * 100),
            }));
        }
        return [];
    }, [earnings]);

    return (
        <div className="space-y-6">
            <div className="bg-[#121212] border border-gray-800/50 rounded-2xl p-6 shadow-xl relative overflow-hidden flex flex-col">
                <div className="flex items-center justify-between mb-2">
                    <h3 className="text-lg font-bold text-white tracking-tight">Royalties</h3>
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
                            <span className={`text-2xl font-bold ${moduleColor.text} tracking-tighter`}>$</span>
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
                                    <Globe size={14} className={moduleColor.text} />
                                    <span className="text-sm text-gray-400 font-medium">Global Streams</span>
                                </div>
                                <span className="text-sm font-bold text-white tracking-tight">{earnings.totalStreams.toLocaleString('en-US')}</span>
                            </div>
                            <div className="flex items-center justify-between p-3 bg-gray-900/40 rounded-xl border border-gray-800/50">
                                <div className="flex items-center gap-2">
                                    <DollarSign size={14} className={moduleColor.text} />
                                    <span className="text-sm text-gray-400 font-medium">Gross Minus Net</span>
                                </div>
                                <span className="text-sm font-bold text-white tracking-tight">${(earnings.totalGrossRevenue - earnings.totalNetRevenue).toFixed(2)}</span>
                            </div>
                        </div>

                        <p className="w-full mt-6 py-3 text-center text-xs text-gray-500 border border-dashed border-gray-800 rounded-xl">
                            Withdrawals aren't wired yet — royalties settle through your connected payout method.
                        </p>
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

                <div 
                    className="absolute top-0 right-0 w-64 h-64 blur-[100px] pointer-events-none -mr-32 -mt-32"
                    style={{ backgroundColor: `color-mix(in srgb, var(${moduleColor.cssVar}) 5%, transparent)` }}
                />
            </div>

            {/* Always show breakdown below the summary card if we have data */}
            {earnings && (
                <EarningsBreakdown
                    byPlatform={platformBreakdown}
                    byTerritory={territoryBreakdown}
                    byTrack={earnings.byRelease?.map((r) => ({
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
