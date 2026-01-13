import React, { useEffect, useState } from 'react';
import { useFinance } from '../hooks/useFinance';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RevenueChart } from './RevenueChart';
import { EarningsTable } from './EarningsTable';
import { type EarningsSummary as ValidatedEarningsSummary } from '@/services/revenue/schema';
import { motion } from 'framer-motion';
import { TrendingUp, Music, Globe, DollarSign, ArrowUpRight } from 'lucide-react';

const OverviewTab = ({ data }: { data: ValidatedEarningsSummary }) => (
    <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8"
    >
        <div className="group relative overflow-hidden bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl p-6 transition-all hover:bg-white/5 hover:border-white/20">
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <div className="flex flex-row items-center justify-between space-y-0 pb-2 relative z-10">
                <h3 className="text-sm font-medium text-gray-400">Total Revenue</h3>
                <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-400">
                    <DollarSign size={16} />
                </div>
            </div>
            <div className="relative z-10">
                <div className="text-3xl font-bold text-white mt-2">${data.totalNetRevenue.toFixed(2)}</div>
                <p className="text-xs text-emerald-400 flex items-center gap-1 mt-1">
                    <TrendingUp size={12} />
                    +20.1% from last month
                </p>
            </div>
        </div>

        <div className="group relative overflow-hidden bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl p-6 transition-all hover:bg-white/5 hover:border-white/20">
            <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <div className="flex flex-row items-center justify-between space-y-0 pb-2 relative z-10">
                <h3 className="text-sm font-medium text-gray-400">Total Streams</h3>
                <div className="w-8 h-8 rounded-full bg-purple-500/10 flex items-center justify-center text-purple-400">
                    <Music size={16} />
                </div>
            </div>
            <div className="relative z-10">
                <div className="text-3xl font-bold text-white mt-2">{(data.totalStreams / 1000000).toFixed(2)}M</div>
                <p className="text-xs text-gray-500 mt-1">Across all platforms</p>
            </div>
        </div>

        {/* Placeholder Stats */}
        <div className="group relative overflow-hidden bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl p-6 transition-all hover:bg-white/5 hover:border-white/20">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <div className="flex flex-row items-center justify-between space-y-0 pb-2 relative z-10">
                <h3 className="text-sm font-medium text-gray-400">Top Territory</h3>
                <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-400">
                    <Globe size={16} />
                </div>
            </div>
            <div className="relative z-10">
                <div className="text-3xl font-bold text-white mt-2">US</div>
                <p className="text-xs text-gray-500 mt-1">42% of total revenue</p>
            </div>
        </div>

        <div className="group relative overflow-hidden bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl p-6 transition-all hover:bg-white/5 hover:border-white/20">
            <div className="absolute inset-0 bg-gradient-to-br from-orange-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <div className="flex flex-row items-center justify-between space-y-0 pb-2 relative z-10">
                <h3 className="text-sm font-medium text-gray-400">Pending Payout</h3>
                <div className="w-8 h-8 rounded-full bg-orange-500/10 flex items-center justify-center text-orange-400">
                    <ArrowUpRight size={16} />
                </div>
            </div>
            <div className="relative z-10">
                <div className="text-3xl font-bold text-white mt-2">$2,450.00</div>
                <p className="text-xs text-gray-500 mt-1">Scheduled for Feb 15</p>
            </div>
        </div>
    </motion.div>
);

export const EarningsDashboard: React.FC = () => {
    // Custom hook
    const { earningsSummary, earningsLoading: loading, earningsError: error } = useFinance();
    const [activeTab, setActiveTab] = useState('overview');

    if (loading) return (
        <div className="flex items-center justify-center h-96">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
        </div>
    );

    if (error) return (
        <div className="flex flex-col items-center justify-center h-96 bg-black/20 rounded-3xl border border-red-500/20 m-8">
            <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center text-red-500 mb-4">
                <ArrowUpRight size={24} className="rotate-45" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Fetch Error</h3>
            <p className="text-gray-500 max-w-sm text-center px-6">{error}</p>
        </div>
    );

    if (!earningsSummary) return (
        <div className="flex flex-col items-center justify-center h-96 bg-black/20 rounded-3xl border border-white/5 m-8 border-dashed">
            <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center text-gray-600 mb-4">
                <DollarSign size={24} />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">No Reports Found</h3>
            <p className="text-gray-500 max-w-sm text-center px-6">
                Your royalty reports haven't arrived yet. Once your distributor processes your streams, they'll appear here automatically.
            </p>
            <div className="mt-8 flex gap-4">
                <button className="px-6 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-sm font-bold text-gray-300 transition-all uppercase tracking-widest">
                    Refresh
                </button>
            </div>
        </div>
    );

    return (
        <div className="flex flex-col space-y-6 pt-2 pb-8 bg-transparent min-h-screen">
            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center justify-between space-y-2 mb-4"
            >
                <div>
                    {/* Header Removed to avoid duplication with parent layout */}
                    <div className="flex items-center gap-2">
                        <span className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs text-gray-400">
                            Fiscal Year 2024
                        </span>
                        <span className="px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-400">
                            Active
                        </span>
                    </div>
                </div>
                <div className="flex items-center space-x-2">
                    {/* Date picker placeholder */}
                    <button className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-sm text-gray-300 transition-colors">
                        January 2024
                    </button>
                    <button className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-lg transition-colors shadow-lg shadow-purple-500/20">
                        Download Report
                    </button>
                </div>
            </motion.div>

            <Tabs defaultValue="overview" className="space-y-6" onValueChange={setActiveTab}>
                <TabsList className="bg-black/40 border border-white/10 p-1 rounded-xl">
                    <TabsTrigger value="overview" className="data-[state=active]:bg-white/10 data-[state=active]:text-white text-gray-400 rounded-lg">Overview</TabsTrigger>
                    <TabsTrigger value="platforms" className="data-[state=active]:bg-white/10 data-[state=active]:text-white text-gray-400 rounded-lg">By Platform</TabsTrigger>
                    <TabsTrigger value="releases" className="data-[state=active]:bg-white/10 data-[state=active]:text-white text-gray-400 rounded-lg">By Release</TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="space-y-6 outline-none">
                    <OverviewTab data={earningsSummary} />

                    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: 0.2 }}
                            className="col-span-4 bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl p-6"
                        >
                            <RevenueChart
                                data={earningsSummary.byPlatform.map(p => ({
                                    label: p.platformName,
                                    value: p.revenue
                                }))}
                                title="Revenue by Platform"
                            />
                        </motion.div>

                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: 0.3 }}
                            className="col-span-3 bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl p-0 overflow-hidden flex flex-col"
                        >
                            <div className="p-6 border-b border-white/5">
                                <h3 className="font-semibold text-white">Top Territories</h3>
                                <p className="text-xs text-gray-500">Revenue distribution by region</p>
                            </div>
                            <div className="flex-1 overflow-y-auto p-6 space-y-5">
                                {earningsSummary.byTerritory.map((t, i) => (
                                    <div key={t.territoryCode} className="flex items-center group">
                                        <div className={`w-2 h-8 rounded-full mr-4 ${i === 0 ? 'bg-blue-500' : 'bg-white/10 group-hover:bg-white/20'}`} />
                                        <div className="flex-1 space-y-1">
                                            <p className="text-sm font-medium text-gray-200 leading-none">{t.territoryName}</p>
                                            <p className="text-xs text-gray-500">{t.territoryCode}</p>
                                        </div>
                                        <div className="font-medium text-white">+${t.revenue.toLocaleString()}</div>
                                    </div>
                                ))}
                            </div>
                        </motion.div>
                    </div>
                </TabsContent>

                <TabsContent value="platforms" className="outline-none">
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden"
                    >
                        <div className="p-6 border-b border-white/5">
                            <h3 className="font-semibold text-white">Platform Breakdown</h3>
                        </div>
                        <div className="p-6">
                            {earningsSummary.byPlatform.map(p => (
                                <div key={p.platformName} className="flex justify-between items-center py-4 border-b border-white/5 last:border-0 hover:bg-white/5 px-4 -mx-4 transition-colors">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded bg-white/10 flex items-center justify-center text-xs font-bold text-gray-400">
                                            {p.platformName[0]}
                                        </div>
                                        <span className="text-gray-200 font-medium">{p.platformName}</span>
                                    </div>
                                    <span className="text-white font-mono">${p.revenue.toFixed(2)}</span>
                                </div>
                            ))}
                        </div>
                    </motion.div>
                </TabsContent>

                <TabsContent value="releases" className="outline-none">
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden"
                    >
                        <EarningsTable data={earningsSummary.byRelease} />
                    </motion.div>
                </TabsContent>
            </Tabs>
        </div>
    );
};
