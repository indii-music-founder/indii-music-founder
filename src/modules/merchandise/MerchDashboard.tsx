import React, { useCallback } from 'react';
import { MerchLayout } from './components/Layout';
import { MerchCard } from './components/MerchCard';
import { MerchButton } from './components/MerchButton';
import { TrendingUp, ShoppingBag, DollarSign, Plus, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useMerchandise } from './hooks/useMerchandise';
import { useStore } from '@/core/store';
import { TopSellingProductItem } from './components/TopSellingProductItem';
import { RecentDesignItem } from './components/RecentDesignItem';
import { formatCurrency } from '@/lib/utils';

export default function MerchDashboard() {
    const navigate = useNavigate();
    const { userProfile } = useStore();
    const { stats, topSellingProducts, products, loading, error } = useMerchandise();

    const handleDesignClick = useCallback(() => {
        navigate('/merch/design');
    }, [navigate]);

    if (loading) {
        return (
            <MerchLayout>
                <div className="flex items-center justify-center h-[calc(100vh-100px)]" data-testid="merch-dashboard-loading">
                    <Loader2 className="w-10 h-10 text-[#FFE135] animate-spin" />
                </div>
            </MerchLayout>
        );
    }

    if (error) {
        return (
            <MerchLayout>
                <div className="flex items-center justify-center h-[calc(100vh-100px)] flex-col gap-4" data-testid="merch-dashboard-error">
                    <p className="text-red-500 font-bold" data-testid="merch-error-message">Failed to load dashboard data.</p>
                    <p className="text-neutral-400">{error}</p>
                </div>
            </MerchLayout>
        );
    }

    return (
        <MerchLayout>
            <div className="max-w-7xl mx-auto space-y-8" data-testid="merch-dashboard-content">

                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="mb-6">
                        <h2 className="text-3xl font-bold text-white mb-1">Morning, {userProfile?.displayName?.split(' ')[0] || 'Chief'}</h2>
                        <p className="text-neutral-400">Your empire is growing.</p>
                    </div>
                    <MerchButton
                        onClick={handleDesignClick}
                        glow size="lg"
                        className="rounded-full"
                        data-testid="new-design-btn"
                    >
                        <Plus size={18} />
                        New Design
                    </MerchButton>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <StatsCard
                        title="Total Revenue"
                        value={formatCurrency(stats.totalRevenue)}
                        change={`+${stats.revenueChange}%`}
                        icon={<DollarSign className="text-[#FFE135]" />}
                    />
                    <StatsCard
                        title="Units Sold"
                        value={stats.unitsSold.toString()}
                        change={`+${stats.unitsChange}%`}
                        icon={<ShoppingBag className="text-[#FFE135]" />}
                    />
                    <StatsCard
                        title="Conversion Rate"
                        value={`${stats.conversionRate}%`}
                        change="+1.1%"
                        icon={<TrendingUp className="text-[#FFE135]" />}
                    />
                </div>

                {/* Creative Health (Performance Metrics) */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <MerchCard className="p-6 relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-4 opacity-10">
                            <span className="text-6xl">📈</span>
                        </div>
                        <div className="relative z-10">
                            <h3 className="text-lg font-bold text-white mb-2" data-testid="trend-score-title">Trend Score</h3>
                            <div className="flex items-end gap-2 mb-2">
                                <span className="text-4xl font-black text-[#FFE135]">94</span>
                                <span className="text-sm text-neutral-400 mb-1">/ 100</span>
                            </div>
                            <div className="w-full bg-white/10 rounded-full h-2 mb-2">
                                <div className="bg-[#FFE135] h-2 rounded-full" style={{ width: '94%' }} />
                            </div>
                            <p className="text-xs text-neutral-500">Your designs are trending fresh. 2 new viral signals detected.</p>
                        </div>
                    </MerchCard>

                    <MerchCard className="p-6 relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-4 opacity-10">
                            <span className="text-6xl">⚡️</span>
                        </div>
                        <div className="relative z-10">
                            <h3 className="text-lg font-bold text-white mb-2" data-testid="production-performance-title">Production Velocity</h3>
                            <div className="flex items-end gap-2 mb-2">
                                <span className="text-4xl font-black text-green-400">+12%</span>
                                <span className="text-sm text-neutral-400 mb-1">vs last week</span>
                            </div>
                            <div className="flex gap-1 h-2 mb-2">
                                <div className="flex-1 bg-green-500/20 rounded-full overflow-hidden">
                                    <div className="h-full bg-green-500 w-[70%]" />
                                </div>
                            </div>
                            <p className="text-xs text-neutral-500">Production efficiency is up. Global logistics optimal.</p>
                        </div>
                    </MerchCard>
                </div>

                {/* Main Sections */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                    {/* Top Sellers */}
                    <div className="lg:col-span-2 space-y-6">
                        <div className="flex items-center justify-between">
                            <h3 className="text-xl font-bold text-white">Top Performing Products</h3>
                            <button className="text-xs text-[#FFE135] hover:underline">View All</button>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {topSellingProducts.length > 0 ? (
                                topSellingProducts.map((product) => (
                                    <TopSellingProductItem key={product.id} product={product} />
                                ))
                            ) : (
                                <div className="col-span-2 p-8 text-center border border-dashed border-white/10 rounded-lg">
                                    <p className="text-neutral-500 mb-4">No sales yet. Time to market!</p>
                                    <MerchButton size="sm" variant="outline" onClick={handleDesignClick}>
                                        Start Selling
                                    </MerchButton>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Recent Designs */}
                    <div className="space-y-6">
                        <div className="flex items-center justify-between">
                            <h3 className="text-xl font-bold text-white">Fresh Prints</h3>
                            <button className="text-xs text-[#FFE135] hover:underline">Drafts</button>
                        </div>
                        <div className="space-y-4">
                            {products.slice(0, 3).map((product) => (
                                <RecentDesignItem
                                    key={product.id}
                                    product={product}
                                    onClick={handleDesignClick}
                                />
                            ))}
                            {products.length === 0 && (
                                <p className="text-neutral-500 text-sm">No products created yet.</p>
                            )}
                        </div>

                        <MerchCard className="p-6 bg-gradient-to-br from-[#FFE135]/10 to-transparent border-[#FFE135]/20">
                            <h4 className="font-bold text-[#FFE135] mb-2">Campaign Ready?</h4>
                            <p className="text-xs text-neutral-400 mb-4">You have {products.length} approved designs ready for production.</p>
                            <MerchButton size="sm" variant="outline" className="w-full">
                                <Plus size={16} />
                                Launch Campaign
                            </MerchButton>
                        </MerchCard>
                    </div>
                </div>
            </div>
        </MerchLayout>
    );
}

function StatsCard({ title, value, change, icon }: { title: string, value: string, change: string, icon: React.ReactNode }) {
    return (
        <MerchCard className="p-6">
            <div className="flex items-start justify-between mb-4">
                <div className="w-10 h-10 rounded-full bg-[#FFE135]/10 flex items-center justify-center border border-[#FFE135]/20">
                    {icon}
                </div>
                <span className="text-xs font-mono text-[#CCFF00] bg-[#CCFF00]/10 px-2 py-1 rounded">{change}</span>
            </div>
            <div className="space-y-1">
                <p className="text-sm text-neutral-500 uppercase tracking-widest">{title}</p>
                <h3 className="text-3xl font-black text-white">{value}</h3>
            </div>
        </MerchCard>
    )
}
