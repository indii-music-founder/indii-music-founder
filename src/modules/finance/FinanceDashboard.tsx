import React from 'react';
import { EarningsDashboard } from './components/EarningsDashboard';
import { ExpenseTracker } from './components/ExpenseTracker';
import { MerchandiseDashboard } from './components/MerchandiseDashboard';
import { RoyaltiesPrediction } from './components/RoyaltiesPrediction';
import { MultiCurrencyLedger } from './components/MultiCurrencyLedger';
import { StripeConnectOnboarding } from './components/StripeConnectOnboarding';
import { TaxFormCollection } from './components/TaxFormCollection';
import { AnomalyDetector } from './components/AnomalyDetector';
import { AuditLogsPanel } from './components/AuditLogsPanel';
import { BudgetVsActuals } from './components/BudgetVsActuals';
import { SplitSheetEscrow } from './components/SplitSheetEscrow';
import { ReceiptOCR } from './components/ReceiptOCR';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { motion } from 'motion/react';
import {
    Briefcase, CreditCard, ShoppingBag, TrendingUp,
    DollarSign, ArrowUpRight, ArrowDownRight, Wallet,
    AlertTriangle, Calendar, PiggyBank, Globe, Users,
    FileText, Activity, Shield, Camera, GitMerge
} from 'lucide-react';
import { ModuleErrorBoundary } from '@/core/components/ModuleErrorBoundary';

/* ================================================================== */
/*  Finance Dashboard — Three-Panel Layout                             */
/*                                                                     */
/*  ┌──────────┬───────────────────────────┬──────────────┐            */
/*  │  LEFT    │    CENTER                 │   RIGHT      │            */
/*  │  Quick   │    Tab System             │   Forecast   │            */
/*  │  Stats   │    (Earnings/Expenses/    │   Breakdown  │            */
/*  │  Txns    │     Merch) full-width     │   Alerts     │            */
/*  │  Tax     │                           │              │            */
/*  └──────────┴───────────────────────────┴──────────────┘            */
/* ================================================================== */

export default function FinanceDashboard() {
    return (
        <ModuleErrorBoundary moduleName="Finance">
            <div className="absolute inset-0 flex">
                {/* ── LEFT PANEL — Quick Stats & Summary ──────────────── */}
                <aside className="hidden lg:flex w-64 xl:w-72 2xl:w-80 flex-col border-r border-white/5 overflow-y-auto p-3 gap-3 flex-shrink-0">
                    <QuickStatsPanel />
                    <RecentTransactionsPanel />
                    <TaxSummaryPanel />
                </aside>

                {/* ── CENTER — Tabbed Content ─────────────────────────── */}
                <div className="flex-1 flex flex-col min-w-0">
                    {/* Header */}
                    <div className="px-4 md:px-6 py-4 border-b border-white/5 flex-shrink-0 relative overflow-hidden">
                        <div className="absolute top-[-80px] left-[-80px] w-[300px] h-[300px] bg-dept-royalties/8 blur-[100px] pointer-events-none rounded-full" />
                        <div className="relative z-10 flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-dept-royalties to-dept-royalties-glow flex items-center justify-center shadow-lg shadow-dept-royalties/20">
                                <TrendingUp size={18} className="text-white" />
                            </div>
                            <div>
                                <h1 className="text-2xl font-black text-white tracking-tighter uppercase">Finance</h1>
                                <p className="text-muted-foreground font-medium tracking-wide text-[10px]">REAL-TIME FISCAL OPERATIONS</p>
                            </div>
                        </div>
                    </div>

                    {/* Tabs */}
                    <Tabs defaultValue="earnings" className="flex-1 flex flex-col overflow-hidden">
                        <div className="px-4 md:px-6 border-b border-white/5 flex-shrink-0 overflow-x-auto">
                            <TabsList className="bg-transparent gap-4 p-0 h-12 flex-nowrap">
                                <TabsTrigger value="earnings" className="text-muted-foreground data-[state=active]:text-dept-royalties data-[state=active]:bg-transparent border-b-2 border-transparent data-[state=active]:border-dept-royalties rounded-none px-0 h-full font-bold transition-all flex items-center gap-2 text-xs whitespace-nowrap">
                                    <Briefcase size={14} /> Earnings
                                </TabsTrigger>
                                <TabsTrigger value="expenses" className="text-muted-foreground data-[state=active]:text-dept-royalties data-[state=active]:bg-transparent border-b-2 border-transparent data-[state=active]:border-dept-royalties rounded-none px-0 h-full font-bold transition-all flex items-center gap-2 text-xs whitespace-nowrap">
                                    <CreditCard size={14} /> Expenses
                                </TabsTrigger>
                                <TabsTrigger value="merch" className="text-muted-foreground data-[state=active]:text-dept-royalties data-[state=active]:bg-transparent border-b-2 border-transparent data-[state=active]:border-dept-royalties rounded-none px-0 h-full font-bold transition-all flex items-center gap-2 text-xs whitespace-nowrap">
                                    <ShoppingBag size={14} /> Merchandise
                                </TabsTrigger>
                                <TabsTrigger value="royalties" className="text-muted-foreground data-[state=active]:text-dept-royalties data-[state=active]:bg-transparent border-b-2 border-transparent data-[state=active]:border-dept-royalties rounded-none px-0 h-full font-bold transition-all flex items-center gap-2 text-xs whitespace-nowrap">
                                    <TrendingUp size={14} /> Royalties
                                </TabsTrigger>
                                <TabsTrigger value="currency" className="text-muted-foreground data-[state=active]:text-dept-royalties data-[state=active]:bg-transparent border-b-2 border-transparent data-[state=active]:border-dept-royalties rounded-none px-0 h-full font-bold transition-all flex items-center gap-2 text-xs whitespace-nowrap">
                                    <Globe size={14} /> Multi-Currency
                                </TabsTrigger>
                                <TabsTrigger value="splits" className="text-muted-foreground data-[state=active]:text-dept-royalties data-[state=active]:bg-transparent border-b-2 border-transparent data-[state=active]:border-dept-royalties rounded-none px-0 h-full font-bold transition-all flex items-center gap-2 text-xs whitespace-nowrap">
                                    <GitMerge size={14} /> Split Escrow
                                </TabsTrigger>
                                <TabsTrigger value="onboarding" className="text-muted-foreground data-[state=active]:text-dept-royalties data-[state=active]:bg-transparent border-b-2 border-transparent data-[state=active]:border-dept-royalties rounded-none px-0 h-full font-bold transition-all flex items-center gap-2 text-xs whitespace-nowrap">
                                    <Users size={14} /> Stripe Connect
                                </TabsTrigger>
                                <TabsTrigger value="tax" className="text-muted-foreground data-[state=active]:text-dept-royalties data-[state=active]:bg-transparent border-b-2 border-transparent data-[state=active]:border-dept-royalties rounded-none px-0 h-full font-bold transition-all flex items-center gap-2 text-xs whitespace-nowrap">
                                    <FileText size={14} /> Tax Forms
                                </TabsTrigger>
                                <TabsTrigger value="anomaly" className="text-muted-foreground data-[state=active]:text-dept-royalties data-[state=active]:bg-transparent border-b-2 border-transparent data-[state=active]:border-dept-royalties rounded-none px-0 h-full font-bold transition-all flex items-center gap-2 text-xs whitespace-nowrap">
                                    <Activity size={14} /> Anomaly
                                </TabsTrigger>
                                <TabsTrigger value="audit" className="text-muted-foreground data-[state=active]:text-dept-royalties data-[state=active]:bg-transparent border-b-2 border-transparent data-[state=active]:border-dept-royalties rounded-none px-0 h-full font-bold transition-all flex items-center gap-2 text-xs whitespace-nowrap">
                                    <Shield size={14} /> Audit Logs
                                </TabsTrigger>
                                <TabsTrigger value="budget" className="text-muted-foreground data-[state=active]:text-dept-royalties data-[state=active]:bg-transparent border-b-2 border-transparent data-[state=active]:border-dept-royalties rounded-none px-0 h-full font-bold transition-all flex items-center gap-2 text-xs whitespace-nowrap">
                                    <DollarSign size={14} /> Budget
                                </TabsTrigger>
                                <TabsTrigger value="receipts" className="text-muted-foreground data-[state=active]:text-dept-royalties data-[state=active]:bg-transparent border-b-2 border-transparent data-[state=active]:border-dept-royalties rounded-none px-0 h-full font-bold transition-all flex items-center gap-2 text-xs whitespace-nowrap">
                                    <Camera size={14} /> Receipt OCR
                                </TabsTrigger>
                            </TabsList>
                        </div>

                        <div className="flex-1 overflow-y-auto custom-scrollbar">
                            <div className="p-4 md:p-6">
                                <TabsContent value="earnings" className="mt-0 outline-none">
                                    <ModuleErrorBoundary moduleName="Finance / Earnings">
                                        <EarningsDashboard />
                                    </ModuleErrorBoundary>
                                </TabsContent>
                                <TabsContent value="expenses" className="mt-0 outline-none">
                                    <ModuleErrorBoundary moduleName="Finance / Expenses">
                                        <ExpenseTracker />
                                    </ModuleErrorBoundary>
                                </TabsContent>
                                <TabsContent value="merch" className="mt-0 outline-none">
                                    <ModuleErrorBoundary moduleName="Finance / Merchandise">
                                        <MerchandiseDashboard />
                                    </ModuleErrorBoundary>
                                </TabsContent>
                                <TabsContent value="royalties" className="mt-0 outline-none">
                                    <ModuleErrorBoundary moduleName="Finance / Royalties">
                                        <RoyaltiesPrediction />
                                    </ModuleErrorBoundary>
                                </TabsContent>
                                <TabsContent value="currency" className="mt-0 outline-none">
                                    <ModuleErrorBoundary moduleName="Finance / Currency">
                                        <MultiCurrencyLedger />
                                    </ModuleErrorBoundary>
                                </TabsContent>
                                <TabsContent value="splits" className="mt-0 outline-none">
                                    <ModuleErrorBoundary moduleName="Finance / Splits">
                                        <SplitSheetEscrow />
                                    </ModuleErrorBoundary>
                                </TabsContent>
                                <TabsContent value="onboarding" className="mt-0 outline-none">
                                    <ModuleErrorBoundary moduleName="Finance / Stripe Onboarding">
                                        <StripeConnectOnboarding />
                                    </ModuleErrorBoundary>
                                </TabsContent>
                                <TabsContent value="tax" className="mt-0 outline-none">
                                    <ModuleErrorBoundary moduleName="Finance / Tax">
                                        <TaxFormCollection />
                                    </ModuleErrorBoundary>
                                </TabsContent>
                                <TabsContent value="anomaly" className="mt-0 outline-none">
                                    <ModuleErrorBoundary moduleName="Finance / Anomaly Detection">
                                        <AnomalyDetector />
                                    </ModuleErrorBoundary>
                                </TabsContent>
                                <TabsContent value="audit" className="mt-0 outline-none">
                                    <ModuleErrorBoundary moduleName="Finance / Audit Logs">
                                        <AuditLogsPanel />
                                    </ModuleErrorBoundary>
                                </TabsContent>
                                <TabsContent value="budget" className="mt-0 outline-none">
                                    <ModuleErrorBoundary moduleName="Finance / Budget">
                                        <BudgetVsActuals />
                                    </ModuleErrorBoundary>
                                </TabsContent>
                                <TabsContent value="receipts" className="mt-0 outline-none">
                                    <ModuleErrorBoundary moduleName="Finance / Receipts">
                                        <ReceiptOCR />
                                    </ModuleErrorBoundary>
                                </TabsContent>
                            </div>
                        </div>
                    </Tabs>
                </div>

                {/* ── RIGHT PANEL — Forecast & Alerts ─────────────────── */}
                <aside className="hidden lg:flex w-72 2xl:w-80 flex-col border-l border-white/5 overflow-y-auto p-3 gap-3 flex-shrink-0">
                    <RevenueForecastPanel />
                    <ExpenseBreakdownPanel />
                    <AlertsPanel />
                </aside>
            </div>
        </ModuleErrorBoundary>
    );
}

/* ================================================================== */
/*  Left Panel Widgets                                                  */
/* ================================================================== */

function QuickStatsPanel() {
    const stats = [
        { label: 'Total Revenue', value: '$12,450', icon: DollarSign, change: '+12%', positive: true },
        { label: 'Net Income', value: '$8,230', icon: ArrowUpRight, change: '+8%', positive: true },
        { label: 'Pending Payouts', value: '$2,100', icon: Wallet, change: '3 pending', positive: true },
    ];

    return (
        <div className="rounded-xl bg-white/[0.02] border border-white/5 p-3">
            <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3 px-1">Quick Stats</h3>
            <div className="space-y-2">
                {stats.map((s) => (
                    <div key={s.label} className="flex items-center gap-3 p-2.5 rounded-lg bg-white/[0.02] hover:bg-white/[0.04] transition-colors">
                        <div className="w-8 h-8 rounded-lg bg-dept-royalties/10 flex items-center justify-center flex-shrink-0">
                            <s.icon size={14} className="text-dept-royalties" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold text-white truncate">{s.value}</p>
                            <p className="text-[10px] text-gray-500">{s.label}</p>
                        </div>
                        <span className={`text-[10px] font-bold ${s.positive ? 'text-green-400' : 'text-red-400'}`}>
                            {s.change}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
}

function RecentTransactionsPanel() {
    const txns = [
        { label: 'Spotify Royalty', amount: '+$342.50', time: '2h ago', positive: true },
        { label: 'Studio Session', amount: '-$150.00', time: '5h ago', positive: false },
        { label: 'Apple Music Payout', amount: '+$128.00', time: '1d ago', positive: true },
        { label: 'Mixing Fee', amount: '-$200.00', time: '2d ago', positive: false },
        { label: 'YouTube Revenue', amount: '+$89.30', time: '3d ago', positive: true },
    ];

    return (
        <div className="rounded-xl bg-white/[0.02] border border-white/5 p-3">
            <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3 px-1">Recent Transactions</h3>
            <div className="space-y-1">
                {txns.map((t, i) => (
                    <div key={i} className="flex items-center justify-between py-2 px-2 rounded-lg hover:bg-white/[0.02] transition-colors">
                        <div className="flex items-center gap-2 min-w-0">
                            <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${t.positive ? 'bg-green-500' : 'bg-red-400'}`} />
                            <div className="min-w-0">
                                <p className="text-xs text-white truncate">{t.label}</p>
                                <p className="text-[10px] text-gray-600">{t.time}</p>
                            </div>
                        </div>
                        <span className={`text-xs font-bold flex-shrink-0 ${t.positive ? 'text-green-400' : 'text-red-400'}`}>
                            {t.amount}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
}

function TaxSummaryPanel() {
    return (
        <div className="rounded-xl bg-white/[0.02] border border-white/5 p-3">
            <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3 px-1">Tax Estimate</h3>
            <div className="p-3 rounded-lg bg-amber-500/5 border border-amber-500/10">
                <div className="flex items-center gap-2 mb-2">
                    <PiggyBank size={14} className="text-amber-400" />
                    <span className="text-xs font-bold text-amber-400">Q1 2026</span>
                </div>
                <p className="text-xl font-black text-white mb-1">$1,845</p>
                <p className="text-[10px] text-gray-500">Estimated quarterly liability</p>
                <div className="flex items-center gap-1.5 mt-2 text-[10px] text-amber-400/70">
                    <Calendar size={10} />
                    <span>Due Apr 15, 2026</span>
                </div>
            </div>
        </div>
    );
}

/* ================================================================== */
/*  Right Panel Widgets                                                 */
/* ================================================================== */

function RevenueForecastPanel() {
    const periods = [
        { label: '30 Day', value: '$4,200', trend: '+15%' },
        { label: '60 Day', value: '$8,800', trend: '+22%' },
        { label: '90 Day', value: '$14,100', trend: '+28%' },
    ];

    return (
        <div className="rounded-xl bg-white/[0.02] border border-white/5 p-3">
            <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3 px-1">Revenue Forecast</h3>
            <div className="space-y-2">
                {periods.map((p) => (
                    <div key={p.label} className="p-3 rounded-lg bg-white/[0.02]">
                        <div className="flex items-center justify-between mb-1">
                            <span className="text-[10px] text-gray-500 font-bold">{p.label}</span>
                            <span className="text-[10px] text-green-400 font-bold">{p.trend}</span>
                        </div>
                        <p className="text-lg font-black text-white">{p.value}</p>
                        {/* Mini progress bar */}
                        <div className="w-full h-1 bg-white/5 rounded-full mt-2 overflow-hidden">
                            <motion.div
                                className="h-full bg-gradient-to-r from-dept-royalties to-dept-royalties-glow rounded-full"
                                initial={{ width: 0 }}
                                animate={{ width: p.label === '30 Day' ? '35%' : p.label === '60 Day' ? '65%' : '90%' }}
                                transition={{ duration: 1, delay: 0.3 }}
                            />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

function ExpenseBreakdownPanel() {
    const categories = [
        { label: 'Production', pct: 45, color: 'bg-purple-500' },
        { label: 'Marketing', pct: 25, color: 'bg-blue-500' },
        { label: 'Distribution', pct: 15, color: 'bg-emerald-500' },
        { label: 'Other', pct: 15, color: 'bg-gray-500' },
    ];

    return (
        <div className="rounded-xl bg-white/[0.02] border border-white/5 p-3">
            <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3 px-1">Expense Breakdown</h3>
            <div className="space-y-2.5">
                {categories.map((c) => (
                    <div key={c.label}>
                        <div className="flex items-center justify-between mb-1">
                            <span className="text-xs text-gray-300">{c.label}</span>
                            <span className="text-xs font-bold text-white">{c.pct}%</span>
                        </div>
                        <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                            <motion.div
                                className={`h-full ${c.color} rounded-full`}
                                initial={{ width: 0 }}
                                animate={{ width: `${c.pct}%` }}
                                transition={{ duration: 0.8, delay: 0.2 }}
                            />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

function AlertsPanel() {
    const alerts = [
        { text: 'Tax deadline in 52 days', level: 'warn' as const },
        { text: 'Spotify payout processed', level: 'info' as const },
        { text: 'Large expense flagged ($500+)', level: 'warn' as const },
    ];

    return (
        <div className="rounded-xl bg-white/[0.02] border border-white/5 p-3">
            <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3 px-1">Alerts</h3>
            <div className="space-y-2">
                {alerts.map((a, i) => (
                    <div
                        key={i}
                        className={`flex items-start gap-2 p-2.5 rounded-lg text-xs ${a.level === 'warn'
                            ? 'bg-amber-500/5 border border-amber-500/10 text-amber-300'
                            : 'bg-blue-500/5 border border-blue-500/10 text-blue-300'
                            }`}
                    >
                        <AlertTriangle size={12} className="flex-shrink-0 mt-0.5" />
                        <span>{a.text}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}
