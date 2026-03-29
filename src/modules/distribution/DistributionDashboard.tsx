import React from 'react';
import { motion } from 'motion/react';
import { Radio, PlusCircle, Library, BarChart3, Activity } from 'lucide-react';

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

/* ================================================================== */
/*  Distribution Dashboard — Three-Panel Layout                        */
/* ================================================================== */

export default function DistributionDashboard() {
    const { t } = useTranslation();
    const { releases, loading, error, handleRetry } = useDistributionDashboard();

    const TABS = [
        { value: 'releases', label: t('distribution.tabs.releases') },
        { value: 'connections', label: t('distribution.tabs.connections') },
        { value: 'bank', label: t('distribution.tabs.bank') },
        { value: 'authority', label: t('distribution.tabs.authority') },
        { value: 'keys', label: t('distribution.tabs.keys') },
        { value: 'brain', label: t('distribution.tabs.brain') },
        { value: 'transmission', label: t('distribution.tabs.transmission') },
    ];

    return (
        <ModuleErrorBoundary moduleName="Distribution">
            <div data-testid="distribution-dashboard" className="absolute inset-0 flex bg-bg-dark/50">
                {/* ── LEFT PANEL — Distributor Status & Health ────────── */}
                <aside className="hidden lg:flex w-64 xl:w-72 2xl:w-80 flex-col border-r border-white/5 overflow-y-auto p-3 gap-3 flex-shrink-0 bg-black/20 backdrop-blur-md">
                    <DistributorQuickView />
                    <DeliveryHealthPanel releases={releases} />
                    <QuickLinksPanel />
                </aside>

                {/* ── CENTER — Tabbed Content ─────────────────────────── */}
                <div className="flex-1 flex flex-col min-w-0">
                    {/* Header */}
                    <div className="px-4 md:px-6 py-5 border-b border-white/5 flex-shrink-0 bg-black/10 backdrop-blur-sm">
                        <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-dept-publishing to-purple-600 flex items-center justify-center shadow-xl shadow-dept-publishing/20 border border-white/10">
                                <Radio size={22} className="text-white" />
                            </div>
                            <div className="flex-1">
                                <div className="flex items-center gap-2.5">
                                    <h1 className="text-2xl font-black text-white tracking-tighter uppercase italic">{t('distribution.title')}</h1>
                                    <div className="flex items-center gap-1.5 px-2.5 py-0.5 bg-dept-publishing/10 border border-dept-publishing/20 rounded-full">
                                        <div className="w-1.5 h-1.5 rounded-full bg-dept-publishing animate-pulse" />
                                        <span data-testid="live-system-badge" className="text-[10px] font-bold text-dept-publishing tracking-widest uppercase">Live System</span>
                                    </div>
                                </div>
                                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-[0.15em] mt-1">{t('distribution.subtitle')}</p>
                            </div>
                        </div>
                    </div>

                    {/* Tabs */}
                    <Tabs defaultValue="releases" className="flex-1 flex flex-col overflow-hidden">
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
                                    <PlusCircle size={14} /> Authority
                                </TabsTrigger>
                                <TabsTrigger
                                    value="keys"
                                    data-testid="distro-tab-keys"
                                    className="text-muted-foreground data-[state=active]:text-dept-distro data-[state=active]:bg-transparent border-b-2 border-transparent data-[state=active]:border-dept-distro rounded-none px-0 h-full font-bold transition-all flex items-center gap-2 text-xs"
                                >
                                    <Library size={14} /> Keys
                                </TabsTrigger>
                                <TabsTrigger
                                    value="brain"
                                    data-testid="distro-tab-brain"
                                    className="text-muted-foreground data-[state=active]:text-dept-distro data-[state=active]:bg-transparent border-b-2 border-transparent data-[state=active]:border-dept-distro rounded-none px-0 h-full font-bold transition-all flex items-center gap-2 text-xs"
                                >
                                    <Activity size={14} /> Brain
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

                {/* ── RIGHT PANEL — QC, Keys, Authority, & Checklist ──────────────── */}
                <aside className="hidden lg:flex w-72 2xl:w-80 flex-col border-l border-white/5 overflow-y-auto p-3 gap-3 flex-shrink-0 bg-black/20 backdrop-blur-md">
                    <RegistrationChecklistPanel />
                    <QCQuickPanel />
                    <KeysStatusPanel />
                    <AuthorityInfoPanel />
                </aside>
            </div>
        </ModuleErrorBoundary>
    );
}
