import React, { useState, useEffect } from 'react';
import { Megaphone, Calendar, Plus, TrendingUp, Users, MoreHorizontal, UserPlus, Clock, Hash, Zap, BarChart3, Radio } from 'lucide-react';
import { useToast } from '@/core/context/ToastContext';
import CreatePostModal from './components/CreatePostModal';
import AccountCreationWizard from './components/AccountCreationWizard';
import { SocialService } from '@/services/social/SocialService';
import { SocialStats, ScheduledPost } from '@/services/social/types';
import type { ScheduledPost as ModalPost } from './types';
import { useStore } from '@/core/store';
import { useSocial } from './hooks/useSocial';
import SocialFeed from './components/SocialFeed';
import { logger } from '@/utils/logger';
import { ModuleErrorBoundary } from '@/core/components/ModuleErrorBoundary';

/* ================================================================== */
/*  Social Dashboard — Three-Panel Layout                               */
/*                                                                     */
/*  ┌──────────┬───────────────────────────┬──────────────┐            */
/*  │  LEFT    │    CENTER                 │   RIGHT      │            */
/*  │  Account │    Content Calendar       │   Drafts     │            */
/*  │  Toggles │    (full-width grid)      │   Queue      │            */
/*  │  Filters │    Social Feed            │   Platform   │            */
/*  │  Best    │                           │   Status     │            */
/*  │  Times   │                           │   Trending   │            */
/*  └──────────┴───────────────────────────┴──────────────┘            */
/* ================================================================== */

export default function SocialDashboard() {
    const toast = useToast();
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [isAccountWizardOpen, setIsAccountWizardOpen] = useState(false);

    const {
        stats,
        scheduledPosts,
        actions
    } = useSocial();

    useEffect(() => {
        actions.refreshDashboard();
    }, [actions]);

    const handleCreatePost = async (post: ModalPost) => {
        try {
            const scheduledTimeNum = post.scheduledTime instanceof Date
                ? post.scheduledTime.getTime()
                : post.scheduledTime
                    ? new Date(post.scheduledTime as unknown as string).getTime()
                    : Date.now();

            const success = await actions.schedulePost({
                platform: post.platform,
                copy: post.copy,
                imageAsset: post.imageAsset,
                day: post.day,
                scheduledTime: scheduledTimeNum
            });
        } catch (error) {
            logger.error("Operation failed:", error);
        }
    };

    // Dynamic Calendar Data
    const now = new Date();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const startDay = new Date(now.getFullYear(), now.getMonth(), 1).getDay();

    const campaigns = scheduledPosts.map(p => ({
        day: p.scheduledTime ? new Date(p.scheduledTime).getDate() : now.getDate(),
        title: p.copy.substring(0, 20) + "...",
        type: "social",
        platform: p.platform
    }));

    const renderCalendarGrid = () => {
        const days = [];
        for (let i = 0; i < startDay; i++) {
            days.push(<div key={`empty-${i}`} className="h-28 bg-white/[0.01] border border-white/5"></div>);
        }
        for (let i = 1; i <= daysInMonth; i++) {
            const campaign = campaigns.find(c => c.day === i);
            days.push(
                <div key={i} className="h-28 bg-white/[0.01] border border-white/5 p-2 relative group hover:bg-white/[0.03] transition-colors">
                    <span className="text-gray-500 text-xs font-mono">{i}</span>
                    {campaign && (
                        <div className="mt-1 p-1.5 rounded bg-blue-900/20 border border-blue-800/50 text-[10px] cursor-pointer hover:bg-blue-900/40 transition-colors">
                            <div className="font-bold text-blue-300 truncate">{campaign.title}</div>
                            <div className="text-blue-400/70 flex items-center gap-1 mt-0.5">
                                <span className="w-1 h-1 rounded-full bg-blue-500"></span>
                                {campaign.platform}
                            </div>
                        </div>
                    )}
                    <button
                        onClick={() => setIsCreateModalOpen(true)}
                        aria-label={`Create post for ${new Date(now.getFullYear(), now.getMonth(), i).toLocaleDateString()}`}
                        className="absolute bottom-1 right-1 opacity-0 group-hover:opacity-100 p-1 hover:bg-white/10 rounded text-gray-400 transition-opacity"
                    >
                        <Plus size={12} />
                    </button>
                </div>
            );
        }
        return days;
    };

    return (
        <ModuleErrorBoundary moduleName="Social">
            <div className="absolute inset-0 flex">
                {/* ── LEFT PANEL — Accounts & Filters ────────────────── */}
                <aside className="hidden lg:flex w-64 xl:w-72 2xl:w-80 flex-col border-r border-white/5 overflow-y-auto p-3 gap-3 flex-shrink-0">
                    <AccountStatsPanel stats={stats} />
                    <PlatformFiltersPanel />
                    <BestTimesPanel />
                </aside>

                {/* ── CENTER — Calendar & Feed ────────────────────────── */}
                <div className="flex-1 flex flex-col min-w-0">
                    {/* Header */}
                    <div className="px-4 md:px-6 py-4 border-b border-white/5 flex-shrink-0 relative overflow-hidden">
                        <div className="absolute top-[-80px] left-[-80px] w-[300px] h-[300px] bg-blue-500/8 blur-[100px] pointer-events-none rounded-full" />
                        <div className="relative z-10 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center shadow-lg shadow-blue-500/20">
                                    <Megaphone size={18} className="text-white" />
                                </div>
                                <div>
                                    <h1 className="text-2xl font-black text-white tracking-tighter uppercase">Social</h1>
                                    <p className="text-muted-foreground font-medium tracking-wide text-[10px]">CONTENT CALENDAR & SCHEDULING</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setIsAccountWizardOpen(true)}
                                    className="flex items-center gap-1.5 px-3 py-2 bg-white/5 hover:bg-white/10 text-white rounded-lg transition-colors text-xs font-bold border border-white/5"
                                >
                                    <UserPlus size={14} /> Add Account
                                </button>
                                <button
                                    onClick={() => setIsCreateModalOpen(true)}
                                    className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg transition-colors text-xs"
                                >
                                    <Plus size={14} /> Create Post
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Content */}
                    <div className="flex-1 overflow-y-auto custom-scrollbar">
                        <div className="p-4 md:p-6 space-y-6">
                            {/* Calendar */}
                            <div className="rounded-xl bg-white/[0.02] border border-white/5 overflow-hidden">
                                <div className="p-4 border-b border-white/5 flex items-center justify-between">
                                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                                        <Calendar size={14} className="text-gray-400" />
                                        Content Calendar
                                    </h3>
                                    <div className="flex items-center gap-3 text-[10px] text-gray-500">
                                        <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span> Social</span>
                                        <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-purple-500"></span> Email</span>
                                        <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-green-500"></span> Content</span>
                                    </div>
                                </div>
                                <div className="overflow-x-auto">
                                    <div className="min-w-[700px]">
                                        <div className="grid grid-cols-7 border-b border-white/5">
                                            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                                                <div key={day} className="py-2 text-center text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                                                    {day}
                                                </div>
                                            ))}
                                        </div>
                                        <div className="grid grid-cols-7">
                                            {renderCalendarGrid()}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Social Feed */}
                            <SocialFeed />
                        </div>
                    </div>
                </div>

                {/* ── RIGHT PANEL — Queue & Trends ───────────────────── */}
                <aside className="hidden lg:flex w-72 2xl:w-80 flex-col border-l border-white/5 overflow-y-auto p-3 gap-3 flex-shrink-0">
                    <DraftsQueuePanel scheduledPosts={scheduledPosts} />
                    <PlatformStatusPanel />
                    <TrendingTopicsPanel />
                </aside>

                {/* Modals */}
                {isCreateModalOpen && (
                    <CreatePostModal
                        onClose={() => setIsCreateModalOpen(false)}
                        onSave={handleCreatePost}
                    />
                )}

                {isAccountWizardOpen && (
                    <AccountCreationWizard
                        onClose={() => setIsAccountWizardOpen(false)}
                    />
                )}
            </div>
        </ModuleErrorBoundary>
    );
}

/* ================================================================== */
/*  Left Panel Widgets                                                  */
/* ================================================================== */

function AccountStatsPanel({ stats }: { stats: SocialStats | null }) {
    const items = [
        { label: 'Total Reach', value: (stats?.followers || 0).toLocaleString(), icon: Users, color: 'text-blue-400' },
        { label: 'Following', value: (stats?.following || 0).toLocaleString(), icon: TrendingUp, color: 'text-purple-400' },
        { label: 'Posts', value: (stats?.posts || 0).toLocaleString(), icon: Megaphone, color: 'text-pink-400' },
    ];

    return (
        <div className="rounded-xl bg-white/[0.02] border border-white/5 p-3">
            <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3 px-1">Account Stats</h3>
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

function PlatformFiltersPanel() {
    const platforms = [
        { name: 'Instagram', color: 'bg-pink-500', active: false },
        { name: 'TikTok', color: 'bg-white', active: false },
        { name: 'Twitter / X', color: 'bg-blue-400', active: false },
        { name: 'YouTube', color: 'bg-red-500', active: false },
    ];

    return (
        <div className="rounded-xl bg-white/[0.02] border border-white/5 p-3">
            <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3 px-1">Platforms</h3>
            <div className="space-y-1">
                {platforms.map((p) => (
                    <div key={p.name} className="flex items-center gap-2 py-2 px-2 rounded-lg hover:bg-white/[0.04] transition-colors cursor-pointer">
                        <div className={`w-2 h-2 rounded-full ${p.color}`} />
                        <span className="text-xs text-gray-300 flex-1">{p.name}</span>
                        <div className={`w-3 h-3 rounded-sm border flex items-center justify-center ${p.active ? 'bg-blue-500/20 border-blue-500/40' : 'border-white/10'}`}>
                            {p.active && <div className="w-1.5 h-1.5 rounded-sm bg-blue-400" />}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

function BestTimesPanel() {
    // Best times would be fetched from analytics — empty until connected
    const times: { day: string; time: string; engagement: string }[] = [];

    return (
        <div className="rounded-xl bg-white/[0.02] border border-white/5 p-3">
            <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3 px-1">Best Posting Times</h3>
            {times.length === 0 ? (
                <p className="text-xs text-gray-600 px-1">Connect accounts to analyze optimal posting times.</p>
            ) : (
                <div className="space-y-1">
                    {times.map((t) => (
                        <div key={t.day} className="flex items-center justify-between py-2 px-2 rounded-lg hover:bg-white/[0.02] transition-colors">
                            <div className="flex items-center gap-2">
                                <Clock size={10} className="text-gray-500" />
                                <span className="text-xs text-gray-300">{t.day}</span>
                            </div>
                            <span className="text-[10px] text-gray-400">{t.time}</span>
                            <span className={`text-[10px] font-bold ${t.engagement === 'Peak' ? 'text-green-400' : t.engagement === 'High' ? 'text-blue-400' : 'text-gray-500'}`}>
                                {t.engagement}
                            </span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

/* ================================================================== */
/*  Right Panel Widgets                                                 */
/* ================================================================== */

function DraftsQueuePanel({ scheduledPosts }: { scheduledPosts: ScheduledPost[] }) {
    const upcoming = scheduledPosts.slice(0, 5);

    return (
        <div className="rounded-xl bg-white/[0.02] border border-white/5 p-3">
            <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3 px-1">
                Queue ({scheduledPosts.length})
            </h3>
            {upcoming.length === 0 ? (
                <p className="text-xs text-gray-600 px-1">No scheduled posts.</p>
            ) : (
                <div className="space-y-1">
                    {upcoming.map((p, i) => (
                        <div key={i} className="py-2 px-2 rounded-lg hover:bg-white/[0.02] transition-colors">
                            <p className="text-xs text-white truncate">{p.copy.substring(0, 40)}...</p>
                            <div className="flex items-center gap-2 mt-1">
                                <span className="text-[10px] text-gray-600">{p.platform}</span>
                                <span className="text-[10px] text-gray-600">
                                    {p.scheduledTime ? new Date(p.scheduledTime).toLocaleDateString() : 'TBD'}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

function PlatformStatusPanel() {
    const platforms = [
        { name: 'Instagram', status: 'Not Connected', ok: false },
        { name: 'TikTok', status: 'Not Connected', ok: false },
        { name: 'Twitter / X', status: 'Not Connected', ok: false },
        { name: 'YouTube', status: 'Not Connected', ok: false },
    ];

    return (
        <div className="rounded-xl bg-white/[0.02] border border-white/5 p-3">
            <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3 px-1">Platform Status</h3>
            <div className="space-y-2">
                {platforms.map((p) => (
                    <div key={p.name} className="flex items-center justify-between py-1.5 px-2">
                        <span className="text-xs text-gray-300">{p.name}</span>
                        <div className="flex items-center gap-1.5">
                            <Radio size={8} className={p.ok ? 'text-green-400' : 'text-gray-600'} />
                            <span className={`text-[10px] font-bold ${p.ok ? 'text-green-400' : 'text-gray-600'}`}>
                                {p.status}
                            </span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

function TrendingTopicsPanel() {
    // Trending topics would be fetched from social APIs — empty until connected
    const topics: { tag: string; posts: string }[] = [];

    return (
        <div className="rounded-xl bg-white/[0.02] border border-white/5 p-3">
            <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3 px-1">Trending Topics</h3>
            {topics.length === 0 ? (
                <p className="text-xs text-gray-600 px-1">No trending data available yet.</p>
            ) : (
                <div className="space-y-1">
                    {topics.map((t) => (
                        <div key={t.tag} className="flex items-center justify-between py-2 px-2 rounded-lg hover:bg-white/[0.02] transition-colors cursor-pointer">
                            <div className="flex items-center gap-2">
                                <Hash size={10} className="text-blue-400" />
                                <span className="text-xs text-blue-300 font-bold">{t.tag}</span>
                            </div>
                            <span className="text-[10px] text-gray-500">{t.posts}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

// Helper Icon Component
function ActivityIcon({ size, className }: { size: number, className?: string }) {
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={className}
        >
            <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
        </svg>
    );
}
