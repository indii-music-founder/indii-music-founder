import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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
    Loader2
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
import type { ReleaseAssets, DistributorId, ReleaseStatus } from '@/services/distribution/types/distributor';

// Simple CSS-based Sparkline Component for Beta Visualization
const Sparkline = ({ data, color = "text-green-500" }: { data: number[], color?: string }) => {
    return (
        <div className="flex items-end gap-1 h-8 w-24">
            {data.map((h, i) => (
                <div
                    key={i}
                    className={`w-1 rounded-t-sm bg-current ${color} opacity-80`}
                    style={{ height: `${Math.max(10, h)}%` }}
                />
            ))}
        </div>
    );
};

const TabButton = ({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) => (
    <button
        onClick={onClick}
        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${active ? 'bg-white text-black shadow-lg scale-[1.02]' : 'text-gray-500 hover:text-gray-300'
            }`}
    >
        {icon}
        {label}
    </button>
);



export default function PublishingDashboard() {
    // Beta Performance Mandate: Granular Selectors
    const setModule = useStore(state => state.setModule);
    const { finance, distribution, fetchDistributors, fetchEarnings, currentOrganizationId } = useStore();
    const toast = useToast();

    // Core State
    const [isWizardOpen, setIsWizardOpen] = useState(false);
    const [activeTab, setActiveTab] = useState<'catalog' | 'analytics' | 'finance'>('catalog');
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

    // Real data hooks
    const { data: analyticsData, loading: analyticsLoading } = useAnalytics(defaultDateRange);
    const { payouts, loading: payoutsLoading } = usePayouts();


    useEffect(() => {
        if (currentOrganizationId) {
            fetchDistributors();
            // Use the same date range as analytics
            fetchEarnings({ startDate: defaultDateRange.start, endDate: defaultDateRange.end });
        }
    }, [currentOrganizationId, fetchDistributors, fetchEarnings, defaultDateRange]);

    // Selected Release Memo
    const selectedRelease = useMemo(() =>
        releases.find(r => r.id === selectedReleaseId),
        [releases, selectedReleaseId]);

    // Stats Calculation (Memoized)
    const stats = useMemo(() => {
        const total = releases.length;
        const live = releases.filter(r => r.status === 'live').length;
        const draft = releases.filter(r => r.status === 'draft').length;
        const pending = releases.filter(r => ['pending_review', 'metadata_complete', 'assets_uploaded'].includes(r.status)).length;

        return {
            total,
            live,
            draft,
            pending,
            // Mock trend data for visualization - deterministic for tests
            trends: {
                total: [10, 15, 20, 25, 30, 35, 40, 45],
                live: [5, 10, 12, 18, 22, 28, 32, 35],
                pending: [2, 4, 3, 5, 2, 1, 4, 2],
                earnings: [20, 35, 45, 30, 60, 75, 55, 80]
            }
        };
    }, [releases]);




    const statsConfig = useMemo(() => [
        {
            label: 'Total Releases',
            value: releases.length.toString(),
            icon: Music,
            color: 'blue',
            trend: stats.trends.total
        },
        {
            label: 'Live on DSPs',
            value: releases.filter(r => (r.status as string) === 'live').length.toString(),
            icon: Globe,
            color: 'green',
            trend: stats.trends.live
        },
        {
            label: 'Pending Review',
            value: releases.filter(r => [
                'metadata_complete',
                'assets_uploaded',
                'validating',
                'pending_review',
                'approved',
                'delivering'
            ].includes(r.status)).length.toString(),
            icon: Clock,
            color: 'yellow',
            trend: stats.trends.pending
        },
        {
            label: 'Total Earnings',
            value: finance.earningsSummary ? `$${finance.earningsSummary.totalNetRevenue.toFixed(2)}` : '$0.00',
            icon: DollarSign,
            color: 'purple',
            trend: stats.trends.earnings
        }
    ], [releases, finance.earningsSummary, stats.trends]);

    if (releasesLoading) {
        return <PublishingSkeleton />;
    }

    return (
        <ModuleErrorBoundary moduleName="Publishing Dashboard">
            <div className="min-h-screen bg-[#0A0A0A] text-white">
                <OfflineBanner />
                <div className="max-w-7xl mx-auto px-6 py-12">
                    {/* Header */}
                    <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-6">
                        <div>
                            <div className="flex items-center gap-3 mb-2">
                                <h1 className="text-5xl font-black tracking-tighter uppercase italic">
                                    Publishing
                                </h1>
                                <div className="flex items-center gap-2 px-2.5 py-1 bg-blue-500/10 border border-blue-500/20 rounded-full">
                                    <Book size={12} className="text-blue-500" />
                                    <span className="text-[10px] font-bold text-blue-500 tracking-widest uppercase">Beta</span>
                                </div>
                            </div>
                            <p className="text-gray-500 max-w-xl font-medium">
                                Manage song rights, distribution, and global royalties.
                            </p>
                        </div>

                        <div className="flex items-center gap-4">
                            {/* Tab Navigation */}
                            <div className="flex items-center p-1 bg-[#121212] border border-gray-800 rounded-xl">
                                <TabButton
                                    active={activeTab === 'catalog'}
                                    onClick={() => { setActiveTab('catalog'); setSelectedReleaseId(null); }}
                                    icon={<LayoutGrid size={16} />}
                                    label="Catalog"
                                />
                                <TabButton
                                    active={activeTab === 'analytics'}
                                    onClick={() => { setActiveTab('analytics'); setSelectedReleaseId(null); }}
                                    icon={<BarChart2 size={16} />}
                                    label="Insights"
                                />
                                <TabButton
                                    active={activeTab === 'finance'}
                                    onClick={() => { setActiveTab('finance'); setSelectedReleaseId(null); }}
                                    icon={<CreditCard size={16} />}
                                    label="Royalties"
                                />
                            </div>

                            <button
                                onClick={() => setIsWizardOpen(true)}
                                className="group flex items-center gap-2 px-6 py-3 bg-white text-black rounded-xl hover:bg-gray-200 transition-all font-bold tracking-tight active:scale-[0.98] shadow-lg hover:shadow-xl"
                            >
                                <Plus size={18} className="transition-transform group-hover:rotate-90" />
                                New Release
                            </button>
                        </div>
                    </div>

                    {/* Stats Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
                        {statsConfig.map((stat, index) => (
                            <motion.div
                                key={index}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: index * 0.1 }}
                                className="relative overflow-hidden bg-[#121212] border border-gray-800/50 rounded-2xl p-6 shadow-xl group hover:border-gray-700/50 transition-colors"
                            >
                                <div className="flex items-center justify-between mb-4">
                                    <div className={`p-3 bg-${stat.color}-500/10 rounded-xl group-hover:bg-${stat.color}-500/20 transition-colors`}>
                                        <stat.icon size={20} className={`text-${stat.color}-400`} />
                                    </div>
                                    <Sparkline data={stat.trend} color={`text-${stat.color}-500`} />
                                </div>
                                <div className="relative">
                                    <p className="text-4xl font-black text-white mb-1 tracking-tighter">{stat.value}</p>
                                    <span className="text-gray-500 text-xs font-bold uppercase tracking-widest">{stat.label}</span>
                                </div>
                                {/* Decorative gradient */}
                                <div className={`absolute top-0 right-0 w-32 h-32 bg-${stat.color}-500/5 blur-3xl -mr-16 -mt-16 group-hover:bg-${stat.color}-500/10 transition-all`} />
                            </motion.div>
                        ))}
                    </div>

                    {/* Main Content Viewport */}
                    <AnimatePresence mode="wait">
                        {selectedReleaseId && selectedRelease ? (
                            <motion.div
                                key="detail"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
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
                                            sizeBytes: 0, // Placeholder as size is not in DDEX record yet
                                        }],
                                        coverArt: {
                                            url: selectedRelease.assets.coverArtUrl,
                                            width: selectedRelease.assets.coverArtWidth,
                                            height: selectedRelease.assets.coverArtHeight,
                                            mimeType: 'image/jpeg', // Default assumption
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
                                        // Close detail view and open wizard with existing data
                                        setSelectedReleaseId(null);
                                        setIsWizardOpen(true);
                                        toast.info('Release editing will open in wizard mode');
                                    }}
                                />
                            </motion.div>
                        ) : activeTab === 'catalog' ? (
                            <motion.div
                                key="catalog"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="grid grid-cols-1 lg:grid-cols-3 gap-8"
                            >
                                <div className="lg:col-span-2 space-y-6">
                                    <PublishingErrorBoundary componentName="Release List">
                                        <ReleaseListView
                                            onNewRelease={() => setIsWizardOpen(true)}
                                            onReleaseClick={(id) => setSelectedReleaseId(id)}
                                        />
                                    </PublishingErrorBoundary>
                                </div>
                                <div className="space-y-6">
                                    <PublishingErrorBoundary componentName="Distributor Connections">
                                        <DistributorConnectionsPanel />
                                    </PublishingErrorBoundary>
                                    <PublishingErrorBoundary componentName="Earnings Dashboard">
                                        <EarningsDashboard />
                                    </PublishingErrorBoundary>
                                </div>
                            </motion.div>
                        ) : activeTab === 'analytics' ? (
                            <motion.div
                                key="analytics"
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -20 }}
                                className="space-y-8"
                            >
                                <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                                    {statsConfig.map((stat, index) => (
                                        <div key={index} className="bg-[#121212] border border-gray-800 rounded-2xl p-6">
                                            <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">{stat.label}</p>
                                            <p className="text-3xl font-black text-white italic">{stat.value}</p>
                                        </div>
                                    ))}
                                </div>
                                <PublishingErrorBoundary componentName="Analytics Charts">
                                    <AnalyticsCharts
                                        data={analyticsData}
                                        selectedMetric={selectedMetric}
                                        onMetricChange={setSelectedMetric}
                                        dateRange={defaultDateRange}
                                        loading={analyticsLoading}
                                    />
                                </PublishingErrorBoundary>
                            </motion.div>
                        ) : (
                            <motion.div
                                key="finance"
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -20 }}
                                className="space-y-8"
                            >
                                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                                    <div className="lg:col-span-2 space-y-6">
                                        <div className="flex items-center justify-between p-6 bg-blue-500/10 border border-blue-500/20 rounded-2xl mb-2">
                                            <div>
                                                <h4 className="text-sm font-black text-white uppercase tracking-widest italic">Missing Sales Data?</h4>
                                                <p className="text-xs text-gray-500 font-medium">Import reports from DSPs to sync your balance.</p>
                                            </div>
                                            <button
                                                onClick={() => setIsDSRModalOpen(true)}
                                                className="flex items-center gap-2 px-4 py-2 bg-white text-black rounded-xl text-xs font-black uppercase tracking-widest hover:bg-gray-200 transition-all"
                                            >
                                                <Upload size={14} />
                                                Import DSR
                                            </button>
                                        </div>
                                        <PayoutHistory payouts={payouts} loading={payoutsLoading} />
                                    </div>
                                    <div className="space-y-6">
                                        <EarningsDashboard />
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Modals */}
                    <AnimatePresence>
                        {isDSRModalOpen && (
                            <DSRUploadModal
                                isOpen={isDSRModalOpen}
                                onClose={() => setIsDSRModalOpen(false)}
                                onProcess={async (report) => {
                                    try {
                                        // Import the upload service
                                        const { dsrUploadService } = await import('@/services/ddex/DSRUploadService');

                                        // Build user catalog from releases for matching
                                        const catalog = new Map(
                                            releases
                                                .filter(r => r.metadata.isrc)
                                                .map(r => [r.metadata.isrc!, r.metadata])
                                        );

                                        // Note: The actual file upload is handled inside the modal
                                        // This callback receives the parsed report
                                        // In production, you might want to pass the processing result back

                                        setIsDSRModalOpen(false);
                                        toast.success('Sales report integrated successfully');

                                        // Refresh earnings and payouts data
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
                                distributors={[]} // Pass actual distributors if available
                            />
                        )}
                    </AnimatePresence>


                    {/* Release Wizard Modal */}
                    {isWizardOpen && (
                        <ReleaseWizard
                            onClose={() => setIsWizardOpen(false)}
                            onComplete={(releaseId) => {
                                setIsWizardOpen(false);
                            }}
                        />
                    )}
                </div>
            </div>
        </ModuleErrorBoundary>
    );
}
