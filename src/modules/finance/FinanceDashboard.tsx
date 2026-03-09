import React, { useMemo } from 'react';
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
import { useFinance } from './hooks/useFinance';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { motion } from 'motion/react';
import { ModuleErrorBoundary } from '@/core/components/ModuleErrorBoundary';
import {
    Briefcase, CreditCard, ShoppingBag, TrendingUp,
    DollarSign, ArrowUpRight, Wallet,
    AlertTriangle, Calendar, PiggyBank, Globe, Users,
    FileText, Activity, Shield, Camera, GitMerge, Loader2
} from 'lucide-react';
import type { EarningsSummary } from '@/services/revenue/schema';
import type { Expense } from './schemas';

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
/*                                                                     */
/*  ALL DATA is sourced from Firestore via useFinance() hook.          */
/*  Zero hardcoded values. Empty states shown when no data present.    */
/* ================================================================== */

export default function FinanceDashboard() {
    const {
        earningsSummary,
        earningsLoading,
        expenses,
        expensesLoading,
    } = useFinance();

    return (
        <ModuleErrorBoundary moduleName="Finance">
            <div className="absolute inset-0 flex">
                {/* ── LEFT PANEL — Quick Stats & Summary ──────────────── */}
                <aside className="hidden lg:flex w-64 xl:w-72 2xl:w-80 flex-col border-r border-white/5 overflow-y-auto p-3 gap-3 flex-shrink-0">
                    <QuickStatsPanel
                        earningsSummary={earningsSummary}
                        expenses={expenses}
                        loading={earningsLoading}
                    />
                    <RecentTransactionsPanel
                        earningsSummary={earningsSummary}
                        expenses={expenses}
                        loading={earningsLoading || expensesLoading}
                    />
                    <TaxSummaryPanel
                        earningsSummary={earningsSummary}
                        expenses={expenses}
                        loading={earningsLoading}
                    />
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

                {/* ── RIGHT PANEL — Revenue Breakdown & Alerts ──────────── */}
                <aside className="hidden lg:flex w-72 2xl:w-80 flex-col border-l border-white/5 overflow-y-auto p-3 gap-3 flex-shrink-0">
                    <RevenueByPlatformPanel
                        earningsSummary={earningsSummary}
                        loading={earningsLoading}
                    />
                    <ExpenseBreakdownPanel
                        expenses={expenses}
                        loading={expensesLoading}
                    />
                    <AlertsPanel
                        earningsSummary={earningsSummary}
                        expenses={expenses}
                    />
                </aside>
            </div>
        </ModuleErrorBoundary>
    );
}

/* ================================================================== */
/*  Utility                                                             */
/* ================================================================== */

function formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
    }).format(amount);
}

function formatRelativeTime(dateStr: string): string {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60_000);
    const diffHours = Math.floor(diffMs / 3_600_000);
    const diffDays = Math.floor(diffMs / 86_400_000);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 30) return `${diffDays}d ago`;
    return date.toLocaleDateString();
}

function LoadingSpinner() {
    return (
        <div className="flex items-center justify-center py-4">
            <Loader2 size={16} className="animate-spin text-gray-500" />
        </div>
    );
}

function EmptyState({ message }: { message: string }) {
    return (
        <div className="text-center py-4 px-2">
            <p className="text-[10px] text-gray-600">{message}</p>
        </div>
    );
}

/* ================================================================== */
/*  Left Panel Widgets — Data from Firestore                            */
/* ================================================================== */

interface QuickStatsPanelProps {
    earningsSummary: EarningsSummary | null;
    expenses: Expense[];
    loading: boolean;
}

function QuickStatsPanel({ earningsSummary, expenses, loading }: QuickStatsPanelProps) {
    const totalRevenue = earningsSummary?.totalGrossRevenue ?? 0;
    const totalExpenses = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);
    const netIncome = totalRevenue - totalExpenses;
    const pendingCount = earningsSummary?.byPlatform?.filter(p => p.revenue === 0).length ?? 0;

    const stats = [
        { label: 'Total Revenue', value: formatCurrency(totalRevenue), icon: DollarSign, change: earningsSummary ? `${earningsSummary.totalStreams.toLocaleString()} streams` : 'No data', positive: totalRevenue > 0 },
        { label: 'Net Income', value: formatCurrency(netIncome), icon: ArrowUpRight, change: totalExpenses > 0 ? `${formatCurrency(totalExpenses)} expenses` : 'No expenses', positive: netIncome > 0 },
        { label: 'Pending Payouts', value: pendingCount > 0 ? `${pendingCount} pending` : 'None', icon: Wallet, change: earningsSummary?.currencyCode ?? 'USD', positive: true },
    ];

    return (
        <div className="rounded-xl bg-white/[0.02] border border-white/5 p-3">
            <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3 px-1">Quick Stats</h3>
            {loading ? <LoadingSpinner /> : (
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
            )}
        </div>
    );
}

interface RecentTransactionsPanelProps {
    earningsSummary: EarningsSummary | null;
    expenses: Expense[];
    loading: boolean;
}

function RecentTransactionsPanel({ earningsSummary, expenses, loading }: RecentTransactionsPanelProps) {
    // Merge platform earnings and recent expenses into a unified transaction feed
    const transactions = useMemo(() => {
        const items: Array<{ label: string; amount: string; time: string; positive: boolean }> = [];

        // Add platform earnings as "income" transactions
        if (earningsSummary?.byPlatform) {
            for (const platform of earningsSummary.byPlatform) {
                if (platform.revenue > 0) {
                    items.push({
                        label: `${platform.platformName} Revenue`,
                        amount: `+${formatCurrency(platform.revenue)}`,
                        time: earningsSummary.period?.endDate
                            ? formatRelativeTime(earningsSummary.period.endDate)
                            : 'Recent',
                        positive: true,
                    });
                }
            }
        }

        // Add recent expenses as "outgoing" transactions
        for (const expense of expenses.slice(0, 5)) {
            items.push({
                label: expense.vendor || expense.category || 'Expense',
                amount: `-${formatCurrency(expense.amount)}`,
                time: expense.createdAt ? formatRelativeTime(expense.createdAt) : expense.date || 'Unknown',
                positive: false,
            });
        }

        // Sort by most recent (income first since we don't have exact timestamps for platforms)
        return items.slice(0, 8);
    }, [earningsSummary, expenses]);

    return (
        <div className="rounded-xl bg-white/[0.02] border border-white/5 p-3">
            <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3 px-1">Recent Transactions</h3>
            {loading ? <LoadingSpinner /> : transactions.length === 0 ? (
                <EmptyState message="No transactions yet. Earnings and expenses will appear here." />
            ) : (
                <div className="space-y-1">
                    {transactions.map((t, i) => (
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
            )}
        </div>
    );
}

interface TaxSummaryPanelProps {
    earningsSummary: EarningsSummary | null;
    expenses: Expense[];
    loading: boolean;
}

function TaxSummaryPanel({ earningsSummary, expenses, loading }: TaxSummaryPanelProps) {
    // Compute estimated tax from real income data
    // Self-employment tax estimate: ~15.3% SE tax + ~12% income tax bracket estimate = ~27%
    const totalRevenue = earningsSummary?.totalGrossRevenue ?? 0;
    const totalExpenses = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);
    const taxableIncome = Math.max(0, totalRevenue - totalExpenses);
    const estimatedTaxRate = 0.27; // Rough SE + income tax estimate
    const estimatedTax = Math.round(taxableIncome * estimatedTaxRate);

    // Compute current quarter
    const now = new Date();
    const quarter = Math.ceil((now.getMonth() + 1) / 3);
    const year = now.getFullYear();
    const quarterLabels = ['Q1', 'Q2', 'Q3', 'Q4'];
    const quarterDueDates = [
        `Apr 15, ${year}`,
        `Jun 15, ${year}`,
        `Sep 15, ${year}`,
        `Jan 15, ${year + 1}`,
    ];

    // Days until next quarterly deadline
    const dueDateStr = quarterDueDates[quarter - 1];
    const dueDate = new Date(dueDateStr);
    const daysUntilDue = Math.max(0, Math.ceil((dueDate.getTime() - now.getTime()) / 86_400_000));

    return (
        <div className="rounded-xl bg-white/[0.02] border border-white/5 p-3">
            <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3 px-1">Tax Estimate</h3>
            {loading ? <LoadingSpinner /> : taxableIncome === 0 ? (
                <EmptyState message="Add earnings and expenses to see your estimated quarterly tax." />
            ) : (
                <div className="p-3 rounded-lg bg-amber-500/5 border border-amber-500/10">
                    <div className="flex items-center gap-2 mb-2">
                        <PiggyBank size={14} className="text-amber-400" />
                        <span className="text-xs font-bold text-amber-400">{quarterLabels[quarter - 1]} {year}</span>
                    </div>
                    <p className="text-xl font-black text-white mb-1">{formatCurrency(estimatedTax)}</p>
                    <p className="text-[10px] text-gray-500">Estimated quarterly liability</p>
                    <div className="flex items-center gap-1.5 mt-2 text-[10px] text-amber-400/70">
                        <Calendar size={10} />
                        <span>Due {dueDateStr} ({daysUntilDue} days)</span>
                    </div>
                </div>
            )}
        </div>
    );
}

/* ================================================================== */
/*  Right Panel Widgets — Data from Firestore                           */
/* ================================================================== */

interface RevenueByPlatformPanelProps {
    earningsSummary: EarningsSummary | null;
    loading: boolean;
}

function RevenueByPlatformPanel({ earningsSummary, loading }: RevenueByPlatformPanelProps) {
    const platforms = earningsSummary?.byPlatform ?? [];
    const totalRevenue = earningsSummary?.totalGrossRevenue ?? 0;

    return (
        <div className="rounded-xl bg-white/[0.02] border border-white/5 p-3">
            <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3 px-1">Revenue by Platform</h3>
            {loading ? <LoadingSpinner /> : platforms.length === 0 ? (
                <EmptyState message="No platform earnings data yet. Connect your distributor to see revenue breakdown." />
            ) : (
                <div className="space-y-2">
                    {platforms.map((p) => {
                        const percentage = totalRevenue > 0 ? Math.round((p.revenue / totalRevenue) * 100) : 0;
                        return (
                            <div key={p.platformName} className="p-3 rounded-lg bg-white/[0.02]">
                                <div className="flex items-center justify-between mb-1">
                                    <span className="text-xs text-gray-300 truncate">{p.platformName}</span>
                                    <span className="text-[10px] text-green-400 font-bold">{percentage}%</span>
                                </div>
                                <p className="text-lg font-black text-white">{formatCurrency(p.revenue)}</p>
                                <p className="text-[10px] text-gray-600 mt-0.5">
                                    {p.streams.toLocaleString()} streams · {p.downloads.toLocaleString()} downloads
                                </p>
                                <div className="w-full h-1 bg-white/5 rounded-full mt-2 overflow-hidden">
                                    <motion.div
                                        className="h-full bg-gradient-to-r from-dept-royalties to-dept-royalties-glow rounded-full"
                                        initial={{ width: 0 }}
                                        animate={{ width: `${percentage}%` }}
                                        transition={{ duration: 1, delay: 0.3 }}
                                    />
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

interface ExpenseBreakdownPanelProps {
    expenses: Expense[];
    loading: boolean;
}

function ExpenseBreakdownPanel({ expenses, loading }: ExpenseBreakdownPanelProps) {
    // Group expenses by category from real data
    const breakdown = useMemo(() => {
        if (expenses.length === 0) return [];

        const byCategory: Record<string, number> = {};
        let total = 0;

        for (const expense of expenses) {
            const cat = expense.category || 'Other';
            byCategory[cat] = (byCategory[cat] || 0) + expense.amount;
            total += expense.amount;
        }

        const colorMap: Record<string, string> = {
            'Equipment': 'bg-purple-500',
            'Software / Plugins': 'bg-blue-500',
            'Marketing': 'bg-cyan-500',
            'Travel': 'bg-emerald-500',
            'Services': 'bg-orange-500',
            'Other': 'bg-gray-500',
        };

        return Object.entries(byCategory)
            .sort(([, a], [, b]) => b - a)
            .map(([label, amount]) => ({
                label,
                pct: total > 0 ? Math.round((amount / total) * 100) : 0,
                color: colorMap[label] || 'bg-gray-500',
            }));
    }, [expenses]);

    return (
        <div className="rounded-xl bg-white/[0.02] border border-white/5 p-3">
            <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3 px-1">Expense Breakdown</h3>
            {loading ? <LoadingSpinner /> : breakdown.length === 0 ? (
                <EmptyState message="No expenses recorded. Add expenses to see your spending breakdown." />
            ) : (
                <div className="space-y-2.5">
                    {breakdown.map((c) => (
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
            )}
        </div>
    );
}

interface AlertsPanelProps {
    earningsSummary: EarningsSummary | null;
    expenses: Expense[];
}

function AlertsPanel({ earningsSummary, expenses }: AlertsPanelProps) {
    // Generate alerts from real data conditions
    const alerts = useMemo(() => {
        const result: Array<{ text: string; level: 'warn' | 'info' }> = [];

        // Tax deadline alert — always relevant
        const now = new Date();
        const quarter = Math.ceil((now.getMonth() + 1) / 3);
        const year = now.getFullYear();
        const quarterDueDates = [
            new Date(`Apr 15, ${year}`),
            new Date(`Jun 15, ${year}`),
            new Date(`Sep 15, ${year}`),
            new Date(`Jan 15, ${year + 1}`),
        ];
        const dueDate = quarterDueDates[quarter - 1];
        const daysUntilDue = Math.max(0, Math.ceil((dueDate.getTime() - now.getTime()) / 86_400_000));
        if (daysUntilDue <= 90) {
            result.push({ text: `Tax deadline in ${daysUntilDue} days`, level: 'warn' });
        }

        // Large expense alert
        const largeExpenses = expenses.filter(e => e.amount >= 500);
        if (largeExpenses.length > 0) {
            result.push({
                text: `${largeExpenses.length} large expense${largeExpenses.length > 1 ? 's' : ''} flagged ($500+)`,
                level: 'warn',
            });
        }

        // Earnings data available notification
        if (earningsSummary && earningsSummary.totalGrossRevenue > 0) {
            const platformCount = earningsSummary.byPlatform?.length ?? 0;
            result.push({
                text: `Earnings data from ${platformCount} platform${platformCount !== 1 ? 's' : ''} loaded`,
                level: 'info',
            });
        }

        // No earnings data warning
        if (!earningsSummary) {
            result.push({
                text: 'No earnings reports found. Connect your distributor.',
                level: 'warn',
            });
        }

        return result;
    }, [earningsSummary, expenses]);

    if (alerts.length === 0) return null;

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
