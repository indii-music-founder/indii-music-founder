import React, { useEffect } from 'react';
import { DistributorConnectionsPanel } from './components/DistributorConnectionsPanel';
import { ReleaseStatusCard } from './components/ReleaseStatusCard';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useStore } from '@/core/store';
import { ReleaseStatus } from '@/services/distribution/types/distributor';
import { BankPanel } from './components/BankPanel';
import { AuthorityPanel } from './components/AuthorityPanel';
import { QCPanel } from './components/QCPanel';
import { KeysPanel } from './components/KeysPanel';
import { TransferPanel } from './components/TransferPanel';
import { motion } from 'motion/react';
import {
    Radio, CheckCircle2, XCircle, AlertTriangle,
    Wifi, WifiOff, Key, Shield, Brain, Send,
    Activity, Gauge, Link2, Zap
} from 'lucide-react';

/* ================================================================== */
/*  Distribution Dashboard — Three-Panel Layout                        */
/*                                                                     */
/*  ┌──────────┬───────────────────────────┬──────────────┐            */
/*  │  LEFT    │    CENTER                 │   RIGHT      │            */
/*  │  Distrib │    Tab Content            │   QC Status  │            */
/*  │  Status  │    (Releases/Bank/Auth/   │   Keys       │            */
/*  │  Health  │     Keys/Brain/Transfer)  │   Authority  │            */
/*  │  Links   │                           │              │            */
/*  └──────────┴───────────────────────────┴──────────────┘            */
/* ================================================================== */

export default function DistributionDashboard() {
    const { distribution, subscribeToReleases } = useStore();
    const { releases, loading, error } = distribution;

    useEffect(() => {
        const unsubscribe = subscribeToReleases();
        return () => unsubscribe();
    }, [subscribeToReleases]);

    return (
        <div className="absolute inset-0 flex">
            {/* ── LEFT PANEL — Distributor Status & Health ────────── */}
            <aside className="hidden lg:flex w-64 xl:w-72 2xl:w-80 flex-col border-r border-white/5 overflow-y-auto p-3 gap-3 flex-shrink-0">
                <DistributorQuickView />
                <DeliveryHealthPanel releases={releases} />
                <QuickLinksPanel />
            </aside>

            {/* ── CENTER — Tabbed Content ─────────────────────────── */}
            <div className="flex-1 flex flex-col min-w-0">
                {/* Header */}
                <div className="px-4 md:px-6 py-4 border-b border-white/5 flex-shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-dept-publishing to-purple-600 flex items-center justify-center shadow-lg shadow-dept-publishing/20">
                            <Radio size={18} className="text-white" />
                        </div>
                        <div className="flex-1">
                            <div className="flex items-center gap-2">
                                <h1 className="text-2xl font-black text-white tracking-tighter uppercase">Distribution</h1>
                                <div className="flex items-center gap-1.5 px-2 py-0.5 bg-dept-publishing/10 border border-dept-publishing/20 rounded-full">
                                    <div className="w-1.5 h-1.5 rounded-full bg-dept-publishing animate-pulse" />
                                    <span className="text-[10px] font-bold text-dept-publishing tracking-widest uppercase">Live</span>
                                </div>
                            </div>
                            <p className="text-[10px] text-gray-500 font-medium">150+ PLATFORMS • ONE-CLICK DELIVERY</p>
                        </div>
                    </div>
                </div>

                {/* Tabs */}
                <Tabs defaultValue="releases" className="flex-1 flex flex-col overflow-hidden">
                    <div className="px-4 md:px-6 border-b border-white/5 flex-shrink-0 overflow-x-auto scrollbar-hide">
                        <TabsList className="bg-transparent gap-4 p-0 h-11 inline-flex">
                            {[
                                { value: 'releases', label: 'Releases' },
                                { value: 'connections', label: 'Distributors' },
                                { value: 'bank', label: 'Bank' },
                                { value: 'authority', label: 'Authority' },
                                { value: 'keys', label: 'Keys' },
                                { value: 'brain', label: 'Brain (QC)' },
                                { value: 'transmission', label: 'Transfer' },
                            ].map((tab) => (
                                <TabsTrigger
                                    key={tab.value}
                                    value={tab.value}
                                    className="text-muted-foreground data-[state=active]:text-dept-publishing data-[state=active]:bg-transparent border-b-2 border-transparent data-[state=active]:border-dept-publishing rounded-none px-0 h-full font-bold transition-all text-xs whitespace-nowrap"
                                >
                                    {tab.label}
                                </TabsTrigger>
                            ))}
                        </TabsList>
                    </div>

                    <div className="flex-1 overflow-y-auto custom-scrollbar">
                        <div className="p-4 md:p-6">
                            <TabsContent value="releases" className="mt-0 border-none outline-none">
                                <ReleasesContent releases={releases} loading={loading} error={error} subscribeToReleases={subscribeToReleases} />
                            </TabsContent>
                            <TabsContent value="connections" className="mt-0 border-none outline-none">
                                <DistributorConnectionsPanel />
                            </TabsContent>
                            <TabsContent value="bank" className="mt-0 border-none outline-none">
                                <BankPanel />
                            </TabsContent>
                            <TabsContent value="authority" className="mt-0 border-none outline-none">
                                <AuthorityPanel />
                            </TabsContent>
                            <TabsContent value="keys" className="mt-0 border-none outline-none">
                                <KeysPanel />
                            </TabsContent>
                            <TabsContent value="brain" className="mt-0 border-none outline-none">
                                <QCPanel />
                            </TabsContent>
                            <TabsContent value="transmission" className="mt-0 border-none outline-none">
                                <TransferPanel />
                            </TabsContent>
                        </div>
                    </div>
                </Tabs>
            </div>

            {/* ── RIGHT PANEL — QC, Keys & Authority ──────────────── */}
            <aside className="hidden lg:flex w-72 2xl:w-80 flex-col border-l border-white/5 overflow-y-auto p-3 gap-3 flex-shrink-0">
                <QCQuickPanel />
                <KeysStatusPanel />
                <AuthorityInfoPanel />
            </aside>
        </div>
    );
}

/* ================================================================== */
/*  Releases Content (extracted from original)                          */
/* ================================================================== */

function ReleasesContent({ releases, loading, error, subscribeToReleases }: {
    releases: any[];
    loading: boolean;
    error: string | null;
    subscribeToReleases: () => () => void;
}) {
    if (loading && releases.length === 0) {
        return (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="h-48 rounded-xl bg-white/[0.02] animate-pulse border border-white/5" />
                ))}
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-8 border border-red-900/50 rounded-xl bg-red-900/10 text-center">
                <p className="text-red-400 text-sm">{error}</p>
                <button
                    onClick={() => subscribeToReleases()}
                    className="mt-4 px-4 py-2 bg-red-900/20 hover:bg-red-900/30 text-red-400 rounded-lg transition-colors text-xs font-bold"
                >
                    Retry
                </button>
            </div>
        );
    }

    if (releases.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center p-16 border border-white/5 rounded-xl bg-white/[0.02] text-center">
                <Radio size={32} className="text-gray-600 mb-3" />
                <h3 className="text-lg font-bold text-white mb-1">No active releases</h3>
                <p className="text-gray-500 text-sm max-w-sm">
                    Your distributed music will appear here once you start the rollout process from Publishing.
                </p>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {releases.map((release) => (
                <ReleaseStatusCard
                    key={release.id}
                    releaseTitle={release.title}
                    artistName={release.artist}
                    coverArtUrl={release.coverArtUrl}
                    deployments={release.deployments}
                    releaseDate={release.releaseDate || new Date().toISOString()}
                />
            ))}
        </div>
    );
}

/* ================================================================== */
/*  Left Panel Widgets                                                  */
/* ================================================================== */

function DistributorQuickView() {
    const distributors = [
        { name: 'Spotify', connected: true },
        { name: 'Apple Music', connected: true },
        { name: 'Amazon', connected: true },
        { name: 'YouTube Music', connected: false },
        { name: 'Tidal', connected: false },
    ];

    return (
        <div className="rounded-xl bg-white/[0.02] border border-white/5 p-3">
            <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3 px-1">Distributors</h3>
            <div className="space-y-1.5">
                {distributors.map((d) => (
                    <div key={d.name} className="flex items-center gap-2.5 px-2 py-2 rounded-lg hover:bg-white/[0.02] transition-colors">
                        <div className={`w-6 h-6 rounded-md flex items-center justify-center ${d.connected ? 'bg-green-500/10' : 'bg-gray-800'}`}>
                            {d.connected ? <Wifi size={11} className="text-green-400" /> : <WifiOff size={11} className="text-gray-600" />}
                        </div>
                        <span className="text-xs text-gray-300 flex-1">{d.name}</span>
                        <div className={`w-1.5 h-1.5 rounded-full ${d.connected ? 'bg-green-500 shadow-[0_0_4px_rgba(34,197,94,0.5)]' : 'bg-gray-700'}`} />
                    </div>
                ))}
            </div>
        </div>
    );
}

function DeliveryHealthPanel({ releases }: { releases: any[] }) {
    const total = releases.length || 1;
    const live = releases.filter((r: any) => r.status === 'live' || r.deployments?.some((d: any) => d.status === 'live')).length;
    const rate = total > 0 ? Math.round((live / total) * 100) : 0;

    return (
        <div className="rounded-xl bg-white/[0.02] border border-white/5 p-3">
            <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3 px-1">Delivery Health</h3>
            <div className="p-3 rounded-lg bg-white/[0.02]">
                <div className="flex items-center gap-2 mb-2">
                    <Gauge size={14} className="text-green-400" />
                    <span className="text-xs font-bold text-white">{rate}% Success Rate</span>
                </div>
                <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
                    <motion.div
                        className="h-full bg-gradient-to-r from-green-500 to-emerald-400 rounded-full"
                        initial={{ width: 0 }}
                        animate={{ width: `${rate}%` }}
                        transition={{ duration: 1 }}
                    />
                </div>
                <div className="flex justify-between mt-2 text-[10px] text-gray-500">
                    <span>{live} delivered</span>
                    <span>{total - live} pending</span>
                </div>
            </div>
        </div>
    );
}

function QuickLinksPanel() {
    const links = [
        { label: 'Connect Distributor', icon: Link2 },
        { label: 'Test Delivery', icon: Zap },
        { label: 'View API Keys', icon: Key },
    ];

    return (
        <div className="rounded-xl bg-white/[0.02] border border-white/5 p-3">
            <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3 px-1">Quick Actions</h3>
            <div className="space-y-1.5">
                {links.map((l) => (
                    <button key={l.label} className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg bg-white/[0.02] hover:bg-white/[0.05] border border-white/5 hover:border-dept-publishing/20 transition-all text-xs text-gray-300 hover:text-white">
                        <l.icon size={13} className="text-dept-publishing" />
                        {l.label}
                    </button>
                ))}
            </div>
        </div>
    );
}

/* ================================================================== */
/*  Right Panel Widgets                                                 */
/* ================================================================== */

function QCQuickPanel() {
    return (
        <div className="rounded-xl bg-white/[0.02] border border-white/5 p-3">
            <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3 px-1">QC Status</h3>
            <div className="p-3 rounded-lg bg-green-500/5 border border-green-500/10">
                <div className="flex items-center gap-2 mb-1">
                    <Brain size={14} className="text-green-400" />
                    <span className="text-xs font-bold text-green-400">All Clear</span>
                </div>
                <p className="text-[10px] text-gray-500">Last scan: 2 hours ago</p>
                <div className="flex gap-2 mt-2">
                    <StatusLight label="Audio" ok />
                    <StatusLight label="Meta" ok />
                    <StatusLight label="Art" ok />
                </div>
            </div>
        </div>
    );
}

function StatusLight({ label, ok }: { label: string; ok: boolean }) {
    return (
        <div className="flex items-center gap-1">
            <div className={`w-1.5 h-1.5 rounded-full ${ok ? 'bg-green-500' : 'bg-red-500'}`} />
            <span className="text-[10px] text-gray-500">{label}</span>
        </div>
    );
}

function KeysStatusPanel() {
    const keys = [
        { label: 'Spotify API', status: 'Valid', exp: '180 days' },
        { label: 'Apple API', status: 'Valid', exp: '90 days' },
        { label: 'DDEX Cert', status: 'Expiring', exp: '15 days' },
    ];

    return (
        <div className="rounded-xl bg-white/[0.02] border border-white/5 p-3">
            <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3 px-1">Keys & Certs</h3>
            <div className="space-y-2">
                {keys.map((k) => (
                    <div key={k.label} className="flex items-center gap-2.5 p-2.5 rounded-lg bg-white/[0.02]">
                        <Key size={12} className={k.status === 'Expiring' ? 'text-amber-400' : 'text-green-400'} />
                        <div className="flex-1 min-w-0">
                            <p className="text-xs text-white truncate">{k.label}</p>
                            <p className="text-[10px] text-gray-600">Expires in {k.exp}</p>
                        </div>
                        <span className={`text-[10px] font-bold ${k.status === 'Expiring' ? 'text-amber-400' : 'text-green-400'}`}>
                            {k.status}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
}

function AuthorityInfoPanel() {
    return (
        <div className="rounded-xl bg-white/[0.02] border border-white/5 p-3">
            <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3 px-1">Authority</h3>
            <div className="space-y-2.5">
                <div className="flex items-center justify-between p-2.5 rounded-lg bg-white/[0.02]">
                    <div className="flex items-center gap-2">
                        <Shield size={12} className="text-blue-400" />
                        <span className="text-xs text-gray-300">Account Tier</span>
                    </div>
                    <span className="text-xs font-bold text-white">Professional</span>
                </div>
                <div className="flex items-center justify-between p-2.5 rounded-lg bg-white/[0.02]">
                    <div className="flex items-center gap-2">
                        <Activity size={12} className="text-purple-400" />
                        <span className="text-xs text-gray-300">API Calls</span>
                    </div>
                    <span className="text-xs font-bold text-white">2.4k / 10k</span>
                </div>
                <div className="flex items-center justify-between p-2.5 rounded-lg bg-white/[0.02]">
                    <div className="flex items-center gap-2">
                        <Send size={12} className="text-emerald-400" />
                        <span className="text-xs text-gray-300">Deliveries</span>
                    </div>
                    <span className="text-xs font-bold text-white">48 / Unlimited</span>
                </div>
            </div>
        </div>
    );
}
