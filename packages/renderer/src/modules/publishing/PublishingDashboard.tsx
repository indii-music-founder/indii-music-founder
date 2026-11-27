
import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
    Music,
    Plus,
    Clock,
    Globe,
    DollarSign,
    Book,
    FileText
} from 'lucide-react';
import { useStore } from '@/core/store';
import { useShallow } from 'zustand/react/shallow';
import { useReleases } from '@/modules/publishing/hooks/useReleases';
import { useReleaseWorkspace } from '@/modules/publishing/hooks/useReleaseWorkspace';
import { useAnalytics, usePayouts } from '@/modules/publishing/hooks/useAnalytics';
import ReleaseWizard from '@/modules/publishing/components/ReleaseWizard';
import { ModuleErrorBoundary } from '@/core/components/ModuleErrorBoundary';
import { ThreePanelDashboard } from '@/components/layout/ThreePanelDashboard';
import { DepartmentJourneyBar } from '@/components/layout/DepartmentJourneyBar';
import { useToast } from '@/core/context/ToastContext';
import { PublishingSkeleton } from '@/modules/publishing/components/PublishingSkeleton';
// ISSUE-1441: use the canonical panels (publishing carried drifted forks).
import { EarningsDashboard } from '@/modules/finance/components/EarningsDashboard';
import { ReleaseListView } from '@/modules/publishing/components/ReleaseListView';
import { DistributorStrip } from '@/modules/publishing/components/DistributorStrip';
import { ReleaseDetailPage } from '@/modules/publishing/components/ReleaseDetailPage';
import { AnalyticsCharts } from '@/modules/publishing/components/AnalyticsCharts';
import { PayoutHistory } from '@/modules/publishing/components/PayoutHistory';
import { DSRUploadModal } from '@/modules/publishing/components/DSRUploadModal';
import { ValidationRequirementsModal } from '@/modules/publishing/components/ValidationRequirementsModal';
import { PublishingErrorBoundary } from '@/modules/publishing/components/PublishingErrorBoundary';
import { OfflineBanner } from '@/modules/publishing/components/OfflineBanner';
import { LayoutGrid, BarChart2, CreditCard, Upload, ScrollText } from 'lucide-react';
import { MechanicalRoyaltyPanel } from '@/modules/publishing/components/MechanicalRoyaltyPanel';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { DistributorId, ReleaseStatus } from '@/services/distribution/types/distributor';
import { logger } from '@/utils/logger';

/* ================================================================== */
/*  Publishing Dashboard — single full-width column (ISSUE-1703)       */
/*                                                                     */
/*  Header: journeys · Import DSR · New Release                        */
/*  Stats strip → Distributors row → Tabs (Catalog / Insights /        */
/*  Royalties / Mechanical) or the Release Detail page.                */
/* ================================================================== */

export default function PublishingDashboard() {
    const { setModule, finance, fetchDistributors, fetchEarnings, currentOrganizationId } = useStore(
        useShallow(state => ({
            setModule: state.setModule,
            finance: state.finance,
            fetchDistributors: state.fetchDistributors,
            fetchEarnings: state.fetchEarnings,
            currentOrganizationId: state.currentOrganizationId,
        }))
    );
    const toast = useToast();

    // Core State
    const [activeTab, setActiveTab] = useState<string>('catalog');
    const [isWizardOpen, setIsWizardOpen] = useState(false);
    const [selectedReleaseId, setSelectedReleaseId] = useState<string | null>(null);
    const [isDSRModalOpen, setIsDSRModalOpen] = useState(false);
    const [isValidationModalOpen, setIsValidationModalOpen] = useState(false);

    // Data Hooks
    const releaseWorkspace = useReleaseWorkspace();
    const { releases, loading: releasesLoading } = useReleases(releaseWorkspace);

    // Analytics State
    const [selectedMetric, setSelectedMetric] = useState<'revenue' | 'streams'>('streams');

    // Default date range (last 30 days)
    const defaultDateRange = useMemo(() => {
        const now = Date.now();
        const endDate = new Date(now).toISOString().split('T')[0];
        const startDate = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        return { start: startDate!, end: endDate! };
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
            <ThreePanelDashboard
                moduleName="Publishing"
                headerIcon={<Book size={18} className="text-white" />}
                title="Publishing"
                subtitle="RIGHTS · DISTRIBUTION · ROYALTIES"
                bgBlobClass="bg-blue-500/8"
                iconBgClass="bg-linear-to-br from-blue-500 to-blue-400"
                iconShadowClass="shadow-blue-500/20"
                leftPanel={null}
                actions={
                    <div className="flex items-center gap-2">
                        <DepartmentJourneyBar
                            department="publishing"
                            activeTab={activeTab}
                            onSelectTab={(tab) => {
                                setSelectedReleaseId(null);
                                setActiveTab(tab);
                            }}
                            itemCount={releases.length}
                            pendingCount={stats.pending + stats.draft}
                            accentColorClass="text-blue-300 border-blue-400/25 bg-blue-400/10 hover:bg-blue-400/20"
                        />
                        <button
                            type="button"
                            onClick={() => setIsDSRModalOpen(true)}
                            className="flex items-center gap-1.5 px-3 py-1 rounded-md border border-white/10 text-gray-300 hover:text-white hover:bg-white/5 transition-all font-bold text-[11px]"
                        >
                            <Upload size={12} />
                            Import DSR
                        </button>
                        <button
                            onClick={() => setIsWizardOpen(true)}
                            className="group flex items-center gap-1.5 px-3 py-1 bg-white text-black rounded-md hover:bg-gray-200 transition-all font-bold text-[11px] active:scale-[0.98]"
                        >
                            <Plus size={12} className="transition-transform group-hover:rotate-90" />
                            New Release
                        </button>
                    </div>
                }
            >
                <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar">
                {!selectedReleaseId && (
                    <div className="px-4 md:px-6 pt-4 space-y-3">
                        <ReleaseStatsStrip stats={stats} earnings={finance.earningsSummary?.totalNetRevenue} />
                        <PublishingErrorBoundary componentName="Distributor Connections">
                            <DistributorStrip />
                        </PublishingErrorBoundary>
                    </div>
                )}
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
                                    <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
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
                                                <TabsTrigger
                                                    value="mechanical"
                                                    className="text-muted-foreground data-[state=active]:text-blue-400 data-[state=active]:bg-transparent border-b-2 border-transparent data-[state=active]:border-blue-400 rounded-none px-0 h-full font-bold transition-all flex items-center gap-2 text-xs"
                                                >
                                                    <ScrollText size={14} />
                                                    Mechanical
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
                                                <PublishingErrorBoundary componentName="Earnings Dashboard">
                                                    <EarningsDashboard />
                                                </PublishingErrorBoundary>
                                                <PayoutHistory payouts={payouts} loading={payoutsLoading} />
                                            </TabsContent>
                                            <TabsContent value="mechanical" className="mt-0 outline-none">
                                                <PublishingErrorBoundary componentName="Mechanical Royalties">
                                                    <MechanicalRoyaltyPanel
                                                        releaseId={selectedReleaseId ?? undefined}
                                                    />
                                                </PublishingErrorBoundary>
                                            </TabsContent>
                                        </div>
                                    </Tabs>
                                </motion.div>
                            )}
                        </AnimatePresence>
                </div>
            </ThreePanelDashboard>

<AnimatePresence>
                {isDSRModalOpen && (
                    <DSRUploadModal
                        isOpen={isDSRModalOpen}
                        onClose={() => setIsDSRModalOpen(false)}
                        onProcess={async (file) => {
                            // ISSUE-966: this callback must reject on failure and let the
                            // modal (the single terminal-messaging owner) handle the error
                            // path — it must NOT swallow the error here, or the modal's
                            // `await onProcess(...)` resolves normally and shows success
                            // (plus closes, discarding the preview) even when processing failed.
                            const { dsrUploadService } = await import('@/services/distribution/proprietary-ingestion/EarningsUploadService');
                            const result = await dsrUploadService.processAndSaveStatement(file);

                            if (!result.success) {
                                logger.error('[DSR Upload] Processing failed:', result.error);
                                throw new Error(result.error || 'Failed to process report');
                            }

                            // Success path only — the modal closes itself after this resolves.
                            toast.success(`Integrated ${result.matchedReleases} releases from report`);
                            await fetchEarnings({ startDate: defaultDateRange.start, endDate: defaultDateRange.end });
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
                    onComplete={(_releaseId) => {
                        setIsWizardOpen(false);
                    }}
                />
            )}
</ModuleErrorBoundary>
    );
}

/* ================================================================== */
/*  Stats strip (ISSUE-1703)                                            */
/* ================================================================== */

function ReleaseStatsStrip({ stats, earnings }: { stats: { total: number; live: number; draft: number; pending: number }; earnings?: number }) {
    const liveRate = stats.total > 0 ? Math.round((stats.live / stats.total) * 100) : 0;
    const items = [
        { label: 'Releases', value: stats.total.toString(), icon: Music, color: 'text-blue-400' },
        { label: 'Live on DSPs', value: stats.live.toString(), detail: stats.total > 0 ? `${liveRate}% of catalog` : undefined, icon: Globe, color: 'text-dept-publishing' },
        { label: 'Pending review', value: stats.pending.toString(), icon: Clock, color: 'text-yellow-400' },
        { label: 'Drafts', value: stats.draft.toString(), icon: FileText, color: 'text-gray-400' },
        // No earnings record yet shows a dash, not a reported $0.00.
        { label: 'Net earnings (30d)', value: typeof earnings === 'number' ? `$${earnings.toFixed(2)}` : '—', icon: DollarSign, color: 'text-green-400' },
    ];

    return (
        <dl data-testid="publishing-stats-strip" className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
            {items.map(item => (
                <div key={item.label} className="flex items-center gap-2.5 rounded-xl border border-white/5 bg-white/[0.02] px-3 py-2">
                    <item.icon size={14} className={`shrink-0 ${item.color}`} aria-hidden="true" />
                    <div className="min-w-0">
                        <dt className="text-[10px] font-bold uppercase tracking-widest text-gray-500 truncate">{item.label}</dt>
                        <dd className="text-sm font-black text-white leading-tight">
                            {item.value}
                            {item.detail && <span className="ml-1.5 text-[10px] font-bold text-gray-500">{item.detail}</span>}
                        </dd>
                    </div>
                </div>
            ))}
        </dl>
    );
}
