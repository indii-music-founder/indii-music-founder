import React, { useEffect } from 'react';
import { FileText, Clock, CheckCircle2, AlertCircle, ExternalLink, ShieldCheck, Scale, TrendingUp, Briefcase, BarChart3 } from 'lucide-react';
import { licensingService } from '@/services/licensing/LicensingService';
import type { LicenseRequest, License } from '@/services/licensing/types';
import { motion, AnimatePresence } from 'motion/react';
import { useStore } from '@/core/store';
import { useToast } from '@/core/context/ToastContext';

import { useLicensing } from './hooks/useLicensing';
import { MetricsGrid, DealFlowChart } from './components/LicensingWidgets';
import { EmptyActionState } from './components/EmptyActionState';
import { SkeletonStat, SkeletonList } from '@/components/shared/SkeletonLoader';
import { CatalogSearchTab } from './components/CatalogSearchTab';
import { SyncBriefMatcher } from './components/SyncBriefMatcher';
import { MicroLicensingPortal } from './components/MicroLicensingPortal';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ModuleErrorBoundary } from '@/core/components/ModuleErrorBoundary';
import { logger } from '@/utils/logger';

/* ================================================================== */
/*  Licensing Dashboard — Three-Panel Layout                            */
/*                                                                     */
/*  ┌──────────┬───────────────────────────┬──────────────┐            */
/*  │  LEFT    │    CENTER                 │   RIGHT      │            */
/*  │  Deal    │    Pending Clearances     │   Deal Flow  │            */
/*  │  Health  │    Active Portfolio       │   Templates  │            */
/*  │  Actions │    (expanded)             │   Compliance │            */
/*  └──────────┴───────────────────────────┴──────────────┘            */
/* ================================================================== */

export default function LicensingDashboard() {
    const { licenses, requests, projectedValue, loading: isLoading, initiateDrafting } = useLicensing();
    const { currentModule } = useStore();
    const toast = useToast();

    useEffect(() => {
        if (process.env.NODE_ENV === 'development') {
            const win = window as unknown as Window & { licensingService: typeof licensingService };
            win.licensingService = licensingService;
        }
    }, []);

    const handleDraftAction = async (request: LicenseRequest) => {
        await initiateDrafting(request);
    };

    if (isLoading) {
        return (
            <ModuleErrorBoundary moduleName="Licensing">
                <div className="absolute inset-0 flex p-4 gap-4" data-testid="loading-spinner" aria-busy="true" aria-label="Loading licensing data">
                    <div className="w-64 xl:w-72 space-y-3">
                        <SkeletonStat />
                        <SkeletonStat />
                        <SkeletonStat />
                    </div>
                    <div className="flex-1 space-y-3">
                        <div className="grid grid-cols-3 gap-3">
                            <SkeletonStat /><SkeletonStat /><SkeletonStat />
                        </div>
                        <SkeletonList rows={6} />
                    </div>
                </div>
            </ModuleErrorBoundary>
        );
    }

    return (
        <div className="absolute inset-0 flex">
            {/* ── LEFT PANEL — Deal Health & Actions ─────────────── */}
            <aside className="hidden lg:flex w-64 xl:w-72 2xl:w-80 flex-col border-r border-white/5 overflow-y-auto p-3 gap-3 flex-shrink-0">
                <DealHealthPanel
                    activeLicenses={licenses.length}
                    pendingRequests={requests.length}
                    projectedValue={projectedValue}
                />
                <RecentClearancesPanel requests={requests} onDraft={handleDraftAction} />
                <ActionButtonsPanel toast={toast} />
            </aside>

            {/* ── CENTER — Main Content ──────────────────────────── */}
            <div className="flex-1 flex flex-col min-w-0">
                {/* Header */}
                <div className="px-4 md:px-6 py-4 border-b border-white/5 flex-shrink-0 relative overflow-hidden">
                    <div className="absolute top-[-80px] left-[-80px] w-[300px] h-[300px] bg-indigo-500/8 blur-[100px] pointer-events-none rounded-full" />
                    <div className="relative z-10 flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-indigo-400 flex items-center justify-center shadow-lg shadow-indigo-500/20">
                            <ShieldCheck size={18} className="text-white" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-black text-white tracking-tighter uppercase">Licensing</h1>
                            <p className="text-muted-foreground font-medium tracking-wide text-[10px]">REAL-TIME RIGHTS & CLEARANCES</p>
                        </div>
                    </div>
                </div>

                {/* Scrollable Content */}
                <div className="flex-1 overflow-y-auto custom-scrollbar p-0">
                    <Tabs defaultValue="overview" className="h-full flex flex-col pt-4 md:pt-6">
                        <div className="px-4 md:px-6 mb-4">
                            <TabsList className="bg-white/5 border border-white/10">
                                <TabsTrigger value="overview" className="data-[state=active]:bg-indigo-500 data-[state=active]:text-white">
                                    Licensing Overview
                                </TabsTrigger>
                                <TabsTrigger value="catalog" className="data-[state=active]:bg-indigo-500 data-[state=active]:text-white">
                                    Sync Catalog Search
                                </TabsTrigger>
                                <TabsTrigger value="briefs" className="data-[state=active]:bg-indigo-500 data-[state=active]:text-white">
                                    Brief Matcher
                                </TabsTrigger>
                                <TabsTrigger value="micro" className="data-[state=active]:bg-indigo-500 data-[state=active]:text-white">
                                    Micro-Licensing
                                </TabsTrigger>
                            </TabsList>
                        </div>

                        <TabsContent value="overview" className="flex-1 flex flex-col gap-8 px-4 md:px-6 m-0 border-none p-0 data-[state=inactive]:hidden">
                            {/* Pending Clearances */}
                            <section className="space-y-4">
                                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                                    <Clock className="w-5 h-5 text-yellow-500" />
                                    Pending Clearances
                                </h2>
                                <AnimatePresence mode="popLayout">
                                    {requests.length === 0 ? (
                                        <EmptyActionState
                                            icon={Clock}
                                            title="No Pending Clearances"
                                            description="Start a new licensing deal to track its progress here. All drafted agreements will appear in this timeline."
                                            actionLabel="Draft New Deal"
                                            onAction={() => logger.info('Open draft modal')}
                                            gradient="from-yellow-500/20 to-orange-500/20"
                                        />
                                    ) : (
                                        requests.map((request, idx) => (
                                            <motion.div
                                                key={request.id}
                                                initial={{ opacity: 0, x: -20 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                transition={{ delay: idx * 0.05 }}
                                                className="group relative bg-white/[0.02] p-5 rounded-xl border border-white/5 hover:border-indigo-500/30 transition-all"
                                            >
                                                <div className="flex justify-between items-start gap-4">
                                                    <div className="space-y-1">
                                                        <h3 className="text-lg font-bold text-white group-hover:text-indigo-400 transition-colors uppercase tracking-tight">{request.title}</h3>
                                                        <p className="text-sm font-medium text-gray-400">{request.artist}</p>
                                                        <div className="flex items-center gap-3 pt-2">
                                                            <span className="text-[10px] px-2 py-0.5 rounded-md bg-yellow-500/10 text-yellow-500 border border-yellow-500/20 font-bold tracking-wider uppercase">
                                                                {request.status}
                                                            </span>
                                                            <span className="text-[10px] px-2 py-0.5 rounded-md bg-white/5 text-gray-400 border border-white/5 font-bold tracking-wider uppercase">
                                                                {request.usage}
                                                            </span>
                                                        </div>
                                                    </div>
                                                    <div className="flex flex-col items-end gap-3">
                                                        <button
                                                            onClick={() => handleDraftAction(request)}
                                                            className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-bold px-4 py-2 rounded-xl border border-indigo-400/20 shadow-lg shadow-indigo-600/10 transition-all scale-95 group-hover:scale-100"
                                                        >
                                                            <FileText size={14} />
                                                            DRAFT AGREEMENT
                                                        </button>
                                                        <span className="text-[10px] font-medium text-gray-600">
                                                            Requested • {request.requestedAt ? (request.requestedAt instanceof Date ? request.requestedAt.toLocaleDateString() : request.requestedAt.toDate().toLocaleDateString()) : 'N/A'}
                                                        </span>
                                                    </div>
                                                </div>
                                            </motion.div>
                                        ))
                                    )}
                                </AnimatePresence>
                            </section>

                            {/* Active Portfolio */}
                            <section className="space-y-4">
                                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                                    <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                                    Active Portfolio
                                </h2>
                                <AnimatePresence mode="popLayout">
                                    {licenses.length === 0 ? (
                                        <EmptyActionState
                                            icon={ShieldCheck}
                                            title="Portfolio Empty"
                                            description="You haven't registered any active licenses yet. Import existing agreements or scan your catalog for potential sync opportunities."
                                            actionLabel="Import Agreement"
                                            onAction={() => logger.info('Import modal')}
                                            secondaryLabel="Scan Catalog"
                                            onSecondary={() => toast.info("Beta: Semantic Deal Scanner initiated.")}
                                            gradient="from-emerald-500/20 to-teal-500/20"
                                        />
                                    ) : (
                                        licenses.map((license, idx) => (
                                            <motion.div
                                                key={license.id}
                                                initial={{ opacity: 0, scale: 0.95 }}
                                                animate={{ opacity: 1, scale: 1 }}
                                                transition={{ delay: idx * 0.05 }}
                                                className="relative bg-white/[0.02] p-5 rounded-xl border border-white/5 overflow-hidden group hover:border-emerald-500/30 transition-all"
                                            >
                                                <div className="absolute top-0 right-0 p-3 text-emerald-500/10">
                                                    <ShieldCheck size={64} />
                                                </div>
                                                <div className="relative z-10 flex justify-between items-start">
                                                    <div className="space-y-1">
                                                        <h3 className="text-lg font-bold text-white group-hover:text-emerald-400 transition-colors uppercase tracking-tight">{license.title}</h3>
                                                        <p className="text-sm font-medium text-gray-400">{license.artist}</p>
                                                        <div className="flex items-center gap-4 pt-3">
                                                            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 font-bold text-[10px] tracking-widest">
                                                                <CheckCircle2 size={10} />
                                                                SECURED
                                                            </div>
                                                            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">{license.licenseType}</span>
                                                        </div>
                                                    </div>
                                                    {license.agreementUrl && (
                                                        <a
                                                            href={license.agreementUrl}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="w-10 h-10 flex items-center justify-center rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-gray-400 hover:text-white transition-all"
                                                        >
                                                            <ExternalLink size={18} />
                                                        </a>
                                                    )}
                                                </div>
                                            </motion.div>
                                        ))
                                    )}
                                </AnimatePresence>
                            </section>

                            {/* Footer */}
                            <footer className="flex items-center justify-between p-4 bg-indigo-500/5 rounded-xl border border-indigo-500/10">
                                <div className="flex items-center gap-3 text-xs text-indigo-300/60 font-medium">
                                    <AlertCircle size={14} />
                                    <span>AI licensing tools active. All drafts MUST be reviewed by legal counsel.</span>
                                </div>
                                <div className="text-[10px] font-bold text-indigo-400 tracking-widest uppercase">
                                    Security: High
                                </div>
                            </footer>
                        </TabsContent>

                        <TabsContent value="catalog" className="flex-1 px-4 md:px-6 m-0 border-none p-0 h-full data-[state=inactive]:hidden">
                            <CatalogSearchTab />
                        </TabsContent>

                        <TabsContent value="briefs" className="flex-1 px-4 md:px-6 m-0 border-none p-0 h-full overflow-y-auto pb-6 data-[state=inactive]:hidden">
                            <SyncBriefMatcher />
                        </TabsContent>
                        <TabsContent value="micro" className="flex-1 px-4 md:px-6 m-0 border-none p-0 h-full overflow-y-auto pb-6 data-[state=inactive]:hidden">
                            <MicroLicensingPortal />
                        </TabsContent>
                    </Tabs>
                </div>
            </div>

            {/* ── RIGHT PANEL — Deal Flow & Templates ────────────── */}
            <aside className="hidden lg:flex w-72 2xl:w-80 flex-col border-l border-white/5 overflow-y-auto p-3 gap-3 flex-shrink-0">
                <DealFlowWidget />
                <LicensingTemplatesPanel />
                <ComplianceChecklistPanel licenses={licenses} />
            </aside>
        </div>
    );
}

/* ================================================================== */
/*  Left Panel Widgets                                                  */
/* ================================================================== */

function DealHealthPanel({ activeLicenses, pendingRequests, projectedValue }: {
    activeLicenses: number; pendingRequests: number; projectedValue: number;
}) {
    const items = [
        { label: 'Active Licenses', value: activeLicenses.toString(), icon: ShieldCheck, color: 'text-emerald-400' },
        { label: 'Pending Clearances', value: pendingRequests.toString(), icon: Clock, color: 'text-yellow-400' },
        { label: 'Projected Value', value: `$${projectedValue.toLocaleString()}`, icon: TrendingUp, color: 'text-indigo-400' },
    ];

    return (
        <div className="rounded-xl bg-white/[0.02] border border-white/5 p-3">
            <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3 px-1">Deal Health</h3>
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

function RecentClearancesPanel({ requests, onDraft }: { requests: LicenseRequest[]; onDraft: (r: LicenseRequest) => void }) {
    const recent = requests.slice(0, 3);

    return (
        <div className="rounded-xl bg-white/[0.02] border border-white/5 p-3">
            <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3 px-1">Recent Requests</h3>
            {recent.length === 0 ? (
                <p className="text-xs text-gray-600 px-1">No pending requests.</p>
            ) : (
                <div className="space-y-1">
                    {recent.map((r) => (
                        <button
                            key={r.id}
                            onClick={() => onDraft(r)}
                            className="w-full flex items-center gap-2 py-2 px-2 rounded-lg hover:bg-white/[0.04] transition-colors text-left"
                        >
                            <div className="w-1.5 h-1.5 rounded-full bg-yellow-500 flex-shrink-0" />
                            <div className="min-w-0">
                                <p className="text-xs text-white truncate">{r.title}</p>
                                <p className="text-[10px] text-gray-600">{r.usage}</p>
                            </div>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

function ActionButtonsPanel({ toast }: { toast: ReturnType<typeof useToast> }) {
    return (
        <div className="rounded-xl bg-white/[0.02] border border-white/5 p-3">
            <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3 px-1">Quick Actions</h3>
            <div className="space-y-2">
                <button className="w-full flex items-center gap-2 p-2.5 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 transition-colors text-xs text-indigo-300 font-medium border border-indigo-500/10">
                    <FileText size={12} /> Draft New Deal
                </button>
                <button className="w-full flex items-center gap-2 p-2.5 rounded-lg bg-white/[0.02] hover:bg-white/[0.06] transition-colors text-xs text-white font-medium">
                    <Scale size={12} /> Review Agreements
                </button>
            </div>
        </div>
    );
}

/* ================================================================== */
/*  Right Panel Widgets                                                 */
/* ================================================================== */

function DealFlowWidget() {
    return (
        <div className="rounded-xl bg-white/[0.02] border border-white/5 p-3">
            <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3 px-1">Deal Pipeline</h3>
            <DealFlowChart />
        </div>
    );
}

function LicensingTemplatesPanel() {
    // Templates should be loaded dynamically from the contract templates database
    return (
        <div className="rounded-xl bg-white/[0.02] border border-white/5 p-3">
            <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3 px-1">Templates</h3>
            <div className="flex flex-col items-center justify-center py-4 px-2 text-center">
                <FileText size={16} className="text-gray-600 mb-2 opacity-50" />
                <p className="text-[10px] text-gray-500">No custom templates</p>
                <p className="text-[9px] text-gray-600 mt-1">Add legal agreement templates in settings</p>
            </div>
        </div>
    );
}

function ComplianceChecklistPanel({ licenses }: { licenses: License[] }) {
    // Compliance checklist should be generated dynamically based on deal status
    return (
        <div className="rounded-xl bg-white/[0.02] border border-white/5 p-3">
            <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3 px-1">Compliance</h3>
            <div className="flex flex-col items-center justify-center py-4 px-2 text-center">
                <CheckCircle2 size={16} className="text-gray-600 mb-2 opacity-50" />
                <p className="text-[10px] text-gray-500">No active compliance tasks</p>
                <p className="text-[9px] text-gray-600 mt-1">Initiate a deal to see checklist</p>
            </div>
        </div>
    );
}
