import React, { useEffect, useState } from 'react';
import { RevenueService, RevenueStats, RecentSale } from '@/services/RevenueService';
import { useStore } from '@/core/store';
import { DollarSign, CreditCard, ShoppingBag, TrendingUp, Clock, CheckCircle, AlertCircle } from 'lucide-react';
import SalesAnalytics from './SalesAnalytics';

export default function RevenueView() {
    const [stats, setStats] = useState<RevenueStats | null>(null);
    const [recentSales, setRecentSales] = useState<RecentSale[]>([]);
    const [loading, setLoading] = useState(true);
    const currentUser = useStore((state) => state.user);

    useEffect(() => {
        if (!currentUser) return;

        const loadData = async () => {
            setLoading(true);
            try {
                const [statsData, salesData] = await Promise.all([
                    RevenueService.getStats(currentUser.uid),
                    RevenueService.getRecentSales(currentUser.uid)
                ]);
                setStats(statsData);
                setRecentSales(salesData);
            } catch (error) {
                console.error("Failed to load revenue data:", error);
            } finally {
                setLoading(false);
            }
        };

        loadData();
    }, [currentUser]);

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD'
        }).format(amount);
    };

    return (
        <div className="space-y-6">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <CreditCard className="text-blue-400" />
                Finance & Commerce
            </h2>

            {/* Top Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                    label="Total Revenue"
                    value={stats ? formatCurrency(stats.totalRevenue) : '—'}
                    icon={<DollarSign className="text-green-400" size={20} />}
                    trend="+12% this month"
                    loading={loading}
                />
                <StatCard
                    label="Pending Payout"
                    value={stats ? formatCurrency(stats.pendingPayout) : '—'}
                    icon={<Clock className="text-orange-400" size={20} />}
                    subtext="Next payout: Friday"
                    loading={loading}
                />
                <StatCard
                    label="Total Sales"
                    value={stats ? stats.totalSales.toString() : '—'}
                    icon={<ShoppingBag className="text-purple-400" size={20} />}
                    loading={loading}
                />
                <StatCard
                    label="Avg. Order Value"
                    value={stats ? formatCurrency(stats.averageOrderValue) : '—'}
                    icon={<TrendingUp className="text-blue-400" size={20} />}
                    loading={loading}
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Chart Section */}
                <div className="lg:col-span-2 min-h-[300px]">
                    <SalesAnalytics />
                </div>

                {/* Recent Transactions */}
                <div className="bg-[#161b22] border border-gray-800 rounded-xl p-6 overflow-hidden flex flex-col">
                    <h3 className="text-lg font-bold text-white mb-4">Recent Transactions</h3>

                    <div className="flex-1 overflow-y-auto pr-2 space-y-3 custom-scrollbar">
                        {loading ? (
                            <div className="space-y-3">
                                {[1, 2, 3].map(i => (
                                    <div key={i} className="h-16 bg-gray-800/50 rounded-lg animate-pulse" />
                                ))}
                            </div>
                        ) : recentSales.length === 0 ? (
                            <div className="text-center text-gray-500 py-8">No transactions yet.</div>
                        ) : (
                            recentSales.map((sale) => (
                                <div key={sale.id} className="flex items-center justify-between p-3 bg-gray-900/50 rounded-lg border border-gray-800 hover:border-gray-700 transition-colors">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center
                                            ${sale.status === 'completed' ? 'bg-green-500/20 text-green-400' :
                                                sale.status === 'pending' ? 'bg-orange-500/20 text-orange-400' :
                                                    'bg-red-500/20 text-red-400'}`}>
                                            {sale.status === 'completed' ? <CheckCircle size={14} /> :
                                                sale.status === 'pending' ? <Clock size={14} /> :
                                                    <AlertCircle size={14} />}
                                        </div>
                                        <div>
                                            <div className="text-sm font-medium text-white">{sale.productName}</div>
                                            <div className="text-xs text-gray-400">{sale.customerName} • {new Date(sale.date).toLocaleDateString()}</div>
                                        </div>
                                    </div>
                                    <div className="font-mono font-semibold text-white">
                                        +{formatCurrency(sale.amount)}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

function StatCard({ label, value, icon, trend, subtext, loading }: any) {
    return (
        <div className="bg-[#161b22] p-5 rounded-xl border border-gray-800">
            <div className="flex justify-between items-start mb-2">
                <span className="text-gray-400 text-xs uppercase tracking-wider font-semibold">{label}</span>
                {icon}
            </div>

            {loading ? (
                <div className="h-8 w-24 bg-gray-800 rounded animate-pulse my-1" />
            ) : (
                <div className="text-2xl font-bold text-white mb-1">{value}</div>
            )}

            {(trend || subtext) && (
                <div className="text-xs">
                    {trend && <span className="text-green-400 font-medium">{trend}</span>}
                    {subtext && <span className="text-gray-500 ml-1">{subtext}</span>}
                </div>
            )}
        </div>
    );
}
