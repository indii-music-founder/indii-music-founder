import React, { useCallback, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { MerchCard } from './components/MerchCard';
import { MerchButton } from './components/MerchButton';
import {
    TrendingUp, ShoppingBag, DollarSign, Plus, Loader2,
    LayoutGrid, PenTool, Package, Settings, LogOut,
    Palette, Truck, BarChart3, Sparkles,
    Flame, Globe, Wallet, Shield, Lock, type LucideIcon
} from 'lucide-react';

import { useMerchandise, MerchStats } from './hooks/useMerchandise';
import type { MerchProduct } from './types';
import { useStore } from '@/core/store';
import { useShallow } from 'zustand/react/shallow';
import { TopSellingProductItem } from './components/TopSellingProductItem';
import { formatCurrency } from '@/lib/utils';
import { PODIntegrationPanel } from './components/PODIntegrationPanel';
import { AdaptiveWorkspace } from '@/components/layout/AdaptiveWorkspace';
import { useAdaptiveWorkspace } from '@/components/layout/AdaptiveWorkspaceContext';

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
    const { userProfile } = useStore(useShallow(state => ({ userProfile: state.userProfile })));
    const { stats, topSellingProducts, products, loading, error } = useMerchandise();
    const [centerTab, setCenterTab] = useState<CenterTab>('dashboard');
    const [web3SubTab, setWeb3SubTab] = useState<Web3SubTab>('wallet');
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
        <>
            <AdaptiveWorkspace
                className="bg-[#050505] text-white font-sans"
                leftRail={<MerchLeftRail stats={stats} topSellingProducts={topSellingProducts} products={products} onDesignClick={handleDesignClick} onExit={() => navigate('/dashboard')} />}
                rightRail={<MerchRightRail stats={stats} products={products} />}
                leftRailLabel="Merchandise navigation"
                rightRailLabel="Merchandise analytics"
            >
                <MerchWorkspaceCenter
                    centerTab={centerTab}
                    setCenterTab={setCenterTab}
                    web3SubTab={web3SubTab}
                    setWeb3SubTab={setWeb3SubTab}
                    stats={stats}
                    products={products}
                    topSellingProducts={topSellingProducts}
                    displayName={userProfile?.displayName}
                    onDesignClick={handleDesignClick}
                    onCreateDrop={() => setDropWizardOpen(true)}
                />
            </AdaptiveWorkspace>

            <DropCampaignWizard isOpen={dropWizardOpen} onClose={() => setDropWizardOpen(false)} products={products} />
        </>
    );
}

type TopSellingProduct = MerchProduct & { revenue: number; units: number };

function MerchLeftRail({
    stats,
    topSellingProducts,
    products,
    onDesignClick,
    onExit,
}: {
    stats: MerchStats;
    topSellingProducts: TopSellingProduct[];
    products: MerchProduct[];
    onDesignClick: () => void;
    onExit: () => void;
}) {
    return (
        <div className="flex h-full min-h-0 flex-col bg-black/50 backdrop-blur-xl">
            <div className="flex items-center gap-3 p-5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#FFE135] shadow-[0_0_15px_rgba(255,225,53,0.3)]">
                    <span className="text-lg font-black text-black">M</span>
                </div>
                <div>
                    <h1 className="text-lg font-bold leading-none tracking-tight">Merch<span className="text-[#FFE135]">Pro</span></h1>
                    <span className="font-mono text-[10px] uppercase tracking-widest text-neutral-500">Merch OS</span>
                </div>
            </div>

            <nav className="space-y-1 px-1 py-2">
                <MerchNavItem to="/merch" icon={<LayoutGrid size={18} />} exact>Dashboard</MerchNavItem>
                <MerchNavItem to="/merch/design" icon={<PenTool size={18} />}>Designer</MerchNavItem>
                <MerchNavItem to="/merch/catalog" icon={<Package size={18} />}>Catalog</MerchNavItem>
                <div className="px-2 py-3"><div className="h-px bg-white/5" /></div>
                <MerchNavItem to="/merch/settings" icon={<Settings size={18} />}>Settings</MerchNavItem>
            </nav>

            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-1 py-3">
                <StoreStatsWidget stats={stats} />
                <TrendingProductsWidget topSellingProducts={topSellingProducts} />
                <NewDesignsWidget products={products} onDesignClick={onDesignClick} />
            </div>

            <div className="border-t border-white/5 p-1 pt-3">
                <button onClick={onExit} className="group flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-neutral-500 transition-colors hover:bg-white/5 hover:text-white">
                    <LogOut size={18} className="transition-colors group-hover:text-red-400" />
                    <span>Exit Studio</span>
                </button>
            </div>
        </div>
    );
}

function MerchRightRail({ stats, products }: { stats: MerchStats; products: MerchProduct[] }) {
    return (
        <div className="space-y-3">
            <DesignTemplatesPanel />
            <PODPartnerStatusPanel />
            <ConversionFunnelPanel stats={stats} />
            <CampaignReadyPanel products={products} />
        </div>
    );
}

function MerchWorkspaceCenter({
    centerTab,
    setCenterTab,
    web3SubTab,
    setWeb3SubTab,
    stats,
    products,
    topSellingProducts,
    displayName,
    onDesignClick,
    onCreateDrop,
}: {
    centerTab: CenterTab;
    setCenterTab: React.Dispatch<React.SetStateAction<CenterTab>>;
    web3SubTab: Web3SubTab;
    setWeb3SubTab: React.Dispatch<React.SetStateAction<Web3SubTab>>;
    stats: MerchStats;
    products: MerchProduct[];
    topSellingProducts: TopSellingProduct[];
    displayName?: string;
    onDesignClick: () => void;
    onCreateDrop: () => void;
}) {
    const { mode } = useAdaptiveWorkspace();
    const isFocused = mode === 'focused';
    const isWide = mode === 'wide';
    const contentPadding = isFocused ? 'p-4 pt-16' : mode === 'standard' ? 'p-6' : 'p-8';
    const statGrid = isWide ? 'grid-cols-3' : mode === 'standard' ? 'grid-cols-2' : 'grid-cols-1';
    const productGrid = isWide ? 'grid-cols-3' : mode === 'standard' ? 'grid-cols-2' : 'grid-cols-1';

    return (
        <div className="relative flex min-w-0 flex-1 flex-col overflow-hidden">
            <div className="pointer-events-none absolute left-[-10%] top-[-20%] h-[500px] w-[500px] rounded-full bg-[#FFE135]/5 blur-[120px]" />
            <div className="pointer-events-none absolute bottom-[-20%] right-[-10%] h-[500px] w-[500px] rounded-full bg-lime-400/5 blur-[120px]" />

            <div className="relative z-10 flex min-w-0 items-center gap-1 overflow-x-auto border-b border-white/5 px-4 pb-0 pt-4 scrollbar-hide">
                {([
                    { id: 'dashboard', label: 'Dashboard', icon: LayoutGrid },
                    { id: 'inventory', label: 'Inventory', icon: Package },
                    { id: 'pricing', label: 'Pricing', icon: TrendingUp },
                    { id: 'pod', label: 'POD Partners', icon: Truck },
                    { id: 'web3', label: 'Web3', icon: Shield },
                ] as { id: CenterTab; label: string; icon: LucideIcon }[]).map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setCenterTab(tab.id)}
                        className={`flex shrink-0 items-center gap-2 border-b-2 px-3 py-2.5 text-xs font-bold transition-all ${centerTab === tab.id
                            ? 'border-[#FFE135] text-[#FFE135]'
                            : 'border-transparent text-neutral-500 hover:border-white/20 hover:text-neutral-300'
                            }`}
                    >
                        <tab.icon size={13} /> {tab.label}
                    </button>
                ))}
                <button onClick={onCreateDrop} className="ml-auto flex shrink-0 items-center gap-1.5 rounded-lg border border-[#FFE135]/20 bg-[#FFE135]/10 px-3 py-1.5 text-[11px] font-bold text-[#FFE135] transition-all hover:bg-[#FFE135]/20">
                    <Flame size={11} /> Create Drop
                </button>
            </div>

            <div className="relative z-10 flex-1 overflow-y-auto" data-testid="merch-dashboard-content">
                {centerTab === 'dashboard' && (
                    <div className={contentPadding}>
                        <div className={`mb-6 flex gap-4 ${isFocused ? 'flex-col items-start' : 'items-center justify-between'}`}>
                            <div>
                                <h2 className={`${isFocused ? 'text-2xl' : 'text-3xl'} mb-1 font-bold text-white`}>Morning, {displayName?.split(' ')[0] || 'Chief'}</h2>
                                <p className="text-neutral-400">Your merchandise empire is thriving.</p>
                            </div>
                            <MerchButton onClick={onDesignClick} glow size="lg" className="rounded-full" data-testid="new-design-btn">
                                <Plus size={18} /> New Design
                            </MerchButton>
                        </div>

                        <div className={`mb-6 grid gap-4 ${statGrid}`}>
                            <StatsCard compact={isFocused} title="Total Revenue" value={formatCurrency(stats.totalRevenue)} change={`${stats.revenueChange > 0 ? '+' : ''}${stats.revenueChange.toFixed(1)}%`} icon={<DollarSign className="text-[#FFE135]" />} />
                            <StatsCard compact={isFocused} title="Units Sold" value={stats.unitsSold.toString()} change={`${stats.unitsChange > 0 ? '+' : ''}${stats.unitsChange.toFixed(1)}%`} icon={<ShoppingBag className="text-[#FFE135]" />} />
                            <StatsCard compact={isFocused} title="Conversion Rate" value={`${stats.conversionRate ?? 0}%`} change={stats.conversionRate != null ? `${stats.conversionRate > 0 ? '+' : ''}${stats.conversionRate}%` : '--'} icon={<TrendingUp className="text-[#FFE135]" />} />
                        </div>

                        <div className={`mb-6 grid gap-4 ${isFocused ? 'grid-cols-1' : 'grid-cols-2'}`}>
                            <MerchCard className={`${isFocused ? 'p-4' : 'p-6'} relative overflow-hidden`}>
                                <div className="absolute right-0 top-0 p-4 opacity-10"><span className="text-6xl">📈</span></div>
                                <div className="relative z-10">
                                    <h3 className="mb-2 text-lg font-bold text-white" data-testid="trend-score-title">Trend Score</h3>
                                    <div className="mb-2 flex items-end gap-2"><span className={`${isFocused ? 'text-3xl' : 'text-4xl'} font-black text-[#FFE135]`}>{stats.trendScore}</span><span className="mb-1 text-sm text-neutral-400">/ 100</span></div>
                                    <div className="mb-2 h-2 w-full rounded-full bg-white/10"><div className="h-2 rounded-full bg-[#FFE135] transition-all duration-500" style={{ width: `${stats.trendScore}%` }} /></div>
                                    <p className="text-xs text-neutral-500">{stats.trendScore > 80 ? 'Trending fresh. 2 new viral signals detected.' : stats.trendScore > 0 ? 'Design engagement is steady.' : 'No trend data available yet.'}</p>
                                </div>
                            </MerchCard>
                            <MerchCard className={`${isFocused ? 'p-4' : 'p-6'} relative overflow-hidden`}>
                                <div className="absolute right-0 top-0 p-4 opacity-10"><span className="text-6xl">⚡️</span></div>
                                <div className="relative z-10">
                                    <h3 className="mb-2 text-lg font-bold text-white" data-testid="production-performance-title">Production Velocity</h3>
                                    <div className="mb-2 flex items-end gap-2"><span className={`${isFocused ? 'text-3xl' : 'text-4xl'} font-black ${stats.productionVelocity >= 0 ? 'text-green-400' : 'text-red-400'}`}>{stats.productionVelocity > 0 ? `+${stats.productionVelocity}%` : `${stats.productionVelocity}%`}</span><span className="mb-1 text-sm text-neutral-400">vs last week</span></div>
                                    <div className="mb-2 flex h-2 gap-1"><div className="flex-1 overflow-hidden rounded-full bg-white/10"><div className={`h-full ${stats.productionVelocity >= 0 ? 'bg-green-500' : 'bg-red-500'} transition-all duration-500`} style={{ width: `${Math.min(Math.abs(stats.productionVelocity), 100)}%` }} /></div></div>
                                    <p className="text-xs text-neutral-500">{stats.productionVelocity > 0 ? 'Efficiency up. Global logistics optimal.' : stats.productionVelocity < 0 ? 'Throughput decreased this week.' : 'Production pace is stable.'}</p>
                                </div>
                            </MerchCard>
                        </div>

                        <div className="mb-8">
                            <h3 className="mb-4 text-xl font-bold text-white">Top Performing Products</h3>
                            <div className={`grid gap-4 ${productGrid}`}>
                                {topSellingProducts.length > 0 ? topSellingProducts.map(product => <TopSellingProductItem key={product.id} product={product} />) : (
                                    <div className="col-span-full rounded-lg border border-dashed border-white/10 p-8 text-center"><p className="mb-4 text-neutral-500">No sales yet. Time to market!</p><MerchButton size="sm" variant="outline" onClick={onDesignClick}>Start Selling</MerchButton></div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
                {centerTab === 'inventory' && <InventoryTracker />}
                {centerTab === 'pricing' && <PricingEngine products={products} />}
                {centerTab === 'pod' && <PODIntegrationPanel />}
                {centerTab === 'web3' && (
                    <div className={isFocused ? 'p-4 pt-16' : 'p-6'}>
                        <div className="mb-6 flex min-w-max items-center gap-1 overflow-x-auto rounded-xl bg-white/5 p-1">
                            {([
                                { id: 'wallet', label: 'Wallet', icon: Wallet },
                                { id: 'contracts', label: 'Smart Contracts', icon: Shield },
                                { id: 'ledger', label: 'Ledger', icon: Globe },
                                { id: 'gated', label: 'Gated Previews', icon: Lock },
                            ] as { id: Web3SubTab; label: string; icon: LucideIcon }[]).map(tab => (
                                <button key={tab.id} onClick={() => setWeb3SubTab(tab.id)} className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-bold transition-all ${web3SubTab === tab.id ? 'bg-[#FFE135] text-black' : 'text-neutral-400 hover:text-white'}`}><tab.icon size={12} /> {tab.label}</button>
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
    );
}

/* ================================================================== */
/*  Stats Card                                                          */
/* ================================================================== */

function StatsCard({ title, value, change, icon, compact = false }: { title: string; value: string; change: string; icon: React.ReactNode; compact?: boolean }) {
    return (
        <MerchCard className={compact ? 'p-4' : 'p-6'}>
            <div className={compact ? 'mb-3 flex items-start justify-between' : 'mb-4 flex items-start justify-between'}>
                <div className="w-10 h-10 rounded-full bg-[#FFE135]/10 flex items-center justify-center border border-[#FFE135]/20">
                    {icon}
                </div>
                <span className="text-xs font-mono text-[#CCFF00] bg-[#CCFF00]/10 px-2 py-1 rounded">{change}</span>
            </div>
            <div className="space-y-1">
                <p className="text-sm text-neutral-500 uppercase tracking-widest">{title}</p>
                <h3 className={`${compact ? 'text-2xl' : 'text-3xl'} font-black text-white`}>{value}</h3>
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
        { label: 'Conversion', value: `${stats.conversionRate ?? 0}%`, color: 'text-green-400' },
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
        { label: 'Page Views', value: stats.funnelData.pageViews.toLocaleString('en-US'), pct: 100 },
        { label: 'Add to Cart', value: stats.funnelData.addToCart.toLocaleString('en-US'), pct: stats.funnelData.pageViews > 0 ? (stats.funnelData.addToCart / stats.funnelData.pageViews) * 100 : 0 },
        { label: 'Checkout', value: stats.funnelData.checkout.toLocaleString('en-US'), pct: stats.funnelData.pageViews > 0 ? (stats.funnelData.checkout / stats.funnelData.pageViews) * 100 : 0 },
        { label: 'Purchased', value: stats.unitsSold.toLocaleString('en-US'), pct: stats.conversionRate ?? 0 },
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
        <div className="rounded-xl bg-linear-to-br from-[#FFE135]/10 to-transparent border border-[#FFE135]/20 p-3">
            <h3 className="text-[10px] font-bold text-[#FFE135] uppercase tracking-widest mb-2 px-1">Campaign Ready</h3>
            <p className="text-[11px] text-neutral-400 px-1 mb-3">
                {products.length} approved designs ready for production.
            </p>
        </div>
    );
}
