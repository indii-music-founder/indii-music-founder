import React, { useState, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
    LayoutDashboard,
    Plus,
    GripVertical,
    X,
    Music,
    DollarSign,
    Calendar,
    TrendingUp,
    Bot,
    Edit3,
    BarChart3,
    Undo2,
    Users,
    Activity,
    CheckSquare,
    ThumbsUp,
    Palette,
    ShoppingBag,
    MapPin,
} from 'lucide-react';
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

export const WIDGET_DEFINITIONS: Record<WidgetType, { label: string; icon: React.ElementType; description: string }> = {
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
        <div className="flex flex-col h-full justify-between">
            <div className="flex items-center gap-2 mb-3">
                <div className="w-6 h-6 rounded-lg bg-purple-500/10 flex items-center justify-center">
                    <Music size={12} className="text-purple-400" />
                </div>
                <span className="text-[10px] font-semibold text-white/50 uppercase tracking-[0.15em]">Streams Today</span>
            </div>
            <div>
                <p className={`text-4xl font-semibold text-white tracking-tight ${isLoading ? 'animate-pulse opacity-50' : ''}`}>
                    {displayValue}
                </p>
                <p className="text-[10px] text-indigo-200/50 mt-1 font-medium">Daily stream count across all DSPs</p>
            </div>
            <div className="mt-3 flex items-end gap-1 h-8">
                {weeklyStreams.map((val, i) => (
                    <div
                        key={i}
                        className="flex-1 rounded-sm bg-purple-500/10 hover:bg-purple-500/20 transition-colors"
                        style={{ height: `${Math.max(5, (val / maxVal) * 100)}%` }}
                    />
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
    const dayOfMonth = now.getDate();
    const monthName = now.toLocaleString('default', { month: 'long', year: 'numeric' });

    const displayValue = revenueData?.mtdRevenue.formatted || '--';
    const hasGoal = false; // Internal toggle for future goal support

    return (
        <div className="flex flex-col h-full justify-between">
            <div className="flex items-center gap-2 mb-3">
                <div className="w-6 h-6 rounded-lg bg-green-500/10 flex items-center justify-center">
                    <DollarSign size={12} className="text-green-400" />
                </div>
                <span className="text-[10px] font-semibold text-white/50 uppercase tracking-[0.15em]">Revenue MTD</span>
            </div>
            <div>
                <p className={`text-4xl font-semibold text-white tracking-tight ${isLoading ? 'animate-pulse opacity-50' : ''}`}>
                    {displayValue}
                </p>
                <p className="text-[10px] text-indigo-200/50 mt-1 font-medium">{dayOfMonth} days into {monthName}</p>
            </div>
            <div className="mt-3">
                <p className="text-[10px] text-white/30">{hasGoal ? 'Target: $10,000' : 'Revenue goal not set'}</p>
            </div>
        </div>
    );
}

function NextReleaseWidget() {
    const userId = useStore(useShallow((s) => s.userProfile?.id));
    const [release, setRelease] = useState<DashboardNextRelease | null | undefined>(undefined);
    const [now, setNow] = useState<number>(() => Date.now());

    // Tick every minute to keep the countdown live
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
        if (ms <= 0) return 'Today';
        const days = Math.floor(ms / 86_400_000);
        const hours = Math.floor((ms % 86_400_000) / 3_600_000);
        return days > 0 ? `${days}d ${hours}h` : `${hours}h`;
    })();

    const statusColors: Record<string, string> = {
        draft: 'bg-gray-500/10 text-gray-400',
        submitted: 'bg-blue-500/10 text-blue-400',
        approved: 'bg-indigo-500/10 text-indigo-400',
        live: 'bg-green-500/10 text-green-400',
    };

    return (
        <div className="flex flex-col h-full justify-between">
            <div className="flex items-center gap-2 mb-3">
                <div className="w-6 h-6 rounded-lg bg-blue-500/10 flex items-center justify-center">
                    <Calendar size={12} className="text-blue-400" />
                </div>
                <span className="text-[10px] font-semibold text-white/50 uppercase tracking-[0.15em]">Next Release</span>
            </div>
            {isLoading ? (
                <div className="flex-1 flex items-center justify-center">
                    <div className="w-4 h-4 rounded-full border-2 border-blue-500/30 border-t-blue-400 animate-spin" />
                </div>
            ) : release === null ? (
                <div>
                    <p className="text-4xl font-semibold text-white tracking-tight">--</p>
                    <p className="text-xs font-bold text-gray-500 mt-1">No upcoming releases</p>
                    <p className="text-[10px] text-white/30 mt-1">Schedule a release to see countdown</p>
                </div>
            ) : (
                <div>
                    <p className="text-4xl font-semibold text-white tracking-tight">{countdown}</p>
                    <p className="text-xs font-bold text-white/60 mt-1 truncate" title={release.title}>{release.title}</p>
                    <div className="flex items-center gap-1.5 mt-2">
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${statusColors[release.status] || 'bg-white/5 text-white/30'}`}>
                            {release.status}
                        </span>
                        <span className="text-[9px] text-white/20">{release.distributors.length} DSP{release.distributors.length !== 1 ? 's' : ''}</span>
                    </div>
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
        <div className="flex flex-col h-full justify-between">
            <div className="flex items-center gap-2 mb-3">
                <div className="w-6 h-6 rounded-lg bg-amber-500/10 flex items-center justify-center">
                    <TrendingUp size={12} className="text-amber-400" />
                </div>
                <span className="text-[10px] font-semibold text-white/50 uppercase tracking-[0.15em]">Top Track</span>
            </div>
            {isLoading ? (
                <div className="flex-1 flex items-center justify-center">
                    <div className="w-4 h-4 rounded-full border-2 border-amber-500/30 border-t-amber-400 animate-spin" />
                </div>
            ) : track === null ? (
                <div>
                    <p className="text-sm font-semibold text-white/30 tracking-wide">No tracks yet</p>
                    <p className="text-[10px] text-gray-600 mt-1">Upload your first release</p>
                </div>
            ) : (
                <div>
                    <p className="text-sm font-bold text-white truncate" title={track.title}>{track.title}</p>
                    <div className="space-y-1.5 mt-2">
                        <div className="flex items-center justify-between">
                            <span className="text-[10px] text-white/40">Streams</span>
                            <span className="text-[10px] font-semibold text-white/70">{track.streams.formatted || track.streams.value.toLocaleString()}</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-[10px] text-white/40">Revenue</span>
                            <span className="text-[10px] font-semibold text-white/70">{track.revenue.formatted || `$${track.revenue.value.toFixed(2)}`}</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-[10px] text-white/40">Save Rate</span>
                            <span className="text-[10px] font-semibold text-white/70">{track.saveRate.formatted || `${track.saveRate.value}%`}</span>
                        </div>
                    </div>
                </div>
            )}
            {track && (
                <div className="mt-2">
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${track.trend === 'rising' ? 'bg-green-500/10 text-green-400' :
                        track.trend === 'falling' ? 'bg-red-500/10 text-red-400' :
                            'bg-white/5 text-white/30'
                        }`}>{track.trend}</span>
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
        running: 'bg-indigo-400 animate-pulse',
        completed: 'bg-green-400',
        failed: 'bg-red-400',
        pending: 'bg-yellow-400',
    };

    return (
        <div className="flex flex-col h-full">
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg bg-indigo-500/10 flex items-center justify-center">
                        <Bot size={12} className="text-indigo-400" />
                    </div>
                    <span className="text-[10px] font-semibold text-white/50 uppercase tracking-[0.15em]">Agent Activity</span>
                </div>
                {activity && activity.runningCount > 0 && (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 animate-pulse">
                        {activity.runningCount} running
                    </span>
                )}
            </div>
            <div className="flex-1 space-y-1.5 overflow-hidden">
                {!activity || activity.recentTasks.length === 0 ? (
                    <div className="flex items-center justify-center h-full">
                        <div className="text-center">
                            <Bot size={24} className="text-gray-700 mx-auto mb-2" />
                            <p className="text-[10px] text-white/30">No recent agent activity</p>
                        </div>
                    </div>
                ) : (
                    activity.recentTasks.slice(0, 4).map((task) => (
                        <div key={task.id} className="flex items-center gap-2 p-1.5 rounded-lg bg-white/[0.02]">
                            <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${statusDot[task.status] || 'bg-white/20'}`} />
                            <div className="min-w-0 flex-1">
                                <p className="text-[10px] text-white/70 truncate">{task.taskLabel}</p>
                                <p className="text-[9px] text-white/30">{task.agentName}</p>
                            </div>
                        </div>
                    ))
                )}
            </div>
            {activity && activity.completedToday > 0 && (
                <p className="text-[9px] text-white/20 mt-2">{activity.completedToday} task{activity.completedToday !== 1 ? 's' : ''} completed today</p>
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
    const trend = data?.newListenersThisWeek.trend;

    return (
        <div className="flex flex-col h-full justify-between">
            <div className="flex items-center gap-2 mb-3">
                <div className="w-6 h-6 rounded-lg bg-pink-500/10 flex items-center justify-center">
                    <Users size={12} className="text-pink-400" />
                </div>
                <span className="text-[10px] font-semibold text-white/50 uppercase tracking-[0.15em]">Audience Growth</span>
            </div>
            <div>
                <p className={`text-4xl font-semibold text-white tracking-tight ${isLoading ? 'animate-pulse opacity-50' : ''}`}>
                    {newListeners}
                </p>
                <div className="flex items-center gap-1.5 mt-1">
                    <p className="text-[10px] text-indigo-200/50 font-medium">New listeners this week</p>
                    {trend === 'up' && <span className="text-[9px] font-bold text-green-400">▲</span>}
                    {trend === 'down' && <span className="text-[9px] font-bold text-red-400">▼</span>}
                </div>
            </div>
            <div className="mt-3 flex items-end gap-1 h-8">
                {weeklyGrowth.map((val, i) => (
                    <div
                        key={i}
                        className="flex-1 rounded-sm bg-pink-500/10 hover:bg-pink-500/20 transition-colors"
                        style={{ height: `${Math.max(5, (val / maxVal) * 100)}%` }}
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
        <div className="flex flex-col h-full justify-between">
            <div className="flex items-center gap-2 mb-3">
                <div className="w-6 h-6 rounded-lg bg-teal-500/10 flex items-center justify-center">
                    <Activity size={12} className="text-teal-400" />
                </div>
                <span className="text-[10px] font-semibold text-white/50 uppercase tracking-[0.15em]">Active Campaigns</span>
            </div>
            <div>
                <p className={`text-4xl font-semibold text-white tracking-tight ${isLoading ? 'animate-pulse opacity-50' : ''}`}>
                    {data?.activeCount ?? 0}
                </p>
                <p className="text-[10px] text-indigo-200/50 mt-1 font-medium">Campaigns running now</p>
            </div>
            <div className="mt-3">
                {data?.topCampaign ? (
                    <div className="p-2 rounded-lg bg-teal-500/5 border border-teal-500/10">
                        <p className="text-[10px] text-teal-400/80 truncate">{data.topCampaign.name}</p>
                        <p className="text-[9px] text-white/20">{data.topCampaign.platform} · {data.totalBudget.formatted} budget</p>
                    </div>
                ) : (
                    <p className="text-[10px] text-white/30">Launch a campaign to track performance</p>
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
        urgent: 'bg-red-500/10 text-red-400',
        high: 'bg-orange-500/10 text-orange-400',
        medium: 'bg-yellow-500/10 text-yellow-400',
        low: 'bg-gray-500/10 text-gray-400',
    };

    return (
        <div className="flex flex-col h-full justify-between">
            <div className="flex items-center gap-2 mb-3">
                <div className="w-6 h-6 rounded-lg bg-orange-500/10 flex items-center justify-center">
                    <CheckSquare size={12} className="text-orange-400" />
                </div>
                <span className="text-[10px] font-semibold text-white/50 uppercase tracking-[0.15em]">Pending Tasks</span>
            </div>
            <div>
                <p className={`text-4xl font-semibold text-white tracking-tight ${isLoading ? 'animate-pulse opacity-50' : ''}`}>
                    {data?.totalCount ?? 0}
                </p>
                <p className="text-[10px] text-indigo-200/50 mt-1 font-medium">Tasks require your attention</p>
            </div>
            <div className="mt-3 space-y-1">
                {data && data.tasks.length > 0 ? (
                    data.tasks.slice(0, 3).map((task) => (
                        <div key={task.id} className="flex items-center gap-2">
                            <span className={`text-[8px] font-bold px-1 py-0.5 rounded ${priorityColors[task.priority] || 'bg-white/5 text-white/30'}`}>
                                {(task.priority?.[0] ?? 'M').toUpperCase()}
                            </span>
                            <p className="text-[10px] text-white/50 truncate">{task.title}</p>
                        </div>
                    ))
                ) : (
                    <p className="text-[10px] text-white/30">All caught up!</p>
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
        <div className="flex flex-col h-full justify-between">
            <div className="flex items-center gap-2 mb-3">
                <div className="w-6 h-6 rounded-lg bg-cyan-500/10 flex items-center justify-center">
                    <ThumbsUp size={12} className="text-cyan-400" />
                </div>
                <span className="text-[10px] font-semibold text-white/50 uppercase tracking-[0.15em]">Social Engagement</span>
            </div>
            <div>
                <p className={`text-4xl font-semibold text-white tracking-tight ${isLoading ? 'animate-pulse opacity-50' : ''}`}>
                    {data?.engagementRate.formatted || '--'}
                </p>
                <p className="text-[10px] text-indigo-200/50 mt-1 font-medium">Avg. engagement rate</p>
            </div>
            <div className="mt-3 flex items-end gap-1 h-8">
                {weeklyEngagement.map((val, i) => (
                    <div
                        key={i}
                        className="flex-1 rounded-sm bg-cyan-500/10 hover:bg-cyan-500/20 transition-colors"
                        style={{ height: `${Math.max(5, (val / maxVal) * 100)}%` }}
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

    const statusLabel: Record<string, { text: string; color: string }> = {
        synced: { text: 'Fully synced', color: 'text-green-400' },
        outdated: { text: 'Needs update', color: 'text-yellow-400' },
        missing: { text: 'Not configured', color: 'text-white/30' },
    };
    const defaultStatus = { text: 'Not configured', color: 'text-white/30' };
    const statusText = (statusLabel[data?.assetsStatus || 'missing'] ?? defaultStatus).text;
    const statusColor = (statusLabel[data?.assetsStatus || 'missing'] ?? defaultStatus).color;

    return (
        <div className="flex flex-col h-full justify-between">
            <div className="flex items-center gap-2 mb-3">
                <div className="w-6 h-6 rounded-lg bg-fuchsia-500/10 flex items-center justify-center">
                    <Palette size={12} className="text-fuchsia-400" />
                </div>
                <span className="text-[10px] font-semibold text-white/50 uppercase tracking-[0.15em]">Brand Integrity</span>
            </div>
            <div>
                <p className={`text-4xl font-semibold text-white tracking-tight ${isLoading ? 'animate-pulse opacity-50' : ''}`}>
                    {data?.complianceScore.formatted || '--'}
                </p>
                <p className={`text-[10px] mt-1 font-medium ${statusColor}`}>{statusText}</p>
            </div>
            <div className="mt-3">
                {data && data.issues > 0 ? (
                    <p className="text-[10px] text-yellow-400/60">{data.issues} issue{data.issues !== 1 ? 's' : ''} to resolve</p>
                ) : (
                    <p className="text-[10px] text-white/30">Ready for automated marketing</p>
                )}
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
        <div className="flex flex-col h-full justify-between">
            <div className="flex items-center gap-2 mb-3">
                <div className="w-6 h-6 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                    <ShoppingBag size={12} className="text-emerald-400" />
                </div>
                <span className="text-[10px] font-semibold text-white/50 uppercase tracking-[0.15em]">Merchandise</span>
            </div>
            <div>
                <p className={`text-4xl font-semibold text-white tracking-tight ${isLoading ? 'animate-pulse opacity-50' : ''}`}>
                    {data?.weeklyRevenue.formatted || '$0'}
                </p>
                <p className="text-[10px] text-indigo-200/50 mt-1 font-medium">Sales this week</p>
            </div>
            <div className="mt-3">
                {data?.topProduct ? (
                    <div className="p-2 rounded-lg bg-emerald-500/5 border border-emerald-500/10">
                        <p className="text-[10px] text-emerald-400/80 truncate">{data.topProduct.name}</p>
                        <p className="text-[9px] text-white/20">{data.topProduct.unitsSold} units sold</p>
                    </div>
                ) : data?.lowStockAlerts && data.lowStockAlerts > 0 ? (
                    <p className="text-[10px] text-yellow-400/60">{data.lowStockAlerts} low stock alert{data.lowStockAlerts !== 1 ? 's' : ''}</p>
                ) : (
                    <p className="text-[10px] text-white/30">Connect Shopify or set up print-on-demand</p>
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
        <div className="flex flex-col h-full justify-between">
            <div className="flex items-center gap-2 mb-3">
                <div className="w-6 h-6 rounded-lg bg-rose-500/10 flex items-center justify-center">
                    <MapPin size={12} className="text-rose-400" />
                </div>
                <span className="text-[10px] font-semibold text-white/50 uppercase tracking-[0.15em]">Tour & Shows</span>
            </div>
            <div>
                <p className={`text-4xl font-semibold text-white tracking-tight ${isLoading ? 'animate-pulse opacity-50' : ''}`}>
                    {data?.upcomingShows ?? 0}
                </p>
                <p className="text-[10px] text-indigo-200/50 mt-1 font-medium">Upcoming shows</p>
            </div>
            <div className="mt-3">
                {data?.nextShow ? (
                    <div className="p-2 rounded-lg bg-rose-500/5 border border-rose-500/10">
                        <p className="text-[10px] text-rose-400/80 truncate">{data.nextShow.venue}</p>
                        <p className="text-[9px] text-white/20">{data.nextShow.city} · {data.nextShow.ticketsSold}/{data.nextShow.capacity} tickets</p>
                    </div>
                ) : (
                    <p className="text-[10px] text-white/30">Route a new tour to start tracking</p>
                )}
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
