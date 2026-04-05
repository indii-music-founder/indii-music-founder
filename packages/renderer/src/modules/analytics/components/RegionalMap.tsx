import React from 'react';
import { motion } from 'motion/react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import type { RegionData } from '@/services/analytics/types';

interface RegionalMapProps {
    regions: RegionData[];
    totalStreams: number;
}

export const RegionalMap: React.FC<RegionalMapProps> = ({ regions, totalStreams }) => {
    const sorted = [...regions].sort((a, b) => b.streams - a.streams);

    return (
        <div className="space-y-2">
            {sorted.map((region, i) => {
                const share = totalStreams > 0 ? region.streams / totalStreams : 0;
                const isGrowing = region.growthRate > 0;

                return (
                    <motion.div
                        key={`${region.country}-${i}`}
                        initial={{ opacity: 0, x: 10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.3, delay: i * 0.05 }}
                        className="flex items-center gap-3"
                    >
                        <span className="text-lg w-7 shrink-0">{region.flag}</span>
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-1">
                                <span className="text-xs text-slate-300 font-medium truncate">{region.country}</span>
                                <div className="flex items-center gap-1 shrink-0 ml-2">
                                    {isGrowing
                                        ? <TrendingUp size={10} className="text-emerald-400" />
                                        : <TrendingDown size={10} className="text-red-400" />
                                    }
                                    <span className={`text-xs font-semibold ${isGrowing ? 'text-emerald-400' : 'text-red-400'}`}>
                                        {isGrowing ? '+' : ''}{region.growthRate.toFixed(0)}%
                                    </span>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="flex-1 h-1 bg-slate-700 rounded-full overflow-hidden">
                                    <motion.div
                                        className="h-full bg-indigo-500 rounded-full"
                                        initial={{ width: 0 }}
                                        animate={{ width: `${share * 100}%` }}
                                        transition={{ duration: 0.6, ease: 'easeOut', delay: i * 0.05 + 0.1 }}
                                    />
                                </div>
                                <span className="text-xs text-slate-500 w-14 text-right shrink-0">
                                    {region.streams >= 1000000
                                        ? `${(region.streams / 1000000).toFixed(1)}M`
                                        : region.streams >= 1000
                                            ? `${(region.streams / 1000).toFixed(0)}K`
                                            : region.streams.toLocaleString()}
                                </span>
                            </div>
                        </div>
                    </motion.div>
                );
            })}
        </div>
    );
};
