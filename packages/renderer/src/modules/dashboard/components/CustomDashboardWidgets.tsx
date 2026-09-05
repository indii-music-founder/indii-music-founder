import React, { useState, useEffect } from 'react';
import { Logger } from '@/core/logger/Logger';
import {
    Music,
    DollarSign,
    Calendar,
    TrendingUp,
    Bot,
    Users,
    Activity,
    CheckSquare,
    ThumbsUp,
    Palette,
    ShoppingBag,
    MapPin,
    LucideIcon,
    Sparkles,
    ShieldAlert,
    ShieldCheck,
    Check,
    X,
    ChevronRight,
} from 'lucide-react';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { motion, useMotionValue, useTransform, animate, AnimatePresence } from 'motion/react';
import { revenueService, type RevenueStats } from '@/services/RevenueService';
import { useStore } from '@/core/store';
import { useShallow } from 'zustand/react/shallow';
import { AnalyticsService } from '@/services/dashboard/AnalyticsService';
import { MODEL_PRICING } from '@/core/config/intelligence-models';
import { WidgetEmptyState } from './WidgetEmptyState';
import { getColorForModule } from '@/core/theme/moduleColors';
import { timelineOrchestrator } from '@/services/timeline/TimelineOrchestratorService';
import type { Timeline } from '@/services/timeline/TimelineTypes';
import { toolApprovalService, type PendingToolApproval } from '@/services/agent/governance/ToolApprovalService';
import { useToast } from '@/core/context/ToastContext';
import type {
    DashboardRevenueStats,
    DashboardStreamsStats,
    DashboardAudienceStats,
    DashboardTopTrack,
    DashboardNextRelease,
    DashboardAgentActivity,
    DashboardActiveCampaigns,
    DashboardPendingTasks,
    DashboardSocialEngagement,
    DashboardBrandIdentity,
    DashboardMerchSales,
    DashboardTourStatus,
} from '@/services/dashboard/schema';

export type WidgetType =
    | 'streams_today'
    | 'revenue_consolidated'
    | 'revenue_mtd'
    | 'revenue_aggregated'
    | 'project_timeline'
    | 'approval_gates'
    | 'next_release'
    | 'top_track'
    | 'agent_activity'
    | 'audience_growth'
    | 'active_campaigns'
    | 'pending_tasks'
    | 'social_engagement'
    | 'brand_identity'
    | 'merch_sales'
    | 'tour_status'
    | 'cost_estimator';

export interface Widget {
    id: string;
    type: WidgetType;
    order: number;
}

export const WIDGET_DEFINITIONS: Record<WidgetType, { label: string; icon: LucideIcon; description: string; deprecated?: boolean }> = {
    streams_today: { label: 'Streams Today', icon: Music, description: 'Daily stream count across all DSPs' },
    revenue_consolidated: { label: 'Revenue & Royalties', icon: DollarSign, description: 'Consolidated gross revenue, MTD earnings and income sources' },
    project_timeline: { label: 'Project Timeline', icon: Calendar, description: 'Active rollout timeline, current phase, and milestone countdown' },
    approval_gates: { label: 'Approval Gates', icon: ShieldCheck, description: 'Pending approval gates and one-click authorization' },
    revenue_aggregated: { label: 'Revenue Aggregate', icon: TrendingUp, description: 'Total revenue from all sources', deprecated: true },
    revenue_mtd: { label: 'Revenue MTD', icon: DollarSign, description: 'Month-to-date royalty revenue', deprecated: true },
    next_release: { label: 'Next Release', icon: Calendar, description: 'Countdown to your next scheduled release' },
    top_track: { label: 'Top Track', icon: TrendingUp, description: 'Your best performing track right now' },
    agent_activity: { label: 'Agent Activity', icon: Bot, description: 'Recent Autonomous agent tasks and completions' },
    audience_growth: { label: 'Audience Growth', icon: Users, description: 'New listeners and followers across platforms' },
    active_campaigns: { label: 'Active Campaigns', icon: Activity, description: 'Currently running marketing campaigns' },
    pending_tasks: { label: 'Pending Tasks', icon: CheckSquare, description: 'Tasks requiring your attention' },
    social_engagement: { label: 'Social Engagement', icon: ThumbsUp, description: 'Likes, comments, and shares on recent posts' },
    brand_identity: { label: 'Brand Integrity', icon: Palette, description: 'Visual identity and brand compliance scores' },
    merch_sales: { label: 'Merchandise', icon: ShoppingBag, description: 'Recent sales and inventory alerts' },
    tour_status: { label: 'Tour & Shows', icon: MapPin, description: 'Ticket sales and upcoming tour dates' },
    cost_estimator: { label: 'Cost Estimator', icon: DollarSign, description: 'Estimate API costs for generative intelligence' },
};

export const DEFAULT_WIDGETS: Widget[] = [
    { id: 'w1', type: 'streams_today', order: 0 },
    { id: 'w2', type: 'revenue_consolidated', order: 1 },
    { id: 'w3', type: 'project_timeline', order: 2 },
    { id: 'w4', type: 'approval_gates', order: 3 },
    { id: 'w5', type: 'next_release', order: 4 },
    { id: 'w6', type: 'active_campaigns', order: 5 },
    { id: 'w7', type: 'cost_estimator', order: 6 },
];

export const STORAGE_KEY = 'indii_custom_dashboard_widgets';

export function migrateWidgets(savedWidgets: Widget[]): Widget[] {
    const hasConsolidatedRevenue = savedWidgets.some((w) => w.type === 'revenue_consolidated');

    let migrated: Widget[] = [];

    // If has legacy revenue but not consolidated, replace the first legacy revenue with consolidated
    let replacedRevenue = false;
    for (const w of savedWidgets) {
        if (w.type === 'revenue_aggregated' || w.type === 'revenue_mtd') {
            if (!hasConsolidatedRevenue && !replacedRevenue) {
                migrated.push({ id: w.id, type: 'revenue_consolidated', order: w.order });
                replacedRevenue = true;
            }
            continue;
        }
        migrated.push(w);
    }

    // Ensure project_timeline is present
    if (!migrated.some((w) => w.type === 'project_timeline')) {
        migrated.push({ id: 'w_project_timeline', type: 'project_timeline', order: 2 });
    }

    // Ensure approval_gates is present
    if (!migrated.some((w) => w.type === 'approval_gates')) {
        migrated.push({ id: 'w_approval_gates', type: 'approval_gates', order: 3 });
    }

    // Deduplicate by widget type
    const seen = new Set<WidgetType>();
    migrated = migrated.filter((w) => {
        if (seen.has(w.type)) return false;
        seen.add(w.type);
        return true;
    });

    // Re-index orders sequentially
    migrated.sort((a, b) => a.order - b.order);
    migrated = migrated.map((w, index) => ({ ...w, order: index }));

    return migrated;
}

export function loadWidgets(): Widget[] {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            const parsed = JSON.parse(saved) as Widget[];
            if (Array.isArray(parsed) && parsed.length > 0) {
                const migrated = migrateWidgets(parsed);
                try {
                    localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
                } catch {
                    // ignore storage errors
                }
                return migrated;
            }
        }
    } catch {
        // ignore
    }
    return DEFAULT_WIDGETS;
}

function formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(amount);
}

/**
 * Dashboard documents and aggregate queries are owner-scoped by Firebase Auth.
 * Wait for the live auth listener before subscribing so persisted store state
 * cannot issue a stale or pre-auth request that never retries.
 */
function useAuthenticatedUserId(): string | undefined {
    return useStore((state) => state.authLoading ? undefined : state.user?.uid);
}

/* ── Components ─────────────────────────────────────────────────── */

// eslint-disable-next-line react-refresh/only-export-components
function CountUp({ value, duration = 2, formatter = (v: number) => Math.floor(v).toLocaleString('en-US') }: { value: number; duration?: number; formatter?: (v: number) => string }) {
    const motionValue = useMotionValue(0);
    const rounded = useTransform(motionValue, (latest: number) => formatter(latest));
    const [displayValue, setDisplayValue] = useState("0");

    useEffect(() => {
        const controls = animate(motionValue, value, { duration, ease: "easeOut" });
        return controls.stop;
    }, [value, duration, motionValue]);

    useEffect(() => {
        return rounded.on("change", (latest: string) => setDisplayValue(latest));
    }, [rounded]);

    return <span>{displayValue}</span>;
}

// eslint-disable-next-line react-refresh/only-export-components
function CircularProgress({ percentage, size = 80, strokeWidth = 8, color = "currentColor" }: { percentage: number; size?: number; strokeWidth?: number; color?: string }) {
    const radius = (size - strokeWidth) / 2;
    const circumference = radius * 2 * Math.PI;
    const offset = circumference - (percentage / 100) * circumference;

    return (
        <div className="relative" style={{ width: size, height: size }}>
            <svg width={size} height={size} className="rotate-[-90deg]">
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    stroke="currentColor"
                    strokeWidth={strokeWidth}
                    fill="transparent"
                    className="text-white/5"
                />
                <motion.circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    stroke={color}
                    strokeWidth={strokeWidth}
                    fill="transparent"
                    strokeDasharray={circumference}
                    initial={{ strokeDashoffset: circumference }}
                    animate={{ strokeDashoffset: offset }}
                    transition={{ duration: 1.5, ease: "easeInOut" }}
                    strokeLinecap="round"
                />
            </svg>
        </div>
    );
}

/* ── Individual Widget Content ─────────────────────────────────────── */

// eslint-disable-next-line react-refresh/only-export-components
function StreamsTodayWidget() {
    const userId = useAuthenticatedUserId();
    const [streamsData, setStreamsData] = useState<DashboardStreamsStats | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!userId) return;

        const unsubscribe = AnalyticsService.subscribeToDashboardStreams(
            userId,
            (data) => {
                setStreamsData(data);
                setIsLoading(false);
            },
            () => {
                setStreamsData(AnalyticsService.getStreamsZeroState());
                setIsLoading(false);
            }
        );

        return () => unsubscribe();
    }, [userId]);

    const displayValue = streamsData?.streamsToday.formatted || '--';
    const weeklyStreams = streamsData?.weeklyStreams || [0, 0, 0, 0, 0, 0, 0];
    const maxVal = Math.max(...weeklyStreams, 100);

    // ISSUE-1291: a bold `0` under "TOTAL DSP PERFORMANCE" reads as failure and is
    // indistinguishable from a broken widget. Say what this becomes instead.
    const hasStreams = !isLoading && (parseInt(displayValue.replace(/,/g, '')) || 0) > 0;
    if (!isLoading && !hasStreams) {
        return (
            <WidgetEmptyState
                icon={Music}
                label="Live Streams"
                promise="Your daily play counts across every DSP land here once a release goes live."
                ctaLabel="Build a release"
                ctaModule="distribution"
            />
        );
    }

    return (
        <div className="flex flex-col h-full justify-between group/widget">
            <div>
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-green-500/20 flex items-center justify-center border border-green-500/30 shadow-[0_0_15px_rgba(168,85,247,0.2)] group-hover/widget:bg-green-500 group-hover/widget:text-black transition-all duration-500">
                            <Music size={18} className="group-hover/widget:scale-110 transition-transform" />
                        </div>
                        <span className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em]">Live Streams</span>
                    </div>
                    <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="text-[8px] font-black text-emerald-400 uppercase tracking-widest">Live</span>
                    </div>
                </div>
                
                <div className="space-y-1">
                    <p className={`text-5xl font-black text-white tracking-tighter ${isLoading ? 'animate-pulse opacity-50' : ''}`}>
                        {isLoading ? displayValue : <CountUp value={parseInt(displayValue.replace(/,/g, '')) || 0} />}
                    </p>
                    <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Total DSP performance</p>
                </div>
            </div>

            <div className="mt-6 flex items-end gap-1.5 h-12">
                {weeklyStreams.map((val, i) => (
                    <motion.div
                        key={i}
                        initial={{ height: 0 }}
                        animate={{ height: `${Math.max(8, (val / maxVal) * 100)}%` }}
                        transition={{ delay: i * 0.05, duration: 0.5, ease: "easeOut" }}
                        className="flex-1 rounded-t-sm bg-linear-to-t from-green-500/5 to-green-500/40 group-hover/widget:to-green-400 transition-colors relative"
                    >
                        <div className="absolute inset-x-0 top-0 h-[1px] bg-green-300/40" />
                    </motion.div>
                ))}
            </div>
        </div>
    );
}

// eslint-disable-next-line react-refresh/only-export-components
function RevenueMTDWidget() {
    const userId = useAuthenticatedUserId();
    const [revenueData, setRevenueData] = useState<DashboardRevenueStats | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!userId) return;

        const unsubscribe = AnalyticsService.subscribeToDashboardRevenue(
            userId,
            (data) => {
                setRevenueData(data);
                setIsLoading(false);
            },
            () => {
                setRevenueData(AnalyticsService.getRevenueZeroState());
                setIsLoading(false);
            }
        );

        return () => unsubscribe();
    }, [userId]);

    const now = new Date();
    const monthName = now.toLocaleString('default', { month: 'long' });

    const displayValue = revenueData?.mtdRevenue.formatted || '--';
    const growth = '--';

    return (
        <div className="flex flex-col h-full justify-between group/widget">
            <div>
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-green-500/20 flex items-center justify-center border border-green-500/30 shadow-[0_0_15px_rgba(34,197,94,0.2)] group-hover/widget:bg-green-500 group-hover/widget:text-black transition-all duration-500">
                            <DollarSign size={20} className="group-hover/widget:rotate-12 transition-transform" />
                        </div>
                        <span className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em]">Royalties</span>
                    </div>
                    <span className="text-[9px] font-black text-green-400 uppercase tracking-widest bg-green-400/10 px-2 py-1 rounded-lg border border-green-400/20">
                        {growth}
                    </span>
                </div>
                
                <div className="space-y-1">
                    <p className={`text-5xl font-black text-white tracking-tighter ${isLoading ? 'animate-pulse opacity-50' : ''}`}>
                        {isLoading ? displayValue : <CountUp value={parseFloat(displayValue.replace(/[^0-9.]/g, '')) || 0} formatter={formatCurrency} />}
                    </p>
                    <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">{monthName} Earnings</p>
                </div>
            </div>

            <div className="mt-6 pt-4 border-t border-white/5 flex items-center justify-between">
                <div className="flex flex-col">
                    <span className="text-[8px] font-black text-white/20 uppercase tracking-widest">Next Payout</span>
                    <span className="text-xs font-bold text-white/60">Not scheduled</span>
                </div>
                <div className="w-12 h-6 rounded-md bg-white/5 border border-white/10 flex items-center justify-center overflow-hidden">
                    <div className="w-full h-full bg-linear-to-r from-green-500/20 to-emerald-500/40 animate-pulse" />
                </div>
            </div>
        </div>
    );
}

// eslint-disable-next-line react-refresh/only-export-components
function NextReleaseWidget() {
    const userId = useAuthenticatedUserId();
    const [release, setRelease] = useState<DashboardNextRelease | null | undefined>(undefined);
    const [now, setNow] = useState<number>(() => Date.now());

    useEffect(() => {
        const id = setInterval(() => setNow(Date.now()), 60_000);
        return () => clearInterval(id);
    }, []);

    useEffect(() => {
        if (!userId) return;
        const unsub = AnalyticsService.subscribeToNextRelease(
            userId,
            (d) => setRelease(d),
        );
        return () => unsub();
    }, [userId]);

    const isLoading = release === undefined;

    const countdown = (() => {
        if (!release) return null;
        const ms = release.releaseDate - now;
        if (ms <= 0) return { days: 0, hours: 0, text: 'Today' };
        const days = Math.floor(ms / 86_400_000);
        const hours = Math.floor((ms % 86_400_000) / 3_600_000);
        return { days, hours, text: days > 0 ? `${days}D ${hours}H` : `${hours}H` };
    })();

    const statusColors: Record<string, string> = {
        draft: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
        submitted: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
        approved: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
        live: 'bg-green-500/20 text-green-400 border-green-400/30',
    };

    return (
        <div className="flex flex-col h-full justify-between group/widget">
            <div>
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center border border-blue-500/30 shadow-[0_0_15px_rgba(59,130,246,0.2)] group-hover/widget:bg-blue-500 group-hover/widget:text-black transition-all duration-500">
                        <Calendar size={18} className="group-hover/widget:scale-110 transition-transform" />
                    </div>
                    <span className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em]">Deployment</span>
                </div>

                {isLoading ? (
                    <div className="flex-1 flex items-center justify-center h-24">
                        <div className="w-6 h-6 rounded-full border-2 border-blue-500/30 border-t-blue-400 animate-spin" />
                    </div>
                ) : release === null ? (
                    <div className="space-y-4">
                        <p className="text-4xl font-black text-white/10 tracking-tighter italic uppercase">Zero State</p>
                        <button className="w-full py-2.5 rounded-xl border border-dashed border-white/10 text-[10px] font-black text-white/40 uppercase tracking-widest hover:bg-white/5 hover:text-white transition-all">
                            Initialize Release
                        </button>
                    </div>
                ) : (
                    <div className="flex items-center gap-6">
                        <CircularProgress 
                            percentage={75} 
                            size={84} 
                            strokeWidth={10} 
                            color="#3b82f6" 
                        />
                        <div className="space-y-1">
                            <p className="text-4xl font-black text-white tracking-tighter">
                                {countdown?.text}
                            </p>
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider truncate max-w-[100px]">
                                    {release.title}
                                </span>
                            </div>
                            <span className={`inline-block text-[7px] font-black px-1.5 py-0.5 rounded border uppercase tracking-widest ${statusColors[release.status]}`}>
                                {release.status}
                            </span>
                        </div>
                    </div>
                )}
            </div>

            {release && (
                <div className="mt-6 flex items-center gap-3">
                    <div className="flex -space-x-2">
                        {[1, 2, 3].map((i) => (
                            <div key={i} className="w-6 h-6 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-[8px] font-black">
                                {i}
                            </div>
                        ))}
                    </div>
                    <span className="text-[9px] font-bold text-white/30 uppercase tracking-widest">
                        Distributing to {release.distributors.length} DSPs
                    </span>
                </div>
            )}
        </div>
    );
}

// eslint-disable-next-line react-refresh/only-export-components
function TopTrackWidget() {
    const userId = useAuthenticatedUserId();
    const [track, setTrack] = useState<DashboardTopTrack | null | undefined>(undefined);

    useEffect(() => {
        if (!userId) return;
        const unsub = AnalyticsService.subscribeToTopTrack(
            userId,
            (d) => setTrack(d),
        );
        return () => unsub();
    }, [userId]);

    const isLoading = track === undefined;

    return (
        <div className="flex flex-col h-full justify-between group/widget">
            <div>
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center border border-amber-500/30 shadow-[0_0_15px_rgba(245,158,11,0.2)] group-hover/widget:bg-amber-500 group-hover/widget:text-black transition-all duration-500">
                        <TrendingUp size={18} className="group-hover/widget:-translate-y-0.5 transition-transform" />
                    </div>
                    <span className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em]">Alpha Asset</span>
                </div>

                {isLoading ? (
                    <div className="flex-1 flex items-center justify-center h-24">
                        <div className="w-6 h-6 rounded-full border-2 border-amber-500/30 border-t-amber-400 animate-spin" />
                    </div>
                ) : track === null ? (
                    <div className="py-4">
                        <p className="text-xs font-bold text-white/20 uppercase tracking-[0.2em]">No performance data</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        <p className="text-xl font-black text-white uppercase tracking-tight truncate" title={track.title}>
                            {track.title}
                        </p>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-0.5">
                                <span className="text-[8px] font-black text-white/20 uppercase tracking-widest">Momentum</span>
                                <p className="text-sm font-black text-emerald-400">{track.streams.formatted}</p>
                            </div>
                            <div className="space-y-0.5">
                                <span className="text-[8px] font-black text-white/20 uppercase tracking-widest">Yield</span>
                                <p className="text-sm font-black text-white/80">{track.revenue.formatted}</p>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {track && (
                <div className="mt-6 flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                        <Sparkles size={10} className="text-amber-400" />
                        <span className="text-[9px] font-black text-amber-500 uppercase tracking-widest">Trending</span>
                    </div>
                    <div className="h-1.5 w-16 rounded-full bg-white/5 overflow-hidden">
                        <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: '80%' }}
                            className="h-full bg-linear-to-r from-amber-500 to-amber-300" 
                        />
                    </div>
                </div>
            )}
        </div>
    );
}

// eslint-disable-next-line react-refresh/only-export-components
function AgentActivityWidget() {
    const userId = useAuthenticatedUserId();
    const [activity, setActivity] = useState<DashboardAgentActivity | null>(null);

    useEffect(() => {
        if (!userId) return;
        const unsub = AnalyticsService.subscribeToAgentActivity(
            userId,
            (d) => setActivity(d),
        );
        return () => unsub();
    }, [userId]);

    const statusDot: Record<string, string> = {
        running: 'bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.5)]',
        completed: 'bg-green-400',
        failed: 'bg-red-400',
        pending: 'bg-yellow-400',
    };

    return (
        <div className="flex flex-col h-full group/widget">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-dept-creative-muted flex items-center justify-center border border-dept-creative-muted shadow-[0_0_15px_rgba(0,255,102,0.1)] group-hover/widget:bg-dept-creative group-hover/widget:text-black transition-all duration-500">
                        <Bot size={18} className="group-hover/widget:rotate-12 transition-transform" />
                    </div>
                    <span className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em]">Neural Engine</span>
                </div>
                {activity && activity.runningCount > 0 && (
                    <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                        <span className="text-[8px] font-black text-emerald-400 uppercase tracking-widest animate-pulse">
                            {activity.runningCount} Active
                        </span>
                    </div>
                )}
            </div>

            <div className="flex-1 space-y-2 overflow-hidden">
                {!activity || activity.recentTasks.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full gap-2 opacity-20">
                        <Bot size={32} />
                        <p className="text-[8px] font-black uppercase tracking-widest">Awaiting Command</p>
                    </div>
                ) : (
                    activity.recentTasks.slice(0, 3).map((task) => (
                        <div key={task.id} className="flex items-center gap-3 p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.05] hover:bg-white/[0.06] transition-colors group/task">
                            <div className={`w-2 h-2 rounded-full flex-shrink-0 ${statusDot[task.status] || 'bg-white/20'}`} />
                            <div className="min-w-0 flex-1">
                                <p className="text-[10px] font-bold text-white/80 truncate uppercase tracking-tight">{task.taskLabel}</p>
                                <p className="text-[8px] font-black text-white/20 uppercase tracking-widest mt-0.5">{task.agentName}</p>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {activity && activity.completedToday > 0 && (
                <div className="mt-4 flex items-center gap-2">
                    <div className="h-[1px] flex-1 bg-white/5" />
                    <p className="text-[8px] font-black text-white/20 uppercase tracking-[0.2em]">
                        {activity.completedToday} OPTIMIZATIONS TODAY
                    </p>
                    <div className="h-[1px] flex-1 bg-white/5" />
                </div>
            )}
        </div>
    );
}

// eslint-disable-next-line react-refresh/only-export-components
function AudienceGrowthWidget() {
    const userId = useAuthenticatedUserId();
    const [data, setData] = useState<DashboardAudienceStats | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!userId) return;
        const unsub = AnalyticsService.subscribeToAudienceGrowth(
            userId,
            (d) => { setData(d); setIsLoading(false); },
            () => { setData(AnalyticsService.getAudienceZeroState()); setIsLoading(false); },
        );
        return () => unsub();
    }, [userId]);

    const weeklyGrowth = data?.weeklyGrowth || [0, 0, 0, 0, 0, 0, 0];
    const maxVal = Math.max(...weeklyGrowth, 1);
    const newListeners = data?.newListenersThisWeek.formatted || '--';

    // ISSUE-1291: see StreamsTodayWidget — an empty audience is an on-ramp, not a score.
    if (!isLoading && (parseInt(newListeners.replace(/,/g, '')) || 0) === 0) {
        return (
            <WidgetEmptyState
                icon={Users}
                label="Network Scale"
                promise="Weekly unique listeners appear here as your audience finds you."
                ctaLabel="Grow your audience"
                ctaModule="social"
                accentClass="text-dept-marketing"
            />
        );
    }

    return (
        <div className="flex flex-col h-full justify-between group/widget">
            <div>
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-pink-500/20 flex items-center justify-center border border-pink-500/30 shadow-[0_0_15px_rgba(236,72,153,0.2)] group-hover/widget:bg-pink-500 group-hover/widget:text-black transition-all duration-500">
                        <Users size={18} className="group-hover/widget:scale-110 transition-transform" />
                    </div>
                    <span className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em]">Network Scale</span>
                </div>
                
                <div className="space-y-1">
                    <p className={`text-5xl font-black text-white tracking-tighter ${isLoading ? 'animate-pulse opacity-50' : ''}`}>
                        {isLoading ? newListeners : <CountUp value={parseInt(newListeners.replace(/,/g, '')) || 0} />}
                    </p>
                    <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Weekly unique reach</p>
                </div>
            </div>

            <div className="mt-6 flex items-end gap-1 h-8">
                {weeklyGrowth.map((val, i) => (
                    <motion.div
                        key={i}
                        initial={{ height: 0 }}
                        animate={{ height: `${Math.max(10, (val / maxVal) * 100)}%` }}
                        transition={{ delay: i * 0.05, duration: 0.5 }}
                        className="flex-1 rounded-sm bg-pink-500/20 group-hover/widget:bg-pink-500/40 transition-colors"
                    />
                ))}
            </div>
        </div>
    );
}

// eslint-disable-next-line react-refresh/only-export-components
function ActiveCampaignsWidget() {
    const userId = useAuthenticatedUserId();
    const [data, setData] = useState<DashboardActiveCampaigns | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!userId) return;
        const unsub = AnalyticsService.subscribeToActiveCampaigns(
            userId,
            (d) => { setData(d); setIsLoading(false); },
            () => { setData(AnalyticsService.getActiveCampaignsZeroState()); setIsLoading(false); },
        );
        return () => unsub();
    }, [userId]);

    // ISSUE-1291: zero campaigns is a starting point, not a metric worth a huge 0.
    if (!isLoading && (data?.activeCount ?? 0) === 0) {
        return (
            <WidgetEmptyState
                icon={Activity}
                label="Market Velocity"
                promise="Track every running campaign and its momentum from one place."
                ctaLabel="Plan a campaign"
                ctaModule="campaign"
                accentClass="text-dept-campaign"
            />
        );
    }

    return (
        <div className="flex flex-col h-full justify-between group/widget">
            <div>
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-teal-500/20 flex items-center justify-center border border-teal-500/30 shadow-[0_0_15px_rgba(20,184,166,0.2)] group-hover/widget:bg-teal-500 group-hover/widget:text-black transition-all duration-500">
                        <Activity size={18} className="group-hover/widget:animate-pulse transition-transform" />
                    </div>
                    <span className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em]">Market Velocity</span>
                </div>
                
                <div className="space-y-1">
                    <p className={`text-5xl font-black text-white tracking-tighter ${isLoading ? 'animate-pulse opacity-50' : ''}`}>
                        {data?.activeCount ?? 0}
                    </p>
                    <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Concurrent Campaigns</p>
                </div>
            </div>

            <div className="mt-6">
                {data?.topCampaign ? (
                    <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/10 group-hover/widget:border-teal-500/40 transition-all">
                        <p className="text-[10px] font-black text-teal-400 uppercase tracking-widest truncate">{data.topCampaign.name}</p>
                        <p className="text-[9px] font-bold text-white/30 uppercase mt-1">
                            {data.topCampaign.platform} · {data.totalBudget.formatted} CAP
                        </p>
                    </div>
                ) : (
                    <div className="h-12 flex items-center justify-center border border-dashed border-white/5 rounded-2xl">
                        <span className="text-[8px] font-black text-white/10 uppercase tracking-widest">Initialize Campaign</span>
                    </div>
                )}
            </div>
        </div>
    );
}

// eslint-disable-next-line react-refresh/only-export-components
function PendingTasksWidget() {
    const userId = useAuthenticatedUserId();
    const [data, setData] = useState<DashboardPendingTasks | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!userId) return;
        const unsub = AnalyticsService.subscribeToPendingTasks(
            userId,
            (d) => { setData(d); setIsLoading(false); },
            () => { setData(AnalyticsService.getPendingTasksZeroState()); setIsLoading(false); },
        );
        return () => unsub();
    }, [userId]);

    const priorityColors: Record<string, string> = {
        urgent: 'bg-red-500 text-black',
        high: 'bg-orange-500 text-black',
        medium: 'bg-yellow-500 text-black',
        low: 'bg-gray-500/20 text-gray-400',
    };

    return (
        <div className="flex flex-col h-full justify-between group/widget">
            <div>
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-orange-500/20 flex items-center justify-center border border-orange-500/30 shadow-[0_0_15px_rgba(249,115,22,0.2)] group-hover/widget:bg-orange-500 group-hover/widget:text-black transition-all duration-500">
                        <CheckSquare size={18} className="group-hover/widget:scale-110 transition-transform" />
                    </div>
                    <span className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em]">Protocols</span>
                </div>
                
                <div className="space-y-1">
                    <p className={`text-5xl font-black text-white tracking-tighter ${isLoading ? 'animate-pulse opacity-50' : ''}`}>
                        {data?.totalCount ?? 0}
                    </p>
                    <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Awaiting Execution</p>
                </div>
            </div>

            <div className="mt-6 space-y-2">
                {data && data.tasks.length > 0 ? (
                    data.tasks.slice(0, 2).map((task) => (
                        <div key={task.id} className="flex items-center gap-3 p-2 rounded-xl bg-white/[0.02] border border-white/[0.05]">
                            <span className={`text-[7px] font-black px-1.5 py-0.5 rounded uppercase tracking-tighter ${priorityColors[task.priority]}`}>
                                {task.priority}
                            </span>
                            <p className="text-[10px] font-bold text-white/60 truncate uppercase tracking-tight">{task.title}</p>
                        </div>
                    ))
                ) : (
                    <p className="text-[10px] text-emerald-400 font-black uppercase tracking-[0.2em] text-center">System Optimized</p>
                )}
            </div>
        </div>
    );
}

// eslint-disable-next-line react-refresh/only-export-components
function SocialEngagementWidget() {
    const userId = useAuthenticatedUserId();
    const [data, setData] = useState<DashboardSocialEngagement | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!userId) return;
        const unsub = AnalyticsService.subscribeToSocialEngagement(
            userId,
            (d) => { setData(d); setIsLoading(false); },
            () => { setData(AnalyticsService.getSocialEngagementZeroState()); setIsLoading(false); },
        );
        return () => unsub();
    }, [userId]);

    const weeklyEngagement = data?.weeklyEngagement || [0, 0, 0, 0, 0, 0, 0];
    const maxVal = Math.max(...weeklyEngagement, 1);

    return (
        <div className="flex flex-col h-full justify-between group/widget">
            <div>
                <div className="flex items-center gap-3 mb-4">
                    <div className={`w-10 h-10 rounded-xl ${getColorForModule('social').bg} flex items-center justify-center border ${getColorForModule('social').border} group-hover/widget:${getColorForModule('social').bg.replace('/10', '')} group-hover/widget:text-black transition-all duration-500`}>
                        <ThumbsUp size={18} className="group-hover/widget:rotate-12 transition-transform" />
                    </div>
                    <span className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em]">Engagement Index</span>
                </div>
                
                <div className="space-y-1">
                    <p className={`text-5xl font-black text-white tracking-tighter ${isLoading ? 'animate-pulse opacity-50' : ''}`}>
                        {data?.engagementRate.formatted || '--'}
                    </p>
                    <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Cross-platform resonance</p>
                </div>
            </div>

            <div className="mt-6 flex items-end gap-1 h-8">
                {weeklyEngagement.map((val, i) => (
                    <motion.div
                        key={i}
                        initial={{ height: 0 }}
                        animate={{ height: `${Math.max(10, (val / maxVal) * 100)}%` }}
                        transition={{ delay: i * 0.05, duration: 0.5 }}
                        className={`flex-1 rounded-sm ${getColorForModule('social').bg} group-hover/widget:${getColorForModule('social').bg.replace('/10', '/40')} transition-colors`}
                    />
                ))}
            </div>
        </div>
    );
}

// eslint-disable-next-line react-refresh/only-export-components
function BrandIdentityWidget() {
    const userId = useAuthenticatedUserId();
    const [data, setData] = useState<DashboardBrandIdentity | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!userId) return;
        const unsub = AnalyticsService.subscribeToBrandIdentity(
            userId,
            (d) => { setData(d); setIsLoading(false); },
            () => { setData(AnalyticsService.getBrandIdentityZeroState()); setIsLoading(false); },
        );
        return () => unsub();
    }, [userId]);

    const statusLabel: Record<string, { text: string; color: string; bg: string }> = {
        synced: { text: 'In Sync', color: 'text-emerald-400', bg: 'bg-emerald-400/10' },
        outdated: { text: 'Outdated', color: 'text-amber-400', bg: 'bg-amber-400/10' },
        missing: { text: 'Missing', color: 'text-red-400', bg: 'bg-red-400/10' },
    };
    const currentStatus = statusLabel[data?.assetsStatus || 'missing'] || statusLabel.missing!;

    return (
        <div className="flex flex-col h-full justify-between group/widget">
            <div>
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-fuchsia-500/20 flex items-center justify-center border border-fuchsia-500/30 shadow-[0_0_15px_rgba(217,70,239,0.2)] group-hover/widget:bg-fuchsia-500 group-hover/widget:text-black transition-all duration-500">
                        <Palette size={18} className="group-hover/widget:scale-110 transition-transform" />
                    </div>
                    <span className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em]">Visual DNA</span>
                </div>
                
                <div className="space-y-1">
                    <p className={`text-5xl font-black text-white tracking-tighter ${isLoading ? 'animate-pulse opacity-50' : ''}`}>
                        {data?.complianceScore.formatted || '--'}
                    </p>
                    <div className="flex items-center gap-2">
                        <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Identity Score</p>
                        <span className={`text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-widest ${currentStatus?.bg} ${currentStatus?.color}`}>
                            {currentStatus?.text}
                        </span>
                    </div>
                </div>
            </div>

            <div className="mt-6 p-3 rounded-2xl bg-white/[0.03] border border-white/10">
                <div className="flex justify-between items-center mb-1.5">
                    <span className="text-[8px] font-black text-white/20 uppercase tracking-widest">Consistency</span>
                    <span className="text-[8px] font-black text-fuchsia-400 uppercase tracking-widest">High</span>
                </div>
                <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
                    <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: '92%' }}
                        className="h-full bg-fuchsia-500" 
                    />
                </div>
            </div>
        </div>
    );
}

// eslint-disable-next-line react-refresh/only-export-components
function MerchSalesWidget() {
    const userId = useAuthenticatedUserId();
    const [data, setData] = useState<DashboardMerchSales | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!userId) return;
        const unsub = AnalyticsService.subscribeToMerchSales(
            userId,
            (d) => { setData(d); setIsLoading(false); },
            () => { setData(AnalyticsService.getMerchSalesZeroState()); setIsLoading(false); },
        );
        return () => unsub();
    }, [userId]);

    return (
        <div className="flex flex-col h-full justify-between group/widget">
            <div>
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center border border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.2)] group-hover/widget:bg-emerald-500 group-hover/widget:text-black transition-all duration-500">
                        <ShoppingBag size={18} className="group-hover/widget:scale-110 transition-transform" />
                    </div>
                    <span className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em]">Inventory Yield</span>
                </div>
                
                <div className="space-y-1">
                    <p className={`text-5xl font-black text-white tracking-tighter ${isLoading ? 'animate-pulse opacity-50' : ''}`}>
                        {data?.weeklyRevenue.formatted || '$0'}
                    </p>
                    <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Gross Merchandise Volume</p>
                </div>
            </div>

            <div className="mt-6">
                {data?.topProduct ? (
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-[10px] font-black">
                            📦
                        </div>
                        <div className="min-w-0">
                            <p className="text-[10px] font-black text-white/80 uppercase truncate">{data.topProduct.name}</p>
                            <p className="text-[8px] font-bold text-emerald-400 uppercase tracking-widest">{data.topProduct.unitsSold} UNITS SOLD</p>
                        </div>
                    </div>
                ) : (
                    <button className="w-full py-2 rounded-xl border border-dashed border-white/10 text-[8px] font-black text-white/20 uppercase tracking-[0.2em] hover:bg-white/5 transition-colors">
                        Connect Storefront
                    </button>
                )}
            </div>
        </div>
    );
}

// eslint-disable-next-line react-refresh/only-export-components
function TourStatusWidget() {
    const userId = useAuthenticatedUserId();
    const [data, setData] = useState<DashboardTourStatus | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!userId) return;
        const unsub = AnalyticsService.subscribeToTourStatus(
            userId,
            (d) => { setData(d); setIsLoading(false); },
            () => { setData(AnalyticsService.getTourStatusZeroState()); setIsLoading(false); },
        );
        return () => unsub();
    }, [userId]);

    return (
        <div className="flex flex-col h-full justify-between group/widget">
            <div>
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-rose-500/20 flex items-center justify-center border border-rose-500/30 shadow-[0_0_15px_rgba(244,63,94,0.2)] group-hover/widget:bg-rose-500 group-hover/widget:text-black transition-all duration-500">
                        <MapPin size={18} className="group-hover/widget:bounce transition-transform" />
                    </div>
                    <span className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em]">Physical Node</span>
                </div>
                
                <div className="space-y-1">
                    <p className={`text-5xl font-black text-white tracking-tighter ${isLoading ? 'animate-pulse opacity-50' : ''}`}>
                        {data?.upcomingShows ?? 0}
                    </p>
                    <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Scheduled Appearances</p>
                </div>
            </div>

            <div className="mt-6 flex items-center gap-3">
                <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
                    <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: '65%' }}
                        className="h-full bg-rose-500" 
                    />
                </div>
                <span className="text-[9px] font-black text-white/40 uppercase tracking-widest">65% ROUTED</span>
            </div>
        </div>
    );
}

// eslint-disable-next-line react-refresh/only-export-components
function ConsolidatedRevenueWidget({ initialMode = 'aggregate' }: { initialMode?: 'aggregate' | 'mtd' }) {
    const userId = useAuthenticatedUserId();
    const setModule = useStore(useShallow((s) => s.setModule));
    const [mode, setMode] = useState<'aggregate' | 'mtd'>(initialMode);

    // Aggregated stats
    const [stats, setStats] = useState<RevenueStats | null>(null);
    const [isLoadingAgg, setIsLoadingAgg] = useState(true);

    // MTD stats
    const [revenueData, setRevenueData] = useState<DashboardRevenueStats | null>(null);
    const [isLoadingMtd, setIsLoadingMtd] = useState(true);

    useEffect(() => {
        if (!userId) return;
        let isMounted = true;

        if (mode === 'aggregate') {
            const fetchStats = async () => {
                try {
                    const data = await revenueService.getUserRevenueStats(userId, '30d');
                    if (isMounted) setStats(data);
                } catch (error) {
                    Logger.error('CustomDashboardWidgets', 'Error fetching revenue stats', error);
                } finally {
                    if (isMounted) setIsLoadingAgg(false);
                }
            };
            fetchStats();
        } else {
            const unsubscribe = AnalyticsService.subscribeToDashboardRevenue(
                userId,
                (data) => {
                    if (isMounted) {
                        setRevenueData(data);
                        setIsLoadingMtd(false);
                    }
                },
                () => {
                    if (isMounted) {
                        setRevenueData(AnalyticsService.getRevenueZeroState());
                        setIsLoadingMtd(false);
                    }
                }
            );
            return () => {
                isMounted = false;
                unsubscribe();
            };
        }
    }, [userId, mode]);

    const isLoading = mode === 'aggregate' ? isLoadingAgg : isLoadingMtd;
    const now = new Date();
    const monthName = now.toLocaleString('default', { month: 'long' });
    const mtdDisplay = revenueData?.mtdRevenue.formatted || '$0';

    if (!isLoading && mode === 'aggregate' && (stats?.totalRevenue ?? 0) === 0) {
        return (
            <WidgetEmptyState
                icon={TrendingUp}
                label="Revenue & Royalties"
                promise="Streaming, merch, sync and licensing income roll up here as it arrives."
                ctaLabel="Set up revenue tracking"
                ctaModule="finance"
                accentClass="text-dept-royalties"
            />
        );
    }

    return (
        <div
            className="flex flex-col h-full justify-between group/widget cursor-pointer"
            onClick={() => setModule('finance')}
            data-testid="revenue-consolidated-widget"
        >
            <div>
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-green-500/20 flex items-center justify-center border border-green-500/30 shadow-[0_0_15px_rgba(34,197,94,0.2)] group-hover/widget:bg-green-500 group-hover/widget:text-black transition-all duration-500">
                            {mode === 'aggregate' ? (
                                <TrendingUp size={18} className="group-hover/widget:scale-110 transition-transform" />
                            ) : (
                                <DollarSign size={20} className="group-hover/widget:rotate-12 transition-transform" />
                            )}
                        </div>
                        <div>
                            <span className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em] block">Revenue & Royalties</span>
                            <span className="text-[8px] font-bold text-gray-500 uppercase tracking-widest">
                                {mode === 'aggregate' ? 'Total Gross All Sources' : `${monthName} Earnings`}
                            </span>
                        </div>
                    </div>

                    {/* Mode Toggle Pills */}
                    <div
                        className="flex items-center bg-black/40 border border-white/10 rounded-lg p-0.5"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <button
                            type="button"
                            onClick={() => setMode('aggregate')}
                            className={`px-2 py-0.5 text-[8px] font-black uppercase tracking-wider rounded transition-all ${
                                mode === 'aggregate'
                                    ? 'bg-emerald-500 text-black shadow-sm'
                                    : 'text-gray-400 hover:text-white'
                            }`}
                        >
                            Aggregate
                        </button>
                        <button
                            type="button"
                            onClick={() => setMode('mtd')}
                            className={`px-2 py-0.5 text-[8px] font-black uppercase tracking-wider rounded transition-all ${
                                mode === 'mtd'
                                    ? 'bg-emerald-500 text-black shadow-sm'
                                    : 'text-gray-400 hover:text-white'
                            }`}
                        >
                            MTD
                        </button>
                    </div>
                </div>

                <div className="space-y-1">
                    {mode === 'aggregate' ? (
                        <>
                            <p className={`text-5xl font-black text-white tracking-tighter ${isLoadingAgg ? 'animate-pulse opacity-50' : ''}`}>
                                ${stats?.totalRevenue.toLocaleString('en-US') || '0'}
                            </p>
                            <div className="flex items-center gap-2">
                                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Total Gross Revenue</p>
                                {stats && stats.revenueChange !== 0 && (
                                    <span className={`text-[10px] font-black ${stats.revenueChange >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                        {stats.revenueChange >= 0 ? '+' : ''}{stats.revenueChange.toFixed(1)}%
                                    </span>
                                )}
                            </div>
                        </>
                    ) : (
                        <>
                            <p className={`text-5xl font-black text-white tracking-tighter ${isLoadingMtd ? 'animate-pulse opacity-50' : ''}`}>
                                {isLoadingMtd ? mtdDisplay : <CountUp value={parseFloat(mtdDisplay.replace(/[^0-9.]/g, '')) || 0} formatter={formatCurrency} />}
                            </p>
                            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">{monthName} MTD Earnings</p>
                        </>
                    )}
                </div>
            </div>

            <div className="mt-6">
                {mode === 'aggregate' && stats && (
                    <div>
                        <div className="flex gap-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
                            {Object.entries(stats.sources).map(([key, value]) => {
                                const percentage = stats.totalRevenue > 0 ? (value / stats.totalRevenue) * 100 : 0;
                                const colors: Record<string, string> = {
                                    streaming: 'bg-blue-500',
                                    merch: 'bg-green-500',
                                    licensing: 'bg-emerald-500',
                                    social: 'bg-pink-500',
                                };
                                if (percentage === 0) return null;
                                return (
                                    <motion.div
                                        key={key}
                                        initial={{ width: 0 }}
                                        animate={{ width: `${percentage}%` }}
                                        transition={{ duration: 0.6 }}
                                        className={`h-full ${colors[key] || 'bg-gray-500'}`}
                                        title={`${key}: ${formatCurrency(value)}`}
                                    />
                                );
                            })}
                        </div>
                        <div className="flex justify-between items-center mt-2 text-[9px] text-gray-400">
                            <span>Streaming, Merch, Licensing & Social</span>
                            <span className="text-emerald-400 font-bold uppercase tracking-wider">Open Finance →</span>
                        </div>
                    </div>
                )}
                {mode === 'mtd' && (
                    <div className="pt-2 border-t border-white/5 flex items-center justify-between">
                        <div className="flex flex-col">
                            <span className="text-[8px] font-black text-white/20 uppercase tracking-widest">Next Payout</span>
                            <span className="text-xs font-bold text-white/60">Not scheduled</span>
                        </div>
                        <div className="w-12 h-6 rounded-md bg-white/5 border border-white/10 flex items-center justify-center overflow-hidden">
                            <div className="w-full h-full bg-linear-to-r from-green-500/20 to-emerald-500/40 animate-pulse" />
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

// eslint-disable-next-line react-refresh/only-export-components
function ProjectTimelineWidget() {
    const userId = useAuthenticatedUserId();
    const setModule = useStore(useShallow((s) => s.setModule));
    const [timeline, setTimeline] = useState<Timeline | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!userId) return;
        let isMounted = true;

        async function loadTimeline() {
            try {
                const active = await timelineOrchestrator.getActiveTimelines(userId);
                if (!isMounted) return;
                if (active && active.length > 0) {
                    setTimeline(active[0]);
                } else {
                    const all = await timelineOrchestrator.getAllTimelines(userId);
                    if (isMounted && all && all.length > 0) {
                        setTimeline(all[0]);
                    }
                }
            } catch (err) {
                Logger.error('ProjectTimelineWidget', 'Failed to load timeline', err);
            } finally {
                if (isMounted) setIsLoading(false);
            }
        }
        loadTimeline();

        return () => {
            isMounted = false;
        };
    }, [userId]);

    const activePhase = timeline?.phases?.find((p) => p.order === timeline?.currentPhaseOrder) || timeline?.phases?.[0];
    const nextMilestone = timeline?.milestones?.find((m) => m.status === 'pending');
    const completedCount = timeline?.completedCount ?? 0;
    const totalCount = timeline?.totalCount || (timeline?.milestones?.length ?? 1);
    const percent = Math.min(100, Math.round((completedCount / Math.max(1, totalCount)) * 100));

    if (!isLoading && !timeline) {
        return (
            <div className="flex flex-col h-full justify-between group/widget" data-testid="project-timeline-widget">
                <div>
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center border border-blue-500/30 shadow-[0_0_15px_rgba(59,130,246,0.2)] group-hover/widget:bg-blue-500 group-hover/widget:text-black transition-all duration-500">
                                <Calendar size={18} className="group-hover/widget:scale-110 transition-transform" />
                            </div>
                            <span className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em]">Project Timeline</span>
                        </div>
                        <span className="text-[9px] font-black text-blue-400 uppercase tracking-widest bg-blue-400/10 px-2 py-1 rounded-lg border border-blue-400/20">
                            Roadmap
                        </span>
                    </div>

                    <div className="space-y-1">
                        <p className="text-xl font-bold text-white tracking-tight">No Active Rollout</p>
                        <p className="text-[10px] text-gray-400 leading-relaxed mt-1">
                            Build an autonomous progressive timeline with phased releases, escalating cadence, and review checkpoints.
                        </p>
                    </div>
                </div>

                <div className="mt-4">
                    <button
                        onClick={() => setModule('campaign')}
                        className="w-full py-2.5 px-3 rounded-xl bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 text-blue-300 hover:text-white text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-sm"
                    >
                        <Calendar size={14} />
                        Plan Release Timeline
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div
            className="flex flex-col h-full justify-between group/widget cursor-pointer"
            onClick={() => setModule('campaign')}
            data-testid="project-timeline-widget"
        >
            <div>
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center border border-blue-500/30 shadow-[0_0_15px_rgba(59,130,246,0.2)] group-hover/widget:bg-blue-500 group-hover/widget:text-black transition-all duration-500">
                            <Calendar size={18} className="group-hover/widget:scale-110 transition-transform" />
                        </div>
                        <div>
                            <span className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em] block">Project Timeline</span>
                            <span className="text-xs font-bold text-white tracking-tight truncate max-w-[140px] block">{timeline?.title || 'Active Campaign'}</span>
                        </div>
                    </div>
                    {activePhase && (
                        <div className="flex flex-col items-end">
                            <span className="text-[9px] font-black text-blue-400 uppercase tracking-widest bg-blue-400/10 px-2 py-0.5 rounded border border-blue-400/20">
                                {activePhase.name}
                            </span>
                            <span className="text-[8px] font-mono text-gray-500 uppercase mt-0.5">
                                {activePhase.cadence} cadence
                            </span>
                        </div>
                    )}
                </div>

                <div className="mt-3 space-y-1">
                    <div className="flex justify-between items-center text-[10px]">
                        <span className="text-gray-400 font-medium">Milestone Progress</span>
                        <span className="text-blue-400 font-bold">{percent}%</span>
                    </div>
                    <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                        <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${percent}%` }}
                            transition={{ duration: 0.8, ease: 'easeOut' }}
                            className="h-full bg-linear-to-r from-blue-500 to-emerald-400"
                        />
                    </div>
                    <p className="text-[9px] text-gray-500">{completedCount} of {totalCount} milestones completed</p>
                </div>

                {nextMilestone && (
                    <div className="mt-3 p-2.5 rounded-xl bg-white/[0.03] border border-white/5 space-y-1">
                        <div className="flex items-center justify-between">
                            <span className="text-[8px] font-black uppercase tracking-wider text-emerald-400">Up Next</span>
                            <span className="text-[8px] font-mono text-gray-400">
                                {(() => {
                                    if (!nextMilestone.scheduledAt) return 'Upcoming';
                                    const d = new Date(nextMilestone.scheduledAt);
                                    return isNaN(d.getTime()) ? 'Upcoming' : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                                })()}
                            </span>
                        </div>
                        <p className="text-[11px] font-semibold text-white truncate">{nextMilestone.instruction}</p>
                        {nextMilestone.platform && (
                            <span className="text-[8px] px-1.5 py-0.5 rounded bg-white/5 text-gray-400 uppercase font-mono">
                                {nextMilestone.platform}
                            </span>
                        )}
                    </div>
                )}
            </div>

            <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-[10px] text-gray-400">
                <span className="text-white/60">Status: <strong className="text-emerald-400 capitalize">{timeline?.status ?? 'Active'}</strong></span>
                <span className="text-blue-400 font-bold hover:underline flex items-center gap-1">
                    Timeline Details <ChevronRight size={12} />
                </span>
            </div>
        </div>
    );
}

// eslint-disable-next-line react-refresh/only-export-components
function ApprovalGatesWidget() {
    const [approvals, setApprovals] = useState<(PendingToolApproval & { id: string })[]>([]);
    const [busyId, setBusyId] = useState<string | null>(null);
    const toast = useToast();

    useEffect(() => {
        const unsubscribe = toolApprovalService.onPendingApprovals(setApprovals);
        return () => {
            if (typeof unsubscribe === 'function') unsubscribe();
        };
    }, []);

    const handleApprove = async (id: string, e?: React.MouseEvent) => {
        e?.stopPropagation();
        setBusyId(id);
        try {
            const result = await toolApprovalService.approve(id);
            if (result.success) {
                if (toast?.success) {
                    toast.success('Gate approved & executed');
                } else {
                    Logger.info('ApprovalGates', 'Approved');
                }
            } else {
                if (toast?.error) {
                    toast.error(result.error || 'Gate execution failed');
                } else {
                    Logger.error('ApprovalGates', result.error);
                }
            }
        } catch (err) {
            Logger.error('ApprovalGatesWidget', 'Approve error', err);
            toast?.error?.('Failed to approve');
        } finally {
            setBusyId(null);
        }
    };

    const handleDeny = async (id: string, e?: React.MouseEvent) => {
        e?.stopPropagation();
        setBusyId(id);
        try {
            await toolApprovalService.deny(id, 'Denied from Quick-Action Approval Gate');
            if (toast?.success) {
                toast.success('Gate denied');
            } else {
                Logger.info('ApprovalGates', 'Denied');
            }
        } catch (err) {
            Logger.error('ApprovalGatesWidget', 'Deny error', err);
            toast?.error?.('Failed to deny');
        } finally {
            setBusyId(null);
        }
    };

    const hasPending = approvals.length > 0;

    return (
        <div className="flex flex-col h-full justify-between group/widget" data-testid="approval-gates-widget">
            <div>
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center border transition-all duration-500 ${
                            hasPending
                                ? 'bg-amber-500/20 border-amber-500/40 text-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.3)] animate-pulse'
                                : 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.2)]'
                        }`}>
                            {hasPending ? <ShieldAlert size={18} /> : <ShieldCheck size={18} />}
                        </div>
                        <div>
                            <span className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em] block">Approval Gates</span>
                            <span className="text-xs font-bold text-white tracking-tight">
                                {hasPending ? `${approvals.length} Gate${approvals.length > 1 ? 's' : ''} Pending` : 'All Gates Clear'}
                            </span>
                        </div>
                    </div>

                    <span className={`text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded border ${
                        hasPending
                            ? 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                            : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                    }`}>
                        {hasPending ? 'Action Required' : 'Enforced'}
                    </span>
                </div>

                {hasPending ? (
                    <div className="space-y-2 max-h-[130px] overflow-y-auto custom-scrollbar pr-1">
                        {approvals.slice(0, 2).map((item) => {
                            const isBusy = busyId === item.id;
                            const riskColor = item.riskTier === 'destructive'
                                ? 'bg-red-500/20 text-red-400 border-red-500/30'
                                : item.riskTier === 'write'
                                ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                                : 'bg-blue-500/20 text-blue-400 border-blue-500/30';

                            return (
                                <div
                                    key={item.id}
                                    className="p-2.5 rounded-xl bg-black/40 border border-white/5 space-y-2 hover:border-white/10 transition-colors"
                                >
                                    <div className="flex items-center justify-between gap-2">
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                <span className="text-[11px] font-bold text-white truncate">{item.toolName}</span>
                                                <span className={`text-[7px] font-black uppercase px-1 py-0.2 rounded border ${riskColor}`}>
                                                    {item.riskTier}
                                                </span>
                                            </div>
                                            <p className="text-[9px] text-gray-400 truncate mt-0.5">{item.description || 'Action awaiting authorization'}</p>
                                        </div>
                                    </div>

                                    {/* Quick Actions: Approve / Deny */}
                                    <div className="flex items-center gap-1.5 pt-1">
                                        <button
                                            type="button"
                                            disabled={isBusy}
                                            onClick={(e) => handleApprove(item.id, e)}
                                            data-testid={`gate-approve-${item.id}`}
                                            className="flex-1 py-1 px-2 rounded-lg bg-emerald-500/20 hover:bg-emerald-500 text-emerald-300 hover:text-black font-bold text-[9px] uppercase tracking-wider flex items-center justify-center gap-1 transition-all disabled:opacity-50"
                                        >
                                            <Check size={10} />
                                            {isBusy ? '...' : 'Approve'}
                                        </button>
                                        <button
                                            type="button"
                                            disabled={isBusy}
                                            onClick={(e) => handleDeny(item.id, e)}
                                            data-testid={`gate-deny-${item.id}`}
                                            className="py-1 px-2 rounded-lg bg-red-500/15 hover:bg-red-500 text-red-400 hover:text-black font-bold text-[9px] uppercase tracking-wider flex items-center justify-center gap-1 transition-all disabled:opacity-50"
                                        >
                                            <X size={10} />
                                            Deny
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                        {approvals.length > 2 && (
                            <div className="text-center pt-1">
                                <span className="text-[8px] text-amber-400/80 font-bold uppercase tracking-wider">
                                    +{approvals.length - 2} more gate{approvals.length - 2 > 1 ? 's' : ''} in Quick-Action Banner
                                </span>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="space-y-1.5 py-1">
                        <p className="text-xs font-semibold text-gray-300">Autonomous safeguards active</p>
                        <p className="text-[10px] text-gray-500 leading-relaxed">
                            Irreversible operations (DSP submissions, ad spend, contract signatures, file deletes) pause here for 1-click confirmation.
                        </p>
                    </div>
                )}
            </div>

            <div className="mt-3 pt-2 border-t border-white/5 flex items-center justify-between text-[9px] text-gray-400">
                <span>Governance: <strong>Strict Gate</strong></span>
                <span className="text-emerald-400 font-bold">100% Safe</span>
            </div>
        </div>
    );
}

export const WIDGET_RENDERERS: Record<WidgetType, () => React.ReactElement> = {
    streams_today: () => <StreamsTodayWidget />,
    revenue_consolidated: () => <ConsolidatedRevenueWidget initialMode="aggregate" />,
    project_timeline: () => <ProjectTimelineWidget />,
    approval_gates: () => <ApprovalGatesWidget />,
    revenue_mtd: () => <RevenueMTDWidget />,
    next_release: () => <NextReleaseWidget />,
    top_track: () => <TopTrackWidget />,
    agent_activity: () => <AgentActivityWidget />,
    audience_growth: () => <AudienceGrowthWidget />,
    active_campaigns: () => <ActiveCampaignsWidget />,
    pending_tasks: () => <PendingTasksWidget />,
    social_engagement: () => <SocialEngagementWidget />,
    brand_identity: () => <BrandIdentityWidget />,
    merch_sales: () => <MerchSalesWidget />,
    tour_status: () => <TourStatusWidget />,
    revenue_aggregated: () => <RevenueAggregatedWidget />,
    cost_estimator: () => <CostEstimatorWidget />,
};

// eslint-disable-next-line react-refresh/only-export-components
function RevenueAggregatedWidget() {
    // Revenue rules are scoped to Firebase Auth, not a mutable/stale profile
    // document. A cached profile from another account must never choose the
    // owner for this query during account-boundary hydration.
    const userId = useAuthenticatedUserId();
    const setModule = useStore(useShallow((s) => s.setModule));
    const [stats, setStats] = useState<RevenueStats | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!userId) return;
        const fetchStats = async () => {
            try {
                const data = await revenueService.getUserRevenueStats(userId, '30d');
                setStats(data);
            } catch (error) {
                Logger.error('CustomDashboardWidgets', 'Error fetching revenue stats', error);
            } finally {
                setIsLoading(false);
            }
        };
        fetchStats();
    }, [userId]);

    // ISSUE-1291: $0 gross reads as failure to a pre-release artist. Show the promise.
    if (!isLoading && (stats?.totalRevenue ?? 0) === 0) {
        return (
            <WidgetEmptyState
                icon={TrendingUp}
                label="Aggregate Revenue"
                promise="Streaming, merch, sync and licensing income roll up here as it arrives."
                ctaLabel="Set up revenue tracking"
                ctaModule="finance"
                accentClass="text-dept-royalties"
            />
        );
    }

    return (
        <div className="flex flex-col h-full justify-between group/widget cursor-pointer" onClick={() => setModule('finance')} data-testid="revenue-aggregated-widget">
            <div>
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-green-500/20 flex items-center justify-center border border-green-500/30 shadow-[0_0_15px_rgba(168,85,247,0.2)] group-hover/widget:bg-green-500 group-hover/widget:text-black transition-all duration-500">
                        <TrendingUp size={18} className="group-hover/widget:scale-110 transition-transform" />
                    </div>
                    <span className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em]">Aggregate Revenue</span>
                </div>
                
                <div className="space-y-1">
                    <p className={`text-5xl font-black text-white tracking-tighter ${isLoading ? 'animate-pulse opacity-50' : ''}`}>
                        ${stats?.totalRevenue.toLocaleString('en-US') || '0'}
                    </p>
                    <div className="flex items-center gap-2">
                        <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Total Gross Revenue</p>
                        {stats && stats.revenueChange !== 0 && (
                            <span className={`text-[10px] font-black ${stats.revenueChange >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                {stats.revenueChange >= 0 ? '+' : ''}{stats.revenueChange.toFixed(1)}%
                            </span>
                        )}
                    </div>
                </div>
            </div>

            <div className="mt-6">
                <div className="flex gap-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
                    {stats && Object.entries(stats.sources).map(([key, value], i) => {
                        const percentage = stats.totalRevenue > 0 ? (value / stats.totalRevenue) * 100 : 0;
                        const colors: Record<string, string> = {
                            streaming: 'bg-blue-500',
                            merch: 'bg-green-500',
                            licensing: 'bg-emerald-500',
                            social: 'bg-pink-500'
                        };
                        if (percentage === 0) return null;
                        return (
                            <motion.div
                                key={key}
                                initial={{ width: 0 }}
                                animate={{ width: `${percentage}%` }}
                                className={`h-full ${colors[key] || 'bg-gray-500'}`}
                                transition={{ delay: i * 0.1 }}
                            />
                        );
                    })}
                </div>
                <div className="mt-2 flex justify-between items-center">
                    <span className="text-[8px] font-black text-white/20 uppercase tracking-widest">Multi-Stream Distribution</span>
                    <span className="text-[8px] font-black text-green-400 uppercase tracking-widest group-hover/widget:translate-x-1 transition-transform">View Details →</span>
                </div>
            </div>
        </div>
    );
}

// eslint-disable-next-line react-refresh/only-export-components
function CostEstimatorWidget() {
    const [mediaType, setMediaType] = useState<'video' | 'image'>('video');
    const [tier, setTier] = useState<'pro' | 'fast' | 'lite'>('pro');
    const [duration, setDuration] = useState<number>(8);
    const [count, setCount] = useState<number>(4);

    const videoCost = (() => {
        if (tier === 'pro') return duration * MODEL_PRICING['veo-3.1-generate-001'].perSecond;
        if (tier === 'fast') return duration * MODEL_PRICING['veo-3.1-fast-generate-001'].perSecond;
        return duration * MODEL_PRICING['veo-3.1-lite-generate-001'].perSecond;
    })();

    const imageCost = (() => {
        // Approximate image token sizes: ~13,400 tokens per 1K image
        // 13,400 / 1,000,000 = 0.0134 multiplier for output cost
        const TOKENS_PER_IMAGE = 13400;
        const perTokenCost = (modelId: keyof typeof MODEL_PRICING) =>
            // @ts-expect-error model pricing type indexing
            (MODEL_PRICING[modelId].output || 0) / 1000000;

        if (tier === 'pro') return count * TOKENS_PER_IMAGE * perTokenCost('gemini-3-pro-image');
        if (tier === 'fast') return count * TOKENS_PER_IMAGE * perTokenCost('gemini-3.1-flash-image');
        return count * TOKENS_PER_IMAGE * perTokenCost('imagen-4.0-fast-generate-001'); // fallback lite equivalent
    })();

    const activeCost = mediaType === 'video' ? videoCost : imageCost;
    const tierLabels = { pro: 'Pro', fast: 'Fast', lite: 'Lite' };

    return (
        <div className="flex flex-col h-full justify-between group/widget">
            <div>
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center border border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.2)] group-hover/widget:bg-emerald-500 group-hover/widget:text-black transition-all duration-500">
                        <DollarSign size={18} className="group-hover/widget:scale-110 transition-transform" />
                    </div>
                    <span className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em]">Cost Estimator</span>
                </div>
                
                <div className="space-y-1">
                    <p className="text-5xl font-black text-white tracking-tighter">
                        ${activeCost.toFixed(3)}
                    </p>
                    <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Estimated Run Cost</p>
                </div>
            </div>

            <div className="mt-4 space-y-3">
                <div className="grid grid-cols-2 gap-2 bg-white/5 p-1 rounded-xl">
                    <button 
                        onClick={() => { setMediaType('video'); if (tier === 'lite') setTier('fast'); }}
                        className={`text-[9px] font-black uppercase tracking-widest py-1.5 rounded-lg transition-colors ${mediaType === 'video' ? 'bg-white/10 text-white shadow-sm' : 'text-white/40 hover:text-white/80'}`}
                    >
                        Video
                    </button>
                    <button 
                        onClick={() => { setMediaType('image'); if (tier === 'lite') setTier('fast'); }}
                        className={`text-[9px] font-black uppercase tracking-widest py-1.5 rounded-lg transition-colors ${mediaType === 'image' ? 'bg-white/10 text-white shadow-sm' : 'text-white/40 hover:text-white/80'}`}
                    >
                        Image
                    </button>
                </div>

                <div className="flex items-center justify-between">
                    <span className="text-[9px] font-black text-white/40 uppercase tracking-widest">Tier</span>
                    <div className="flex gap-1">
                        {(['pro', 'fast', 'lite'] as const).map(t => {
                            if (mediaType === 'image' && t === 'lite') return null;
                            return (
                                <button
                                    key={t}
                                    onClick={() => setTier(t)}
                                    className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest transition-colors ${tier === t ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-white/5 text-white/40 hover:bg-white/10'}`}
                                >
                                    {tierLabels[t]}
                                </button>
                            );
                        })}
                    </div>
                </div>

                <div className="flex items-center justify-between">
                    <span className="text-[9px] font-black text-white/40 uppercase tracking-widest">
                        {mediaType === 'video' ? 'Duration (s)' : 'Batch Size'}
                    </span>
                    <div className="flex items-center gap-2">
                        <button 
                            onClick={() => mediaType === 'video' ? setDuration(d => Math.max(1, d - 1)) : setCount(c => Math.max(1, c - 1))}
                            className="w-5 h-5 rounded bg-white/5 flex items-center justify-center text-white/60 hover:bg-white/10"
                        >
                            -
                        </button>
                        <span className="text-xs font-black w-4 text-center">{mediaType === 'video' ? duration : count}</span>
                        <button 
                            onClick={() => mediaType === 'video' ? setDuration(d => Math.min(60, d + 1)) : setCount(c => Math.min(100, c + 1))}
                            className="w-5 h-5 rounded bg-white/5 flex items-center justify-center text-white/60 hover:bg-white/10"
                        >
                            +
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
