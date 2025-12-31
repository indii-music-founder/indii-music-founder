import React, { useEffect, useState } from 'react';
import { useStore } from '@/core/store';
import { revenueService } from '@/services/RevenueService';
import { DollarSign, TrendingUp, ShoppingBag, ExternalLink, Download } from 'lucide-react';
import { AnimatedNumber } from '@/components/motion-primitives/animated-number';
import SalesAnalytics from './SalesAnalytics';

export default function RevenueView() {
    const userProfile = useStore(state => state.userProfile);
    const [totalRevenue, setTotalRevenue] = useState(0);
    const [revenueBySource, setRevenueBySource] = useState<{ direct: number, social: number }>({ direct: 0, social: 0 });
    const [topProducts, setTopProducts] = useState<{ id: string, amount: number }[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!userProfile?.id) return;

        const loadData = async () => {
            setLoading(true);
            try {
                const [total, bySource, byProduct] = await Promise.all([
                    revenueService.getTotalRevenue(userProfile.id),
                    revenueService.getRevenueBySource(userProfile.id),
                    revenueService.getRevenueByProduct(userProfile.id)
                ]);

                setTotalRevenue(total);
                setRevenueBySource(bySource);

                // Process top products
                const sortedProducts = Array.from(byProduct.entries())
                // Optimization: Fetch all stats in a single query
                const stats = await revenueService.getUserRevenueStats(userProfile.id);

                setTotalRevenue(stats.totalRevenue);
                setRevenueBySource(stats.revenueBySource);

                // Process top products
                const sortedProducts = Object.entries(stats.revenueByProduct)
                    .map(([id, amount]) => ({ id, amount }))
                    .sort((a, b) => b.amount - a.amount)
                    .slice(0, 5);
                setTopProducts(sortedProducts);

            } catch (error) {
                console.error("Failed to load revenue data:", error);
            } finally {
                setLoading(false);
            }
        };

        // Poll for updates or just load once?
        // User asked for "Real Data", so let's keep it simple with fetch-on-mount for now.
        // If we wanted real-time, we'd use onSnapshot in the service.
        loadData();
    }, [userProfile?.id]);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6 p-6">
            <header className="flex justify-between items-end">
                <div>
                    <h2 className="text-2xl font-bold text-white mb-1">Revenue & Sales</h2>
                    <p className="text-gray-400 text-sm">Track your earnings from direct sales and social drops.</p>
                </div>
                <button className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg text-sm font-medium flex items-center gap-2 transition-colors">
                    <Download size={16} /> Export CSV
                </button>
            </header>

            {/* Key Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-[#161b22] border border-gray-800 rounded-xl p-5 relative overflow-hidden group hover:border-green-500/50 transition-colors">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <DollarSign size={64} className="text-green-500" />
                    </div>
                    <h3 className="text-gray-400 text-sm font-medium uppercase tracking-wider mb-2">Total Earnings</h3>
                    <div className="flex items-baseline gap-1">
                        <span className="text-2xl font-bold text-green-500">$</span>
                        <span className="text-4xl font-black text-white">
                            <AnimatedNumber value={totalRevenue} precision={2} />
                        </span>
                    </div>
                </div>

                <div className="bg-[#161b22] border border-gray-800 rounded-xl p-5 relative overflow-hidden group hover:border-blue-500/50 transition-colors">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <ShoppingBag size={64} className="text-blue-500" />
                    </div>
                    <h3 className="text-gray-400 text-sm font-medium uppercase tracking-wider mb-2">Social Drop Sales</h3>
                    <div className="flex items-baseline gap-1">
                        <span className="text-2xl font-bold text-blue-500">$</span>
                        <span className="text-4xl font-black text-white">
                            <AnimatedNumber value={revenueBySource.social} precision={2} />
                        </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                        {totalRevenue > 0 ? ((revenueBySource.social / totalRevenue) * 100).toFixed(1) : 0}% of total
                    </p>
                </div>

                <div className="bg-[#161b22] border border-gray-800 rounded-xl p-5 relative overflow-hidden group hover:border-purple-500/50 transition-colors">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <TrendingUp size={64} className="text-purple-500" />
                    </div>
                    <h3 className="text-gray-400 text-sm font-medium uppercase tracking-wider mb-2">Storefront Sales</h3>
                    <div className="flex items-baseline gap-1">
                        <span className="text-2xl font-bold text-purple-500">$</span>
                        <span className="text-4xl font-black text-white">
                            <AnimatedNumber value={revenueBySource.direct} precision={2} />
                        </span>
                    </div>
                </div>
            </div>

            {/* Detailed Breakdown */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-[#161b22] border border-gray-800 rounded-xl p-6">
                    <h3 className="text-lg font-bold text-white mb-4">Top Performing Products</h3>
                    {topProducts.length === 0 ? (
                        <div className="text-center text-gray-500 py-8 text-sm">No sales data available yet.</div>
                    ) : (
                        <div className="space-y-4">
                            {topProducts.map((p, i) => (
                                <div key={p.id} className="flex items-center justify-between group">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded bg-gray-800 flex items-center justify-center text-xs font-bold text-gray-500">
                                            {i + 1}
                                        </div>
                                        <div>
                                            {/* In a real app we'd fetch the product name here too */}
                                            <p className="text-sm font-medium text-white group-hover:text-blue-400 transition-colors">Product {p.id.substring(0, 8)}...</p>
                                            <p className="text-xs text-gray-500">Physical Good</p>
                                            <p className="text-sm font-medium text-white group-hover:text-blue-400 transition-colors">Product {p.id.substring(0, 8)}...</p>
                                            <p className="text-xs text-gray-500">Sales Item</p>
                                        </div>
                                    </div>
                                    <span className="text-sm font-bold text-white">${p.amount.toFixed(2)}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Replaced placeholder with actual Analytics component */}
                <div className="bg-[#161b22] border border-gray-800 rounded-xl p-6">
                    <SalesAnalytics />
                <div className="bg-[#161b22] border border-gray-800 rounded-xl p-6 flex flex-col justify-center items-center text-center">
                    <div className="w-16 h-16 bg-gray-800/50 rounded-full flex items-center justify-center mb-4">
                        <TrendingUp size={24} className="text-gray-400" />
                    </div>
                    <h3 className="text-lg font-bold text-white mb-2">Growth Analytics</h3>
                    <p className="text-sm text-gray-400 max-w-xs mb-6">
                        Unlock advanced analytics to see customer demographics, retention rates, and lifetime value.
                    </p>
                    <button className="px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg text-sm font-bold hover:shadow-lg hover:shadow-purple-500/20 transition-all">
                        Upgrade to Pro
                    </button>
                </div>
            </div>
        </div>
    );
}
