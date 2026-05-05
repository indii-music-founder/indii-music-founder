import React, { useState, useEffect } from 'react';
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
} from 'lucide-react';
import { motion, useMotionValue, useTransform, animate } from 'motion/react';
import { useStore } from '@/core/store';
import { useShallow } from 'zustand/react/shallow';
import { AnalyticsService } from '@/services/dashboard/AnalyticsService';
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

export type WidgetType = 'streams_today' | 'revenue_mtd' | 'next_release' | 'top_track' | 'agent_activity' | 'audience_growth' | 'active_campaigns' | 'pending_tasks' | 'social_engagement' | 'brand_identity' | 'merch_sales' | 'tour_status';

export interface Widget {
    id: string;
    type: WidgetType;
    order: number;
}

export const WIDGET_DEFINITIONS: Record<WidgetType, { label: string; icon: LucideIcon; description: string }> = {
    streams_today: { label: 'Streams Today', icon: Music, description: 'Daily stream count across all DSPs' },
    revenue_mtd: { label: 'Revenue MTD', icon: DollarSign, description: 'Month-to-date royalty revenue' },
    next_release: { label: 'Next Release', icon: Calendar, description: 'Countdown to your next scheduled release' },
    top_track: { label: 'Top Track', icon: TrendingUp, description: 'Your best performing track right now' },
    agent_activity: { label: 'Agent Activity', icon: Bot, description: 'Recent AI agent tasks and completions' },
    audience_growth: { label: 'Audience Growth', icon: Users, description: 'New listeners and followers across platforms' },
    active_campaigns: { label: 'Active Campaigns', icon: Activity, description: 'Currently running marketing campaigns' },
    pending_tasks: { label: 'Pending Tasks', icon: CheckSquare, description: 'Tasks requiring your attention' },
    social_engagement: { label: 'Social Engagement', icon: ThumbsUp, description: 'Likes, comments, and shares on recent posts' },
    brand_identity: { label: 'Brand Integrity', icon: Palette, description: 'Visual identity and brand compliance scores' },
    merch_sales: { label: 'Merchandise', icon: ShoppingBag, description: 'Recent sales and inventory alerts' },
    tour_status: { label: 'Tour & Shows', icon: MapPin, description: 'Ticket sales and upcoming tour dates' },
};

const DEFAULT_WIDGETS: Widget[] = [
    { id: 'w1', type: 'streams_today', order: 0 },
    { id: 'w2', type: 'revenue_mtd', order: 1 },
    { id: 'w3', type: 'next_release', order: 2 },
    { id: 'w4', type: 'top_track', order: 3 },
    { id: 'w5', type: 'audience_growth', order: 4 },
    { id: 'w6', type: 'active_campaigns', order: 5 },
];

export const STORAGE_KEY = 'indiiOS_custom_dashboard_widgets';

export function loadWidgets(): Widget[] {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) return JSON.parse(saved) as Widget[];
    } catch {
        // ignore
    }
    return DEFAULT_WIDGETS;
}

function formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(amount);
}

/* ── Components ─────────────────────────────────────────────────── */

function CountUp({ value, duration = 2, formatter = (v: number) => Math.floor(v).toLocaleString() }: { value: number; duration?: number; formatter?: (v: number) => string }) {
    const motionValue = useMotionValue(0);
    const rounded = useTransform(motionValue, (latest) => formatter(latest));
    const [displayValue, setDisplayValue] = useState("0");

    useEffect(() => {
        const controls = animate(motionValue, value, { duration, ease: "easeOut" });
        return controls.stop;
    }, [value, duration, motionValue]);

    useEffect(() => {
        return rounded.on("change", (latest) => setDisplayValue(latest));
    }, [rounded]);

    return <span>{displayValue}</span>;
}

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

function StreamsTodayWidget() {
    const userId = useStore(useShallow((s) => s.userProfile?.id));
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

    return (
        <div className="flex flex-col h-full justify-between group/widget">
            <div>
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center border border-purple-500/30 shadow-[0_0_15px_rgba(168,85,247,0.2)] group-hover/widget:bg-purple-500 group-hover/widget:text-black transition-all duration-500">
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
                        className="flex-1 rounded-t-sm bg-linear-to-t from-purple-500/5 to-purple-500/40 group-hover/widget:to-purple-400 transition-colors relative"
                    >
                        <div className="absolute inset-x-0 top-0 h-[1px] bg-purple-300/40" />
                    </motion.div>
                ))}
            </div>
        </div>
    );
}

function RevenueMTDWidget() {
    const userId = useStore(useShallow((s) => s.userProfile?.id));
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
    const growth = "+12.5%"; // Mock growth for visual elevation

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
                    <span className="text-xs font-bold text-white/60">May 21, 2026</span>
                </div>
                <div className="w-12 h-6 rounded-md bg-white/5 border border-white/10 flex items-center justify-center overflow-hidden">
                    <div className="w-full h-full bg-linear-to-r from-green-500/20 to-emerald-500/40 animate-pulse" />
                </div>
            </div>
        </div>
    );
}

function NextReleaseWidget() {
    const userId = useStore(useShallow((s) => s.userProfile?.id));
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

function TopTrackWidget() {
    const userId = useStore(useShallow((s) => s.userProfile?.id));
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

function AgentActivityWidget() {
    const userId = useStore(useShallow((s) => s.userProfile?.id));
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

function AudienceGrowthWidget() {
    const userId = useStore(useShallow((s) => s.userProfile?.id));
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

function ActiveCampaignsWidget() {
    const userId = useStore(useShallow((s) => s.userProfile?.id));
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

function PendingTasksWidget() {
    const userId = useStore(useShallow((s) => s.userProfile?.id));
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

function SocialEngagementWidget() {
    const userId = useStore(useShallow((s) => s.userProfile?.id));
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
                    <div className="w-10 h-10 rounded-xl bg-cyan-500/20 flex items-center justify-center border border-cyan-500/30 shadow-[0_0_15px_rgba(6,182,212,0.2)] group-hover/widget:bg-cyan-500 group-hover/widget:text-black transition-all duration-500">
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
                        className="flex-1 rounded-sm bg-cyan-500/20 group-hover/widget:bg-cyan-500/40 transition-colors"
                    />
                ))}
            </div>
        </div>
    );
}

function BrandIdentityWidget() {
    const userId = useStore(useShallow((s) => s.userProfile?.id));
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
    const currentStatus = statusLabel[data?.assetsStatus || 'missing'] || statusLabel.missing;

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
                        <span className={`text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-widest ${currentStatus.bg} ${currentStatus.color}`}>
                            {currentStatus.text}
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

function MerchSalesWidget() {
    const userId = useStore(useShallow((s) => s.userProfile?.id));
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

function TourStatusWidget() {
    const userId = useStore(useShallow((s) => s.userProfile?.id));
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

export const WIDGET_RENDERERS: Record<WidgetType, () => React.ReactElement> = {
    streams_today: () => <StreamsTodayWidget />,
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
};

