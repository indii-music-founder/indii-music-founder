import React, { useEffect, useState } from 'react';
import { useStore } from '@/core/store';
import { revenueService } from '@/services/RevenueService';
import { DollarSign, TrendingUp, ShoppingBag, Download, Trophy, Zap } from 'lucide-react';
import { AnimatedNumber } from '@/components/motion-primitives/animated-number';
import SalesAnalytics from './SalesAnalytics';

// Gamification goal milestone — first $1,000
const FIRST_MILESTONE = 1000;

function GoalTracker({ totalRevenue }: { totalRevenue: number }) {
    const progress = Math.min((totalRevenue / FIRST_MILESTONE) * 100, 100);
    const isComplete = totalRevenue >= FIRST_MILESTONE;
    const remaining = Math.max(FIRST_MILESTONE - totalRevenue, 0);

    return (
        <div className="bg-gradient-to-r from-[#1a1f2e] to-[#161b22] border border-gray-700/80 rounded-xl p-5 relative overflow-hidden">
            {/* Glow effect */}
            <div className="absolute -top-8 -right-8 w-32 h-32 bg-green-500/10 rounded-full blur-xl pointer-events-none" />

            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-yellow-500/20 flex items-center justify-center">
                        <Trophy size={16} className="text-yellow-400" />
                    </div>
                    <div>
                        <p className="text-sm font-bold text-white">First $1,000 Milestone</p>
                        <p className="text-xs text-gray-500">
                            {isComplete
                                ? 'Milestone achieved! Keep going 🚀'
                                : `$${remaining.toFixed(2)} to go`}
                        </p>
                    </div>
                </div>
                <span className={`text-lg font-black ${isComplete ? 'text-yellow-400' : 'text-green-400'}`}>
                    {progress.toFixed(0)}%
                </span>
            </div>

            {/* Progress bar */}
            <div className="w-full h-3 bg-gray-800 rounded-full overflow-hidden">
                <div
                    className={`h-full rounded-full transition-all duration-1000 ease-out ${isComplete
                            ? 'bg-gradient-to-r from-yellow-500 to-yellow-300'
                            : 'bg-gradient-to-r from-green-600 to-emerald-400'
                        }`}
                    style={{ width: `${progress}%` }}
                />
            </div>

            <div className="flex justify-between mt-2 text-xs text-gray-600">
                <span>$0</span>
                <span className="text-gray-400 font-medium">${totalRevenue.toFixed(2)} earned</span>
                <span>$1,000</span>
            </div>

            {!isComplete && (
                <div className="mt-3 flex items-center gap-2 text-xs text-blue-400">
                    <Zap size={12} />
                    <span>Tip: Post a Social Drop to accelerate your earnings</span>
                </div>
            )}
        </div>
    );
}

export default function RevenueView() {
    const userProfile = useStore(state => state.userProfile);
    const [totalRevenue, setTotalRevenue] = useState(0);
    const [revenueBySource, setRevenueBySource] = useState<{ streaming: number; merch: number; licensing: number; social: number }>({ streaming: 0, merch: 0, licensing: 0, social: 0 });
    const [topProducts, setTopProducts] = useState<{ id: string, amount: number }[]>([]);
    const [loading, setLoading] = useState(true);
    const [period, setPeriod] = useState<'30d' | '90d' | '12y' | 'all'>('30d');

    useEffect(() => {
        if (!userProfile?.id) return;

        const loadData = async () => {
            setLoading(true);
            try {
                const stats = await revenueService.getUserRevenueStats(userProfile.id, period);

                setTotalRevenue(stats.totalRevenue);
                setRevenueBySource(stats.sources);

                const sortedProducts = Object.entries(stats.revenueByProduct)
                    .map(([id, amount]) => ({ id, amount }))
                    .sort((a, b) => b.amount - a.amount)
                    .slice(0, 5);
                setTopProducts(sortedProducts);

            } catch (error) {
                console.error('Failed to load revenue data:', error);
            } finally {
                setLoading(false);
            }
        };

        loadData();
    }, [userProfile?.id, period]);

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
                    <h2 className="text-2xl font-bold text-white mb-1">Revenue &amp; Sales</h2>
                    <p className="text-gray-400 text-sm">Track your earnings from direct sales and social drops.</p>
                </div>
                <div className="flex items-center gap-3">
                    <select
                        value={period}
                        onChange={(e) => setPeriod(e.target.value as typeof period)}
                        className="bg-gray-800 border border-gray-700 text-sm text-white rounded-lg px-3 py-2 outline-none focus:border-blue-500 transition-colors"
                        aria-label="Revenue period filter"
                    >
                        <option value="30d">Last 30 Days</option>
                        <option value="90d">Last 90 Days</option>
                        <option value="12y">This Year</option>
                        <option value="all">All Time</option>
                    </select>
                    <button className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg text-sm font-medium flex items-center gap-2 transition-colors">
                        <Download size={16} /> Export CSV
                    </button>
                </div>
            </header>

            {/* Gamification: First $1K Goal Tracker */}
            <GoalTracker totalRevenue={totalRevenue} />

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
                            <AnimatedNumber value={revenueBySource.merch} precision={2} />
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

                {/* Sales Analytics Chart */}
                <div className="bg-[#161b22] border border-gray-800 rounded-xl p-6">
                    <SalesAnalytics />
                </div>

                {/* Growth Analytics — Pro Upsell */}
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
