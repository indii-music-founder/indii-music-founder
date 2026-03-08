import React from 'react';
import { motion } from 'motion/react';
import { Radio } from 'lucide-react';

/* ── UI Components ── */
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DistributorConnectionsPanel } from './components/DistributorConnectionsPanel';
import { BankPanel } from './components/BankPanel';
import { AuthorityPanel } from './components/AuthorityPanel';
import { QCPanel } from './components/QCPanel';
import { KeysPanel } from './components/KeysPanel';
import { TransferPanel } from './components/TransferPanel';

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

/* ================================================================== */
/*  Distribution Dashboard — Three-Panel Layout                        */
/* ================================================================== */

export default function DistributionDashboard() {
    const { releases, loading, error, handleRetry } = useDistributionDashboard();

    const TABS = [
        { value: 'releases', label: 'Releases' },
        { value: 'connections', label: 'Distributors' },
        { value: 'bank', label: 'Bank' },
        { value: 'authority', label: 'Authority' },
        { value: 'keys', label: 'Keys' },
        { value: 'brain', label: 'Brain (QC)' },
        { value: 'transmission', label: 'Transfer' },
    ];

    return (
        <ModuleErrorBoundary moduleName="Distribution">
        <div className="absolute inset-0 flex bg-bg-dark/50">
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
                                <h1 className="text-2xl font-black text-white tracking-tighter uppercase italic">Distribution</h1>
                                <div className="flex items-center gap-1.5 px-2.5 py-0.5 bg-dept-publishing/10 border border-dept-publishing/20 rounded-full">
                                    <div className="w-1.5 h-1.5 rounded-full bg-dept-publishing animate-pulse" />
                                    <span className="text-[10px] font-bold text-dept-publishing tracking-widest uppercase">Live System</span>
                                </div>
                            </div>
                            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-[0.15em] mt-1">150+ PLATFORMS • ONE-CLICK GLOBAL DELIVERY</p>
                        </div>
                    </div>
                </div>

                {/* Tabs */}
                <Tabs defaultValue="releases" className="flex-1 flex flex-col overflow-hidden">
                    <div className="px-4 md:px-6 border-b border-white/5 flex-shrink-0 overflow-x-auto scrollbar-hide bg-black/5">
                        <TabsList className="bg-transparent gap-6 p-0 h-14 inline-flex">
                            {TABS.map((tab) => (
                                <TabsTrigger
                                    key={tab.value}
                                    value={tab.value}
                                    className="text-muted-foreground data-[state=active]:text-dept-publishing data-[state=active]:bg-transparent border-b-2 border-transparent data-[state=active]:border-dept-publishing rounded-none px-0 h-full font-black transition-all text-[11px] uppercase tracking-widest whitespace-nowrap"
                                >
                                    {tab.label}
                                </TabsTrigger>
                            ))}
                        </TabsList>
                    </div>

                    <div className="flex-1 overflow-y-auto scrollbar-hide">
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="p-4 md:p-8"
                        >
                            <TabsContent value="releases" className="mt-0 border-none outline-none">
                                <ReleasesContent
                                    releases={releases}
                                    loading={loading}
                                    error={error}
                                    onRetry={handleRetry}
                                />
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
