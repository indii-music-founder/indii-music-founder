import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Radio, PlusCircle, Library, BarChart3, Activity, CheckSquare } from 'lucide-react';

/* ── UI Components ── */
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DistributorConnectionsPanel } from './components/DistributorConnectionsPanel';
import { BankPanel } from './components/BankPanel';
import { AuthorityPanel } from './components/AuthorityPanel';
import { QCPanel } from './components/QCPanel';
import { KeysPanel } from './components/KeysPanel';
import { TransferPanel } from './components/TransferPanel';
import { QCVisualizer } from './components/QCVisualizer';

/* ── Extracted Sub-components ── */
import { FastPathSongIngestionCard } from './components/FastPathSongIngestionCard';
import { ReleasesContent } from './components/ReleasesContent';
import { DistributorQuickView } from './components/DistributorQuickView';
import { DeliveryHealthPanel } from './components/DeliveryHealthPanel';
import { QuickLinksPanel } from './components/QuickLinksPanel';
import { QCQuickPanel } from './components/QCQuickPanel';
import { KeysStatusPanel } from './components/KeysStatusPanel';
import { AuthorityInfoPanel } from './components/AuthorityInfoPanel';
import { RegistrationChecklistPanel } from './components/RegistrationChecklistPanel';

/* ── Logic ── */
import { useDistributionDashboard } from './hooks/useDistributionDashboard';
import { ModuleErrorBoundary } from '@/core/components/ModuleErrorBoundary';
import { useTranslation } from 'react-i18next';
import { AdaptiveWorkspace } from '@/components/layout/AdaptiveWorkspace';
import { DepartmentJourneyBar } from '@/components/layout/DepartmentJourneyBar';
import { useStore } from '@/core/store';

/* ================================================================== */
/*  Distribution Dashboard — Three-Panel Layout                        */
/* ================================================================== */

export default function DistributionDashboard() {
    const { t } = useTranslation();
    const { releases, loading, error, handleRetry } = useDistributionDashboard();
    const user = useStore(state => state.user);
    const rawDistributionTab = useStore(state => state.distributionTab);
    const setDistributionTab = useStore(state => state.setDistributionTab);
    const [prevRawTab, setPrevRawTab] = useState(rawDistributionTab);
    const [currentTab, setCurrentTab] = useState<string>(() =>
        (rawDistributionTab === 'qc' ? 'brain' : (rawDistributionTab || 'releases'))
    );

    if (rawDistributionTab !== prevRawTab) {
        setPrevRawTab(rawDistributionTab);
        setCurrentTab(rawDistributionTab === 'qc' ? 'brain' : (rawDistributionTab || 'releases'));
    }

    const handleTabChange = (val: string) => {
        setCurrentTab(val);
        setDistributionTab?.(val);
    };

    return (
        <ModuleErrorBoundary moduleName="Distribution">
            <AdaptiveWorkspace
                testId="distribution-dashboard"
                deptModule="distribution"
                className="bg-bg-dark/50"
                leftRailLabel="Distributor status & delivery health"
                rightRailLabel="Registration, QC, keys & authority"
                leftRail={
                    <>
                        <DistributorQuickView />
                        <DeliveryHealthPanel releases={releases} />
                        <QuickLinksPanel />
                    </>
                }
                rightRail={
                    <>
                        <RegistrationChecklistPanel />
                        <QCQuickPanel />
                        <KeysStatusPanel />
                        <AuthorityInfoPanel />
                    </>
                }
            >
                {/* ── CENTER — Tabbed Content ─────────────────────────── */}
                <div className="flex-1 flex flex-col min-w-0">
                    {/* Header — Unified 48px Top Bar */}
                    <div className="h-12 px-4 md:px-6 border-b border-white/[0.06] flex-shrink-0 bg-[#0c0c12]/80 backdrop-blur-xl flex items-center justify-between gap-4">
                        <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-7 h-7 rounded-lg bg-linear-to-br from-dept-publishing to-green-600 flex items-center justify-center shadow-sm border border-white/10 shrink-0">
                                <Radio size={14} className="text-white" />
                            </div>
                            <h1 className="text-xs font-extrabold text-white tracking-wider uppercase truncate">{t('distribution.title')}</h1>
                            <div className="flex items-center gap-1.5 px-2 py-0.5 bg-dept-publishing/10 border border-dept-publishing/20 rounded-full shrink-0">
                                <div className="w-1.5 h-1.5 rounded-full bg-dept-publishing animate-pulse" />
                                <span data-testid="live-system-badge" className="text-[9.5px] font-bold text-dept-publishing tracking-widest uppercase">{t('distribution.liveSystem')}</span>
                            </div>
                            <span className="hidden lg:inline text-[11px] text-gray-500 truncate">{t('distribution.subtitle')}</span>
                        </div>
                        <DepartmentJourneyBar
                            department="distribution"
                            activeTab={currentTab}
                            onSelectTab={handleTabChange}
                            itemCount={releases.length}
                        />
                    </div>

                    {/* Tabs */}
                    <Tabs value={currentTab} onValueChange={handleTabChange} className="flex-1 flex flex-col overflow-hidden">
                        <div className="px-4 md:px-6 border-b border-white/5 flex-shrink-0 overflow-x-auto scrollbar-hide bg-black/5">
                            <TabsList className="bg-transparent gap-6 p-0 h-14 inline-flex">
                                <TabsTrigger
                                    value="releases"
                                    data-testid="distro-tab-new"
                                    className="text-muted-foreground data-[state=active]:text-dept-distro data-[state=active]:bg-transparent border-b-2 border-transparent data-[state=active]:border-dept-distro rounded-none px-0 h-full font-bold transition-all flex items-center gap-2 text-xs"
                                >
                                    <PlusCircle size={14} /> {t('distribution.tabs.new')}
                                </TabsTrigger>
                                <TabsTrigger
                                    value="connections"
                                    data-testid="distro-tab-catalogue"
                                    className="text-muted-foreground data-[state=active]:text-dept-distro data-[state=active]:bg-transparent border-b-2 border-transparent data-[state=active]:border-dept-distro rounded-none px-0 h-full font-bold transition-all flex items-center gap-2 text-xs"
                                >
                                    <Library size={14} /> {t('distribution.tabs.catalogue')}
                                </TabsTrigger>
                                <TabsTrigger
                                    value="bank"
                                    data-testid="distro-tab-bank"
                                    className="text-muted-foreground data-[state=active]:text-dept-distro data-[state=active]:bg-transparent border-b-2 border-transparent data-[state=active]:border-dept-distro rounded-none px-0 h-full font-bold transition-all flex items-center gap-2 text-xs"
                                >
                                    <BarChart3 size={14} /> {t('distribution.tabs.analytics')}
                                </TabsTrigger>
                                <TabsTrigger
                                    value="authority"
                                    data-testid="distro-tab-authority"
                                    className="text-muted-foreground data-[state=active]:text-dept-distro data-[state=active]:bg-transparent border-b-2 border-transparent data-[state=active]:border-dept-distro rounded-none px-0 h-full font-bold transition-all flex items-center gap-2 text-xs"
                                >
                                    <PlusCircle size={14} /> {t('distribution.tabs.authority')}
                                </TabsTrigger>
                                <TabsTrigger
                                    value="keys"
                                    data-testid="distro-tab-keys"
                                    className="text-muted-foreground data-[state=active]:text-dept-distro data-[state=active]:bg-transparent border-b-2 border-transparent data-[state=active]:border-dept-distro rounded-none px-0 h-full font-bold transition-all flex items-center gap-2 text-xs"
                                >
                                    <Library size={14} /> {t('distribution.tabs.keys')}
                                </TabsTrigger>
                                {/* ISSUE-1441: Founder Readiness tab removed — RegistrationCenter owns this panel. */}
                                <TabsTrigger
                                    value="brain"
                                    data-testid="distro-tab-brain"
                                    className="text-muted-foreground data-[state=active]:text-dept-distro data-[state=active]:bg-transparent border-b-2 border-transparent data-[state=active]:border-dept-distro rounded-none px-0 h-full font-bold transition-all flex items-center gap-2 text-xs"
                                >
                                    <Activity size={14} /> Pre-Flight Audio & QC
                                </TabsTrigger>
                                <TabsTrigger
                                    value="transmission"
                                    data-testid="distro-tab-transmission"
                                    className="text-muted-foreground data-[state=active]:text-dept-distro data-[state=active]:bg-transparent border-b-2 border-transparent data-[state=active]:border-dept-distro rounded-none px-0 h-full font-bold transition-all flex items-center gap-2 text-xs"
                                >
                                    <Activity size={14} /> {t('distribution.tabs.transmissions')}
                                </TabsTrigger>
                            </TabsList>
                        </div>

                        <div className="flex-1 overflow-y-auto scrollbar-hide">
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="p-4 md:p-8"
                            >
                                <TabsContent value="releases" data-testid="distro-content-new" className="mt-0 border-none outline-none focus-visible:ring-0">
                                    <ModuleErrorBoundary moduleName="Distribution / Releases">
                                        <div className="mb-8">
                                            <FastPathSongIngestionCard />
                                        </div>
                                        <ReleasesContent
                                            releases={releases}
                                            loading={loading}
                                            error={error}
                                            onRetry={handleRetry}
                                        />
                                    </ModuleErrorBoundary>
                                </TabsContent>
                                <TabsContent value="connections" data-testid="distro-content-catalogue" className="mt-0 border-none outline-none focus-visible:ring-0">
                                    <ModuleErrorBoundary moduleName="Distribution / Distributors">
                                        <DistributorConnectionsPanel />
                                    </ModuleErrorBoundary>
                                </TabsContent>
                                <TabsContent value="bank" data-testid="distro-content-bank" className="mt-0 border-none outline-none focus-visible:ring-0">
                                    <ModuleErrorBoundary moduleName="Distribution / Bank">
                                        <BankPanel />
                                    </ModuleErrorBoundary>
                                </TabsContent>
                                <TabsContent value="authority" data-testid="distro-content-authority" className="mt-0 border-none outline-none focus-visible:ring-0">
                                    <ModuleErrorBoundary moduleName="Distribution / Authority">
                                        <AuthorityPanel />
                                    </ModuleErrorBoundary>
                                </TabsContent>
                                <TabsContent value="keys" data-testid="distro-content-keys" className="mt-0 border-none outline-none focus-visible:ring-0">
                                    <ModuleErrorBoundary moduleName="Distribution / Keys">
                                        <KeysPanel />
                                    </ModuleErrorBoundary>
                                </TabsContent>
                                {/* ISSUE-1441: the "founder" tab (FounderReadinessPanel) was
                                    removed — RegistrationCenter is its single home; this
                                    module carried a stale duplicate. */}
                                <TabsContent value="brain" data-testid="distro-content-brain" className="mt-0 border-none outline-none focus-visible:ring-0">
                                    <ModuleErrorBoundary moduleName="Distribution / QC">
                                        <QCPanel />
                                        <div className="mt-6">
                                            <QCVisualizer />
                                        </div>
                                    </ModuleErrorBoundary>
                                </TabsContent>
                                <TabsContent value="transmission" data-testid="distro-content-transmission" className="mt-0 border-none outline-none focus-visible:ring-0">
                                    <ModuleErrorBoundary moduleName="Distribution / Transfer">
                                        <TransferPanel />
                                    </ModuleErrorBoundary>
                                </TabsContent>
                            </motion.div>
                        </div>
                    </Tabs>
                </div>
            </AdaptiveWorkspace>
        </ModuleErrorBoundary>
    );
}
