import React, { useCallback, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { MerchCard } from './components/MerchCard';
import { MerchButton } from './components/MerchButton';
import {
    TrendingUp, ShoppingBag, DollarSign, Plus, Loader2,
    LayoutGrid, PenTool, Package, Settings, LogOut,
    Palette, Truck, BarChart3, Sparkles, Star,
    Store, Flame, Globe, Wallet, Shield, Lock
} from 'lucide-react';

import { useMerchandise, MerchStats } from './hooks/useMerchandise';
import { useStore } from '@/core/store';
import { TopSellingProductItem } from './components/TopSellingProductItem';
import { RecentDesignItem } from './components/RecentDesignItem';
import { formatCurrency } from '@/lib/utils';
import { PODIntegrationPanel } from './components/PODIntegrationPanel';
import { StorefrontPreviewModal } from './components/StorefrontPreviewModal';
import { InventoryTracker } from './components/InventoryTracker';
import { PricingEngine } from './components/PricingEngine';
import { DropCampaignWizard } from './components/DropCampaignWizard';
import { WalletConnectPanel } from './components/WalletConnectPanel';
import { SmartContractGenerator } from './components/SmartContractGenerator';
import { BlockchainLedger } from './components/BlockchainLedger';
import { TokenGatedPreview } from './components/TokenGatedPreview';

type CenterTab = 'dashboard' | 'inventory' | 'pricing' | 'pod' | 'web3';
type Web3SubTab = 'wallet' | 'contracts' | 'ledger' | 'gated';

/* ================================================================== */
/*  Merch Dashboard — Three-Panel Layout                               */
/*                                                                     */
/*  ┌──────────┬───────────────────────────┬──────────────┐            */
/*  │  LEFT    │    CENTER                 │   RIGHT      │            */
/*  │  Merch   │    Stats + Products       │   Templates  │            */
/*  │  Nav     │    (workspace)            │   POD Status │            */
/*  │  Stats   │                           │   Analytics  │            */
/*  └──────────┴───────────────────────────┴──────────────┘            */
/* ================================================================== */

const MerchNavItem = ({ to, icon, children, exact }: { to: string; icon: React.ReactNode; children: React.ReactNode; exact?: boolean }) => (
    <NavLink
        to={to}
        end={exact}
        className={({ isActive }: { isActive: boolean }) => `
            flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200
            ${isActive
                ? 'bg-[#FFE135]/10 text-[#FFE135] shadow-[0_0_10px_rgba(255,225,53,0.1)] border border-[#FFE135]/20'
                : 'text-neutral-400 hover:text-white hover:bg-white/5'}
        `}
    >
        {icon}
        {children}
    </NavLink>
);

export default function MerchDashboard() {
    const navigate = useNavigate();
    const { userProfile } = useStore();
    const { stats, topSellingProducts, products, loading, error } = useMerchandise();
    const [centerTab, setCenterTab] = useState<CenterTab>('dashboard');
    const [web3SubTab, setWeb3SubTab] = useState<Web3SubTab>('wallet');
    const [storefrontOpen, setStorefrontOpen] = useState(false);
    const [dropWizardOpen, setDropWizardOpen] = useState(false);

    const handleDesignClick = useCallback(() => {
        navigate('/merch/design');
    }, [navigate]);

    if (loading) {
        return (
            <div className="absolute inset-0 flex items-center justify-center bg-[#050505]" data-testid="merch-dashboard-loading">
                <Loader2 className="w-10 h-10 text-[#FFE135] animate-spin" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="absolute inset-0 flex items-center justify-center bg-[#050505] flex-col gap-4" data-testid="merch-dashboard-error">
                <p className="text-red-500 font-bold" data-testid="merch-error-message">Failed to load dashboard data.</p>
                <p className="text-neutral-400">{error}</p>
            </div>
        );
    }

    return (
        <div className="absolute inset-0 flex bg-[#050505] text-white font-sans">
            {/* ── LEFT PANEL — Merch Sidebar + Stats ────── */}
            <aside className="hidden lg:flex w-64 flex-col border-r border-white/5 bg-black/50 backdrop-blur-xl flex-shrink-0 z-20">
                {/* Brand */}
                <div className="p-6 flex items-center gap-3">
                    <div className="w-8 h-8 bg-[#FFE135] rounded-lg flex items-center justify-center shadow-[0_0_15px_rgba(255,225,53,0.3)]">
                        <span className="text-black font-black text-lg">M</span>
                    </div>
                    <div>
                        <h1 className="font-bold text-lg tracking-tight leading-none">Merch<span className="text-[#FFE135]">Pro</span></h1>
                        <span className="text-[10px] text-neutral-500 uppercase tracking-widest font-mono">Merch OS</span>
                    </div>
                </div>

                {/* Nav */}
                <nav className="px-4 py-2 space-y-1">
                    <MerchNavItem to="/merch" icon={<LayoutGrid size={18} />} exact>Dashboard</MerchNavItem>
                    <MerchNavItem to="/merch/design" icon={<PenTool size={18} />}>Designer</MerchNavItem>
                    <MerchNavItem to="/merch/catalog" icon={<Package size={18} />}>Catalog</MerchNavItem>
                    <div className="pt-4 pb-2">
                        <div className="h-px bg-white/5 mx-2" />
                    </div>
                    <MerchNavItem to="/merch/settings" icon={<Settings size={18} />}>Settings</MerchNavItem>
                </nav>

                {/* Store Stats Widget */}
                <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
                    <StoreStatsWidget stats={stats} />
                    <TrendingProductsWidget topSellingProducts={topSellingProducts} />
                    <NewDesignsWidget products={products} onDesignClick={handleDesignClick} />
                </div>

                <div className="p-4 border-t border-white/5">
                    <button className="flex items-center gap-3 text-neutral-500 hover:text-white transition-colors w-full px-4 py-2 text-sm font-medium rounded-lg hover:bg-white/5">
                        <LogOut size={18} />
                        <span>Exit Studio</span>
                    </button>
                </div>
            </aside>

            {/* ── CENTER — Dashboard Workspace ────────────────────── */}
            <div className="flex-1 flex flex-col min-w-0 relative overflow-hidden">
                {/* Background Blobs */}
                <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] bg-[#FFE135]/5 rounded-full blur-[120px] pointer-events-none" />
                <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] bg-lime-400/5 rounded-full blur-[120px] pointer-events-none" />

                {/* Center Tab Bar */}
                <div className="flex items-center gap-1 px-6 pt-4 pb-0 relative z-10 border-b border-white/5">
                    {([
                        { id: 'dashboard', label: 'Dashboard', icon: LayoutGrid },
                        { id: 'inventory', label: 'Inventory', icon: Package },
                        { id: 'pricing', label: 'Pricing', icon: TrendingUp },
                        { id: 'pod', label: 'POD Partners', icon: Truck },
                        { id: 'web3', label: 'Web3', icon: Shield },
                    ] as { id: CenterTab; label: string; icon: React.ElementType }[]).map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setCenterTab(tab.id)}
                            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold transition-all border-b-2 -mb-px ${centerTab === tab.id
                                ? 'border-[#FFE135] text-[#FFE135]'
                                : 'border-transparent text-neutral-500 hover:text-neutral-300 hover:border-white/20'
                                }`}
                        >
                            <tab.icon size={13} />
                            {tab.label}
                        </button>
                    ))}
                    <div className="ml-auto flex items-center gap-2 pb-1">
                        <button
                            onClick={() => setStorefrontOpen(true)}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-[11px] font-bold text-neutral-400 hover:text-white hover:border-white/20 transition-all"
                        >
                            <Store size={11} /> Preview Store
                        </button>
                        <button
                            onClick={() => setDropWizardOpen(true)}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#FFE135]/10 border border-[#FFE135]/20 rounded-lg text-[11px] font-bold text-[#FFE135] hover:bg-[#FFE135]/20 transition-all"
                        >
                            <Flame size={11} /> Create Drop
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto relative z-10" data-testid="merch-dashboard-content">
                    {/* ─── Dashboard Tab ─── */}
                    {centerTab === 'dashboard' && (
                        <div className="p-8">
                            <div className="flex items-center justify-between mb-8">
                                <div>
                                    <h2 className="text-3xl font-bold text-white mb-1">Morning, {userProfile?.displayName?.split(' ')[0] || 'Chief'}</h2>
                                    <p className="text-neutral-400">Your merchandise empire is thriving.</p>
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

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                                <StatsCard
                                    title="Total Revenue"
                                    value={formatCurrency(stats.totalRevenue)}
                                    change={`${stats.revenueChange > 0 ? '+' : ''}${stats.revenueChange.toFixed(1)}%`}
                                    icon={<DollarSign className="text-[#FFE135]" />}
                                />
                                <StatsCard
                                    title="Units Sold"
                                    value={stats.unitsSold.toString()}
                                    change={`${stats.unitsChange > 0 ? '+' : ''}${stats.unitsChange.toFixed(1)}%`}
                                    icon={<ShoppingBag className="text-[#FFE135]" />}
                                />
                                <StatsCard
                                    title="Conversion Rate"
                                    value={`${stats.conversionRate ?? 0}%`}
                                    change={stats.conversionRate != null ? `${(stats.conversionRate as number) > 0 ? '+' : ''}${stats.conversionRate}%` : '--'}
                                    icon={<TrendingUp className="text-[#FFE135]" />}
                                />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                                <MerchCard className="p-6 relative overflow-hidden">
                                    <div className="absolute top-0 right-0 p-4 opacity-10"><span className="text-6xl">📈</span></div>
                                    <div className="relative z-10">
                                        <h3 className="text-lg font-bold text-white mb-2" data-testid="trend-score-title">Trend Score</h3>
                                        <div className="flex items-end gap-2 mb-2">
                                            <span className="text-4xl font-black text-[#FFE135]">{stats.trendScore}</span>
                                            <span className="text-sm text-neutral-400 mb-1">/ 100</span>
                                        </div>
                                        <div className="w-full bg-white/10 rounded-full h-2 mb-2">
                                            <div className="bg-[#FFE135] h-2 rounded-full transition-all duration-500" style={{ width: `${stats.trendScore}%` }} />
                                        </div>
                                        <p className="text-xs text-neutral-500">
                                            {stats.trendScore > 80 ? "Trending fresh. 2 new viral signals detected." : stats.trendScore > 0 ? "Design engagement is steady." : "No trend data available yet."}
                                        </p>
                                    </div>
                                </MerchCard>

                                <MerchCard className="p-6 relative overflow-hidden">
                                    <div className="absolute top-0 right-0 p-4 opacity-10"><span className="text-6xl">⚡️</span></div>
                                    <div className="relative z-10">
                                        <h3 className="text-lg font-bold text-white mb-2" data-testid="production-performance-title">Production Velocity</h3>
                                        <div className="flex items-end gap-2 mb-2">
                                            <span className={`text-4xl font-black ${stats.productionVelocity >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                                {stats.productionVelocity > 0 ? `+${stats.productionVelocity}%` : `${stats.productionVelocity}%`}
                                            </span>
                                            <span className="text-sm text-neutral-400 mb-1">vs last week</span>
                                        </div>
                                        <div className="flex gap-1 h-2 mb-2">
                                            <div className="flex-1 bg-white/10 rounded-full overflow-hidden">
                                                <div className={`h-full ${stats.productionVelocity >= 0 ? 'bg-green-500' : 'bg-red-500'} transition-all duration-500`} style={{ width: `${Math.min(Math.abs(stats.productionVelocity), 100)}%` }} />
                                            </div>
                                        </div>
                                        <p className="text-xs text-neutral-500">
                                            {stats.productionVelocity > 0 ? "Efficiency up. Global logistics optimal." : stats.productionVelocity < 0 ? "Throughput decreased this week." : "Production pace is stable."}
                                        </p>
                                    </div>
                                </MerchCard>
                            </div>

                            <div className="mb-8">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-xl font-bold text-white">Top Performing Products</h3>
                                    <button className="text-xs text-[#FFE135] hover:underline">View All</button>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                                    {topSellingProducts.length > 0 ? (
                                        topSellingProducts.map((product) => (
                                            <TopSellingProductItem key={product.id} product={product} />
                                        ))
                                    ) : (
                                        <div className="col-span-full p-8 text-center border border-dashed border-white/10 rounded-lg">
                                            <p className="text-neutral-500 mb-4">No sales yet. Time to market!</p>
                                            <MerchButton size="sm" variant="outline" onClick={handleDesignClick}>
                                                Start Selling
                                            </MerchButton>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ─── Inventory Tab ─── */}
                    {centerTab === 'inventory' && <InventoryTracker />}

                    {/* ─── Pricing Tab ─── */}
                    {centerTab === 'pricing' && <PricingEngine products={products} />}

                    {/* ─── POD Partners Tab ─── */}
                    {centerTab === 'pod' && <PODIntegrationPanel />}

                    {/* ─── Web3 Tab ─── */}
                    {centerTab === 'web3' && (
                        <div className="p-6">
                            {/* Web3 Sub-tabs */}
                            <div className="flex items-center gap-1 bg-white/5 p-1 rounded-xl mb-6">
                                {([
                                    { id: 'wallet', label: 'Wallet', icon: Wallet },
                                    { id: 'contracts', label: 'Smart Contracts', icon: Shield },
                                    { id: 'ledger', label: 'Ledger', icon: Globe },
                                    { id: 'gated', label: 'Gated Previews', icon: Lock },
                                ] as { id: Web3SubTab; label: string; icon: React.ElementType }[]).map(t => (
                                    <button
                                        key={t.id}
                                        onClick={() => setWeb3SubTab(t.id)}
                                        className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-bold rounded-lg transition-all ${web3SubTab === t.id ? 'bg-[#FFE135] text-black' : 'text-neutral-400 hover:text-white'}`}
                                    >
                                        <t.icon size={12} /> {t.label}
                                    </button>
                                ))}
                            </div>
                            {web3SubTab === 'wallet' && <WalletConnectPanel />}
                            {web3SubTab === 'contracts' && <SmartContractGenerator />}
                            {web3SubTab === 'ledger' && <BlockchainLedger />}
                            {web3SubTab === 'gated' && <TokenGatedPreview />}
                        </div>
                    )}
                </div>
            </div>

            {/* Modals */}
            <StorefrontPreviewModal
                isOpen={storefrontOpen}
                onClose={() => setStorefrontOpen(false)}
                products={products}
                artistName={userProfile?.displayName || 'Artist'}
            />
            <DropCampaignWizard
                isOpen={dropWizardOpen}
                onClose={() => setDropWizardOpen(false)}
                products={products}
            />

            {/* ── RIGHT PANEL — Templates & Analytics ─────────────── */}
            <aside className="hidden lg:flex w-72 2xl:w-80 flex-col border-l border-white/5 overflow-y-auto p-3 gap-3 flex-shrink-0">
                <DesignTemplatesPanel />
                <PODPartnerStatusPanel />
                <ConversionFunnelPanel stats={stats} />
                <CampaignReadyPanel products={products} />
            </aside>
        </div>
    );
}

/* ================================================================== */
/*  Stats Card                                                          */
/* ================================================================== */

function StatsCard({ title, value, change, icon }: { title: string; value: string; change: string; icon: React.ReactNode }) {
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
    );
}

/* ================================================================== */
/*  Left Panel Widgets                                                  */
/* ================================================================== */

function StoreStatsWidget({ stats }: { stats: MerchStats }) {
    const items = [
        { label: 'Revenue', value: formatCurrency(stats.totalRevenue), color: 'text-[#FFE135]' },
        { label: 'Units Sold', value: stats.unitsSold.toString(), color: 'text-green-400' },
        { label: 'Conversion', value: `${stats.conversionRate ?? 0}%`, color: 'text-purple-400' },
    ];

    return (
        <div className="rounded-xl bg-white/[0.02] border border-white/5 p-3">
            <h3 className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-3 px-1">Store Stats</h3>
            <div className="space-y-2">
                {items.map((s) => (
                    <div key={s.label} className="flex items-center justify-between p-2 rounded-lg bg-white/[0.02]">
                        <span className="text-[11px] text-neutral-400">{s.label}</span>
                        <span className={`text-xs font-bold ${s.color}`}>{s.value}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}

function TrendingProductsWidget({ topSellingProducts }: { topSellingProducts: Array<{ id: string; title?: string; revenue: number }> }) {
    return (
        <div className="rounded-xl bg-white/[0.02] border border-white/5 p-3">
            <h3 className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-3 px-1 flex items-center gap-1.5">
                <TrendingUp size={10} /> Top Sellers
            </h3>
            <div className="space-y-1">
                {topSellingProducts.slice(0, 3).map((p, i) => (
                    <div key={p.id} className="flex items-center gap-2 py-2 px-2 rounded-lg hover:bg-white/[0.04] transition-colors">
                        <span className="text-[10px] font-bold text-[#FFE135] w-4">#{i + 1}</span>
                        <div className="flex-1 min-w-0">
                            <p className="text-xs text-neutral-300 truncate">{p.title || 'Untitled'}</p>
                            <p className="text-[10px] text-neutral-600">{formatCurrency(p.revenue)}</p>
                        </div>
                    </div>
                ))}
                {topSellingProducts.length === 0 && (
                    <p className="text-[11px] text-neutral-600 px-2">No sales data yet</p>
                )}
            </div>
        </div>
    );
}

function NewDesignsWidget({ products, onDesignClick }: { products: Array<{ id: string; title?: string; category?: string }>; onDesignClick: () => void }) {
    const pending = products.filter(p => p.category === 'standard');
    return (
        <div className="rounded-xl bg-[#FFE135]/5 border border-[#FFE135]/10 p-3">
            <h3 className="text-[10px] font-bold text-[#FFE135] uppercase tracking-widest mb-3 px-1 flex items-center gap-1.5">
                <Sparkles size={10} /> New Designs
            </h3>
            <p className="text-[11px] text-neutral-400 px-1 mb-2">
                {pending.length > 0 ? `${pending.length} designs awaiting review` : 'All designs approved'}
            </p>
            <button
                onClick={onDesignClick}
                className="w-full text-xs font-bold text-[#FFE135] py-1.5 rounded-lg bg-[#FFE135]/10 hover:bg-[#FFE135]/20 transition-colors"
            >
                + Create Design
            </button>
        </div>
    );
}

/* ================================================================== */
/*  Right Panel Widgets                                                 */
/* ================================================================== */

function DesignTemplatesPanel() {
    // Templates should be loaded from user's saved design templates in Firestore
    // Empty state shown until connected
    return (
        <div className="rounded-xl bg-white/[0.02] border border-white/5 p-3">
            <h3 className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-3 px-1">Design Templates</h3>
            <div className="flex flex-col items-center justify-center py-4 text-center">
                <Palette size={16} className="text-neutral-600 mb-2" />
                <p className="text-[11px] text-neutral-600">No templates yet</p>
                <p className="text-[10px] text-neutral-700 mt-0.5">Create a design to save as a template</p>
            </div>
        </div>
    );
}

function PODPartnerStatusPanel() {
    // POD partner status should be fetched from the POD integration service
    // Empty state shown until API keys are configured
    return (
        <div className="rounded-xl bg-white/[0.02] border border-white/5 p-3">
            <h3 className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-3 px-1 flex items-center gap-1.5">
                <Truck size={10} /> POD Partners
            </h3>
            <div className="flex flex-col items-center justify-center py-4 text-center">
                <Truck size={16} className="text-neutral-600 mb-2" />
                <p className="text-[11px] text-neutral-600">No partners connected</p>
                <p className="text-[10px] text-neutral-700 mt-0.5">Connect Printful, Printify, or Gooten in POD Partners tab</p>
            </div>
        </div>
    );
}

function ConversionFunnelPanel({ stats }: { stats: MerchStats }) {
    const stages = [
        { label: 'Page Views', value: stats.funnelData.pageViews.toLocaleString(), pct: 100 },
        { label: 'Add to Cart', value: stats.funnelData.addToCart.toLocaleString(), pct: stats.funnelData.pageViews > 0 ? (stats.funnelData.addToCart / stats.funnelData.pageViews) * 100 : 0 },
        { label: 'Checkout', value: stats.funnelData.checkout.toLocaleString(), pct: stats.funnelData.pageViews > 0 ? (stats.funnelData.checkout / stats.funnelData.pageViews) * 100 : 0 },
        { label: 'Purchased', value: stats.unitsSold.toLocaleString(), pct: stats.conversionRate ?? 0 },
    ];

    return (
        <div className="rounded-xl bg-white/[0.02] border border-white/5 p-3">
            <h3 className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-3 px-1 flex items-center gap-1.5">
                <BarChart3 size={10} /> Conversion Funnel
            </h3>
            <div className="space-y-2">
                {stages.map((s) => (
                    <div key={s.label} className="px-1">
                        <div className="flex items-center justify-between mb-1">
                            <span className="text-[10px] text-neutral-400">{s.label}</span>
                            <span className="text-[10px] font-bold text-neutral-300">{s.value}</span>
                        </div>
                        <div className="w-full bg-white/5 rounded-full h-1.5">
                            <div
                                className="bg-[#FFE135] h-1.5 rounded-full transition-all"
                                style={{ width: `${s.pct}%` }}
                            />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

function CampaignReadyPanel({ products }: { products: Array<{ id: string }> }) {
    return (
        <div className="rounded-xl bg-gradient-to-br from-[#FFE135]/10 to-transparent border border-[#FFE135]/20 p-3">
            <h3 className="text-[10px] font-bold text-[#FFE135] uppercase tracking-widest mb-2 px-1">Campaign Ready</h3>
            <p className="text-[11px] text-neutral-400 px-1 mb-3">
                {products.length} approved designs ready for production.
            </p>
            <button className="w-full text-xs font-bold text-[#FFE135] py-2 rounded-lg bg-[#FFE135]/10 hover:bg-[#FFE135]/20 transition-colors flex items-center justify-center gap-1.5">
                <Plus size={12} />
                Launch Campaign
            </button>
        </div>
    );
}
