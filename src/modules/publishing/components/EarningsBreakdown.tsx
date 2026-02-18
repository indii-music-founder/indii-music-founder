import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Globe, Smartphone, Music, MapPin, TrendingUp, DollarSign } from 'lucide-react';

interface EarningsBreakdownItem {
    label: string;
    revenue: number;
    percentage: number;
    growth?: number;
}

interface EarningsBreakdownProps {
    byPlatform: EarningsBreakdownItem[];
    byTerritory: EarningsBreakdownItem[];
    byTrack?: EarningsBreakdownItem[];
}

export const EarningsBreakdown: React.FC<EarningsBreakdownProps> = ({
    byPlatform,
    byTerritory,
    byTrack
}) => {
    const [activeTab, setActiveTab] = useState<'platform' | 'territory' | 'track'>('platform');

    const tabs: { id: 'platform' | 'territory' | 'track'; label: string; icon: React.ReactNode }[] = [
        { id: 'platform', label: 'Platforms', icon: <Smartphone size={14} /> },
        { id: 'territory', label: 'Territories', icon: <MapPin size={14} /> },
        { id: 'track', label: 'Top Tracks', icon: <Music size={14} /> },
    ];

    const currentData = activeTab === 'platform' ? byPlatform :
        activeTab === 'territory' ? byTerritory :
            byTrack || [];

    return (
        <div className="bg-[#121212] border border-gray-800 rounded-2xl p-6 shadow-xl flex flex-col h-full">
            <div className="flex items-center justify-between mb-6">
                <h3 className="text-sm font-bold text-white uppercase tracking-widest">Revenue Breakdown</h3>
                <div className="flex p-1 bg-gray-900 rounded-xl border border-gray-800">
                    {tabs.map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${activeTab === tab.id
                                ? 'bg-gray-800 text-white shadow-sm'
                                : 'text-gray-500 hover:text-gray-300'
                                }`}
                        >
                            {tab.icon}
                            {tab.label}
                        </button>
                    ))}
                </div>
            </div>

            <div className="flex-1 space-y-4">
                <AnimatePresence mode="wait">
                    <motion.div
                        key={activeTab}
                        initial={{ opacity: 0, x: 10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -10 }}
                        className="space-y-4"
                    >
                        {currentData.length > 0 ? (
                            currentData.map((item, i) => (
                                <div key={item.label} className="group">
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center gap-3">
                                            <span className="text-sm font-medium text-gray-300 group-hover:text-white transition-colors">{item.label}</span>
                                            {item.growth !== undefined && (
                                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${item.growth >= 0 ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'
                                                    }`}>
                                                    {item.growth >= 0 ? '+' : ''}{item.growth}%
                                                </span>
                                            )}
                                        </div>
                                        <div className="text-right">
                                            <span className="text-sm font-black text-white">${item.revenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                        </div>
                                    </div>
                                    <div className="relative h-2 bg-gray-900 rounded-full overflow-hidden border border-gray-800/50">
                                        <motion.div
                                            initial={{ width: 0 }}
                                            animate={{ width: `${item.percentage}%` }}
                                            transition={{ duration: 1, delay: i * 0.1, ease: "circOut" }}
                                            className={`h-full rounded-full ${activeTab === 'platform' ? 'bg-blue-500' :
                                                activeTab === 'territory' ? 'bg-purple-500' : 'bg-green-500'
                                                } opacity-80`}
                                        />
                                        <div className="absolute right-2 top-0 h-full flex items-center">
                                            <span className="text-[9px] font-mono text-gray-600 font-bold">{item.percentage}%</span>
                                        </div>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="flex flex-col items-center justify-center py-12 opacity-50">
                                <DollarSign size={32} className="text-gray-700 mb-2" />
                                <p className="text-xs font-bold text-gray-600 uppercase tracking-widest">No track data available</p>
                            </div>
                        )}
                    </motion.div>
                </AnimatePresence>
            </div>

            {/* Total Indicator */}
            <div className="mt-8 pt-6 border-t border-gray-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <TrendingUp size={16} className="text-blue-400" />
                    <span className="text-xs font-bold text-gray-500 uppercase tracking-tighter">Market Penetration</span>
                </div>
                <div className="flex -space-x-2">
                    {[1, 2, 3, 4].map(i => (
                        <div key={i} className="w-6 h-6 rounded-full border-2 border-[#121212] bg-gray-800 flex items-center justify-center text-[8px] font-bold text-gray-500">
                            {i}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};
