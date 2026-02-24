import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
    Music,
    Plus,
    Search,
    Filter,
    MoreVertical,
    Share2,
    Archive,
    Edit2,
    Trash2,
    CheckCircle2,
    AlertCircle,
    BarChart3,
    Clock,
    CheckSquare,
    Square,
    Globe,
    DollarSign,
    Book,
    ExternalLink,
    Loader2,
    TrendingUp,
    Radio,
    FileText
} from 'lucide-react';
import { useStore } from '@/core/store';
import { useReleases } from './hooks/useReleases';
import { useAnalytics, usePayouts } from './hooks/useAnalytics';
import ReleaseWizard from './components/ReleaseWizard';
import { ModuleErrorBoundary } from '@/core/components/ModuleErrorBoundary';
import { useToast } from '@/core/context/ToastContext';
import { PublishingSkeleton } from './components/PublishingSkeleton';
import { ReleaseStatusCard } from './components/ReleaseStatusCard';
import { DistributorConnectionsPanel } from './components/DistributorConnectionsPanel';
import { EarningsDashboard } from './components/EarningsDashboard';
import { ReleaseListView } from './components/ReleaseListView';
import { ReleaseDetailPage } from './components/ReleaseDetailPage';
import { AnalyticsCharts } from './components/AnalyticsCharts';
import { PayoutHistory } from './components/PayoutHistory';
import { DSRUploadModal } from './components/DSRUploadModal';
import { ValidationRequirementsModal } from './components/ValidationRequirementsModal';
import { PublishingErrorBoundary } from './components/PublishingErrorBoundary';
import { OfflineBanner } from './components/OfflineBanner';
import { LayoutGrid, BarChart2, CreditCard, Upload } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { ReleaseAssets, DistributorId, ReleaseStatus } from '@/services/distribution/types/distributor';

/* ================================================================== */
/*  Publishing Dashboard — Three-Panel Layout                          */
/*                                                                     */
/*  ┌──────────┬───────────────────────────┬──────────────┐            */
/*  │  LEFT    │    CENTER                 │   RIGHT      │            */
/*  │  Stats   │    Tabs (Catalog/         │   Distributor │            */
/*  │  Active  │    Analytics/Finance)     │   Connections │            */
/*  │  Release │    + Release Detail       │   Earnings    │            */
/*  │  Actions │                           │   Revenue     │            */
/*  └──────────┴───────────────────────────┴──────────────┘            */
/* ================================================================== */

export default function PublishingDashboard() {
    const setModule = useStore(state => state.setModule);
    const { finance, distribution, fetchDistributors, fetchEarnings, currentOrganizationId } = useStore();
    const toast = useToast();

    // Core State
    const [isWizardOpen, setIsWizardOpen] = useState(false);
    const [selectedReleaseId, setSelectedReleaseId] = useState<string | null>(null);
    const [isDSRModalOpen, setIsDSRModalOpen] = useState(false);
    const [isValidationModalOpen, setIsValidationModalOpen] = useState(false);

    // Data Hooks
    const { releases, loading: releasesLoading } = useReleases(currentOrganizationId);

    // Analytics State
    const [selectedMetric, setSelectedMetric] = useState<'revenue' | 'streams'>('streams');

    // Default date range (last 30 days)
    const defaultDateRange = useMemo(() => {
        const now = Date.now();
        const endDate = new Date(now).toISOString().split('T')[0];
        const startDate = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        return { start: startDate, end: endDate };
    }, []);

    const { data: analyticsData, loading: analyticsLoading } = useAnalytics(defaultDateRange);
    const { payouts, loading: payoutsLoading } = usePayouts();

    useEffect(() => {
        if (currentOrganizationId) {
            fetchDistributors();
            fetchEarnings({ startDate: defaultDateRange.start, endDate: defaultDateRange.end });
        }
    }, [currentOrganizationId, fetchDistributors, fetchEarnings, defaultDateRange]);

    const selectedRelease = useMemo(() =>
        releases.find(r => r.id === selectedReleaseId),
        [releases, selectedReleaseId]);

    const stats = useMemo(() => {
        const total = releases.length;
        const live = releases.filter(r => r.status === 'live').length;
        const draft = releases.filter(r => r.status === 'draft').length;
        const pending = releases.filter(r => ['pending_review', 'metadata_complete', 'assets_uploaded'].includes(r.status)).length;
        return { total, live, draft, pending };
    }, [releases]);

    if (releasesLoading) {
        return <PublishingSkeleton />;
    }

    return (
        <ModuleErrorBoundary moduleName="Publishing Dashboard">
            <OfflineBanner />
            <div className="absolute inset-0 flex">
                {/* ── LEFT PANEL — Stats & Quick Actions ────────────── */}
                <aside className="hidden lg:flex w-64 xl:w-72 2xl:w-80 flex-col border-r border-white/5 overflow-y-auto p-3 gap-3 flex-shrink-0">
                    <ReleaseStatsPanel stats={stats} earnings={finance.earningsSummary?.totalNetRevenue} />
                    <ActiveReleasePanel releases={releases} onSelect={setSelectedReleaseId} />
                    <PendingActionsPanel
                        pendingCount={stats.pending}
                        draftCount={stats.draft}
                        onNewRelease={() => setIsWizardOpen(true)}
                        onImportDSR={() => setIsDSRModalOpen(true)}
                    />
                </aside>

                {/* ── CENTER — Main Content ──────────────────────────── */}
                <div className="flex-1 flex flex-col min-w-0">
                    {/* Header */}
                    <div className="px-4 md:px-6 py-4 border-b border-white/5 flex-shrink-0 relative overflow-hidden">
                        <div className="absolute top-[-80px] left-[-80px] w-[300px] h-[300px] bg-blue-500/8 blur-[100px] pointer-events-none rounded-full" />
                        <div className="relative z-10 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-blue-400 flex items-center justify-center shadow-lg shadow-blue-500/20">
                                    <Book size={18} className="text-white" />
                                </div>
                                <div>
                                    <h1 className="text-2xl font-black text-white tracking-tighter uppercase">Publishing</h1>
                                    <p className="text-muted-foreground font-medium tracking-wide text-[10px]">RIGHTS · DISTRIBUTION · ROYALTIES</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setIsWizardOpen(true)}
                                className="group flex items-center gap-2 px-4 py-2 bg-white text-black rounded-lg hover:bg-gray-200 transition-all font-bold text-xs active:scale-[0.98]"
                            >
                                <Plus size={14} className="transition-transform group-hover:rotate-90" />
                                New Release
                            </button>
                        </div>
                    </div>

                    {/* Content */}
                    <div className="flex-1 overflow-y-auto custom-scrollbar">
                        <AnimatePresence mode="wait">
                            {selectedReleaseId && selectedRelease ? (
                                <motion.div
                                    key="detail"
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -20 }}
                                    className="p-4 md:p-6"
                                >
                                    <ReleaseDetailPage
                                        releaseId={selectedReleaseId}
                                        metadata={selectedRelease.metadata}
                                        assets={{
                                            audioFiles: [{
                                                url: selectedRelease.assets.audioUrl,
                                                format: selectedRelease.assets.audioFormat,
                                                sampleRate: selectedRelease.assets.audioSampleRate,
                                                bitDepth: selectedRelease.assets.audioBitDepth,
                                                mimeType: `audio/${selectedRelease.assets.audioFormat}`,
                                                sizeBytes: 0,
                                            }],
                                            coverArt: {
                                                url: selectedRelease.assets.coverArtUrl,
                                                width: selectedRelease.assets.coverArtWidth,
                                                height: selectedRelease.assets.coverArtHeight,
                                                mimeType: 'image/jpeg',
                                                sizeBytes: 0
                                            }
                                        }}
                                        deployments={selectedRelease.distributors?.map(d => ({
                                            distributorId: d.distributorId as DistributorId,
                                            status: d.status as ReleaseStatus,
                                            distributorReleaseId: d.releaseId,
                                        })) || []}
                                        onBack={() => setSelectedReleaseId(null)}
                                        onEdit={() => {
                                            setSelectedReleaseId(null);
                                            setIsWizardOpen(true);
                                            toast.info('Release editing will open in wizard mode');
                                        }}
                                    />
                                </motion.div>
                            ) : (
                                <motion.div
                                    key="tabs"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                >
                                    <Tabs defaultValue="catalog" className="flex-1 flex flex-col">
                                        <div className="px-4 md:px-6 border-b border-white/5 flex-shrink-0">
                                            <TabsList className="bg-transparent gap-6 p-0 h-12">
                                                <TabsTrigger
                                                    value="catalog"
                                                    className="text-muted-foreground data-[state=active]:text-blue-400 data-[state=active]:bg-transparent border-b-2 border-transparent data-[state=active]:border-blue-400 rounded-none px-0 h-full font-bold transition-all flex items-center gap-2 text-xs"
                                                >
                                                    <LayoutGrid size={14} />
                                                    Catalog
                                                </TabsTrigger>
                                                <TabsTrigger
                                                    value="analytics"
                                                    className="text-muted-foreground data-[state=active]:text-blue-400 data-[state=active]:bg-transparent border-b-2 border-transparent data-[state=active]:border-blue-400 rounded-none px-0 h-full font-bold transition-all flex items-center gap-2 text-xs"
                                                >
                                                    <BarChart2 size={14} />
                                                    Insights
                                                </TabsTrigger>
                                                <TabsTrigger
                                                    value="finance"
                                                    className="text-muted-foreground data-[state=active]:text-blue-400 data-[state=active]:bg-transparent border-b-2 border-transparent data-[state=active]:border-blue-400 rounded-none px-0 h-full font-bold transition-all flex items-center gap-2 text-xs"
                                                >
                                                    <CreditCard size={14} />
                                                    Royalties
                                                </TabsTrigger>
                                            </TabsList>
                                        </div>

                                        <div className="p-4 md:p-6">
                                            <TabsContent value="catalog" className="mt-0 outline-none">
                                                <PublishingErrorBoundary componentName="Release List">
                                                    <ReleaseListView
                                                        onNewRelease={() => setIsWizardOpen(true)}
                                                        onReleaseClick={(id) => setSelectedReleaseId(id)}
                                                    />
                                                </PublishingErrorBoundary>
                                            </TabsContent>
                                            <TabsContent value="analytics" className="mt-0 outline-none">
                                                <PublishingErrorBoundary componentName="Analytics Charts">
                                                    <AnalyticsCharts
                                                        data={analyticsData}
                                                        selectedMetric={selectedMetric}
                                                        onMetricChange={setSelectedMetric}
                                                        dateRange={defaultDateRange}
                                                        loading={analyticsLoading}
                                                    />
                                                </PublishingErrorBoundary>
                                            </TabsContent>
                                            <TabsContent value="finance" className="mt-0 outline-none space-y-6">
                                                <div className="flex items-center justify-between p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl">
                                                    <div>
                                                        <h4 className="text-sm font-black text-white uppercase tracking-widest">Missing Sales Data?</h4>
                                                        <p className="text-xs text-gray-500 font-medium">Import reports from DSPs to sync your balance.</p>
                                                    </div>
                                                    <button
                                                        onClick={() => setIsDSRModalOpen(true)}
                                                        className="flex items-center gap-2 px-4 py-2 bg-white text-black rounded-lg text-xs font-black uppercase tracking-widest hover:bg-gray-200 transition-all"
                                                    >
                                                        <Upload size={14} />
                                                        Import DSR
                                                    </button>
                                                </div>
                                                <PayoutHistory payouts={payouts} loading={payoutsLoading} />
                                            </TabsContent>
                                        </div>
                                    </Tabs>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>

                {/* ── RIGHT PANEL — Distributors & Revenue ──────────── */}
                <aside className="hidden lg:flex w-72 2xl:w-80 flex-col border-l border-white/5 overflow-y-auto p-3 gap-3 flex-shrink-0">
                    <PerformancePanel releases={releases} />
                    <PublishingErrorBoundary componentName="Distributor Connections">
                        <DistributorConnectionsPanel />
                    </PublishingErrorBoundary>
                    <PublishingErrorBoundary componentName="Earnings Dashboard">
                        <EarningsDashboard />
                    </PublishingErrorBoundary>
                </aside>
            </div>

            {/* Modals */}
            <AnimatePresence>
                {isDSRModalOpen && (
                    <DSRUploadModal
                        isOpen={isDSRModalOpen}
                        onClose={() => setIsDSRModalOpen(false)}
                        onProcess={async (report) => {
                            try {
                                const { dsrUploadService } = await import('@/services/ddex/DSRUploadService');
                                const catalog = new Map(
                                    releases
                                        .filter(r => r.metadata.isrc)
                                        .map(r => [r.metadata.isrc!, r.metadata])
                                );
                                setIsDSRModalOpen(false);
                                toast.success('Sales report integrated successfully');
                                await fetchEarnings({ startDate: defaultDateRange.start, endDate: defaultDateRange.end });
                            } catch (error) {
                                console.error('[DSR Upload] Error:', error);
                                toast.error('Failed to process sales report');
                            }
                        }}
                    />
                )}
                {isValidationModalOpen && (
                    <ValidationRequirementsModal
                        isOpen={isValidationModalOpen}
                        onClose={() => setIsValidationModalOpen(false)}
                        distributors={[]}
                    />
                )}
            </AnimatePresence>

            {isWizardOpen && (
                <ReleaseWizard
                    onClose={() => setIsWizardOpen(false)}
                    onComplete={(releaseId) => {
                        setIsWizardOpen(false);
                    }}
                />
            )}
        </ModuleErrorBoundary>
    );
}

/* ================================================================== */
/*  Left Panel Widgets                                                  */
/* ================================================================== */

function ReleaseStatsPanel({ stats, earnings }: { stats: { total: number; live: number; draft: number; pending: number }; earnings?: number }) {
    const items = [
        { label: 'Total Releases', value: stats.total.toString(), icon: Music, color: 'text-blue-400' },
        { label: 'Live on DSPs', value: stats.live.toString(), icon: Globe, color: 'text-green-400' },
        { label: 'Pending Review', value: stats.pending.toString(), icon: Clock, color: 'text-yellow-400' },
        { label: 'Total Earnings', value: earnings ? `$${earnings.toFixed(2)}` : '$0.00', icon: DollarSign, color: 'text-purple-400' },
    ];

    return (
        <div className="rounded-xl bg-white/[0.02] border border-white/5 p-3">
            <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3 px-1">Release Stats</h3>
            <div className="space-y-2">
                {items.map((s) => (
                    <div key={s.label} className="flex items-center gap-3 p-2.5 rounded-lg bg-white/[0.02] hover:bg-white/[0.04] transition-colors">
                        <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0">
                            <s.icon size={14} className={s.color} />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold text-white truncate">{s.value}</p>
                            <p className="text-[10px] text-gray-500">{s.label}</p>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

function ActiveReleasePanel({ releases, onSelect }: { releases: any[]; onSelect: (id: string) => void }) {
    const liveReleases = releases.filter(r => r.status === 'live').slice(0, 4);

    return (
        <div className="rounded-xl bg-white/[0.02] border border-white/5 p-3">
            <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3 px-1">Active Releases</h3>
            {liveReleases.length === 0 ? (
                <p className="text-xs text-gray-600 px-1">No live releases yet.</p>
            ) : (
                <div className="space-y-1">
                    {liveReleases.map((r) => (
                        <button
                            key={r.id}
                            onClick={() => onSelect(r.id)}
                            className="w-full flex items-center gap-2 py-2 px-2 rounded-lg hover:bg-white/[0.04] transition-colors text-left"
                        >
                            <div className="w-1.5 h-1.5 rounded-full bg-green-500 flex-shrink-0" />
                            <div className="min-w-0">
                                <p className="text-xs text-white truncate">{r.metadata?.title || 'Untitled'}</p>
                                <p className="text-[10px] text-gray-600">{r.metadata?.artist || 'Unknown'}</p>
                            </div>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

function PendingActionsPanel({ pendingCount, draftCount, onNewRelease, onImportDSR }: {
    pendingCount: number; draftCount: number; onNewRelease: () => void; onImportDSR: () => void;
}) {
    return (
        <div className="rounded-xl bg-white/[0.02] border border-white/5 p-3">
            <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3 px-1">Quick Actions</h3>
            <div className="space-y-2">
                {pendingCount > 0 && (
                    <div className="p-2.5 rounded-lg bg-yellow-500/5 border border-yellow-500/10 text-xs text-yellow-300 flex items-start gap-2">
                        <AlertCircle size={12} className="flex-shrink-0 mt-0.5" />
                        <span>{pendingCount} release{pendingCount > 1 ? 's' : ''} pending review</span>
                    </div>
                )}
                {draftCount > 0 && (
                    <div className="p-2.5 rounded-lg bg-blue-500/5 border border-blue-500/10 text-xs text-blue-300 flex items-start gap-2">
                        <FileText size={12} className="flex-shrink-0 mt-0.5" />
                        <span>{draftCount} draft{draftCount > 1 ? 's' : ''} in progress</span>
                    </div>
                )}
                <button
                    onClick={onNewRelease}
                    className="w-full flex items-center gap-2 p-2.5 rounded-lg bg-white/[0.02] hover:bg-white/[0.06] transition-colors text-xs text-white font-medium"
                >
                    <Plus size={12} /> New Release
                </button>
                <button
                    onClick={onImportDSR}
                    className="w-full flex items-center gap-2 p-2.5 rounded-lg bg-white/[0.02] hover:bg-white/[0.06] transition-colors text-xs text-white font-medium"
                >
                    <Upload size={12} /> Import DSR
                </button>
            </div>
        </div>
    );
}

/* ================================================================== */
/*  Right Panel Widgets                                                 */
/* ================================================================== */

function PerformancePanel({ releases }: { releases: any[] }) {
    const liveCount = releases.filter(r => r.status === 'live').length;
    const totalCount = releases.length;
    const pct = totalCount > 0 ? Math.round((liveCount / totalCount) * 100) : 0;

    return (
        <div className="rounded-xl bg-white/[0.02] border border-white/5 p-3">
            <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3 px-1">Performance (30d)</h3>
            <div className="space-y-3">
                <div className="p-3 rounded-lg bg-white/[0.02]">
                    <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] text-gray-500 font-bold">Catalog Live Rate</span>
                        <span className="text-[10px] text-green-400 font-bold">{pct}%</span>
                    </div>
                    <p className="text-lg font-black text-white">{liveCount} / {totalCount}</p>
                    <div className="w-full h-1 bg-white/5 rounded-full mt-2 overflow-hidden">
                        <motion.div
                            className="h-full bg-gradient-to-r from-blue-500 to-blue-400 rounded-full"
                            initial={{ width: 0 }}
                            animate={{ width: `${pct}%` }}
                            transition={{ duration: 1, delay: 0.3 }}
                        />
                    </div>
                </div>
                <div className="p-3 rounded-lg bg-white/[0.02]">
                    <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] text-gray-500 font-bold">Distribution Health</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <Radio size={12} className="text-green-400" />
                        <span className="text-xs text-green-400 font-bold">All Systems Nominal</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
