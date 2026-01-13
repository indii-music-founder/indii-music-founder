import React, { useState, useEffect } from 'react';
import { Megaphone, Calendar, Plus, TrendingUp, Users, MoreHorizontal, UserPlus } from 'lucide-react';
import { useToast } from '@/core/context/ToastContext';
import CreatePostModal from './components/CreatePostModal';
import AccountCreationWizard from './components/AccountCreationWizard';
import { SocialService } from '@/services/social/SocialService';
import { SocialStats, ScheduledPost } from '@/services/social/types';
import { useStore } from '@/core/store';
import { useSocial } from './hooks/useSocial';
import SocialFeed from './components/SocialFeed';

export default function SocialDashboard() {
    const toast = useToast();
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [isAccountWizardOpen, setIsAccountWizardOpen] = useState(false);

    // Use the hook for data
    const {
        stats,
        scheduledPosts,
        actions
    } = useSocial(); // No userId needed for my dashboard

    useEffect(() => {
        actions.refreshDashboard();
    }, [actions]);

    const handleCreatePost = async (post: any) => {
        try {
            // Convert to service type (Date -> number)
            const scheduledTimeNum = post.scheduledTime instanceof Date
                ? post.scheduledTime.getTime()
                : new Date(post.scheduledTime).getTime();

            const success = await actions.schedulePost({
                platform: post.platform,
                copy: post.copy,
                imageAsset: post.imageAsset,
                day: post.day,
                scheduledTime: scheduledTimeNum
            });

            if (success) {
                // toast is handled in hook
            }
        } catch (error) {
            console.error(error);
            // toast is handled in hook
        }
    };

    // Dynamic Calendar Data for current month
    const now = new Date();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const startDay = new Date(now.getFullYear(), now.getMonth(), 1).getDay();

    const campaigns = scheduledPosts.map(p => ({
        day: new Date(p.scheduledTime || Date.now()).getDate(),
        title: p.copy.substring(0, 20) + "...",
        type: "social",
        platform: p.platform
    }));

    const renderCalendarGrid = () => {
        const days = [];
        // Empty cells for start of month
        for (let i = 0; i < startDay; i++) {
            days.push(<div key={`empty-${i}`} className="h-32 bg-bg-dark border border-gray-800/50"></div>);
        }
        // Days
        for (let i = 1; i <= daysInMonth; i++) {
            const campaign = campaigns.find(c => c.day === i);
            days.push(
                <div key={i} className="h-32 bg-bg-dark border border-gray-800/50 p-2 relative group hover:bg-[#161b22] transition-colors">
                    <span className="text-gray-500 text-sm font-mono">{i}</span>
                    {campaign && (
                        <div className="mt-2 p-2 rounded bg-blue-900/20 border border-blue-800/50 text-xs cursor-pointer hover:bg-blue-900/40 transition-colors">
                            <div className="font-bold text-blue-300 truncate">{campaign.title}</div>
                            <div className="text-blue-400/70 flex items-center gap-1 mt-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                                {campaign.platform}
                            </div>
                        </div>
                    )}
                    <button className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 p-1 hover:bg-gray-700 rounded text-gray-400 transition-opacity">
                        <Plus size={14} />
                    </button>
                </div>
            );
        }
        return days;
    };

    return (
        <div className="h-full flex flex-col bg-bg-dark text-white p-6 overflow-y-auto">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-bold mb-2 flex items-center gap-3">
                        <Megaphone className="text-blue-500" />
                        Social Media
                    </h1>
                    <p className="text-gray-400">Manage your social presence and campaigns.</p>
                </div>
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => setIsAccountWizardOpen(true)}
                        className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white font-medium rounded-lg transition-colors flex items-center gap-2 border border-gray-700"
                    >
                        <UserPlus size={18} /> Add Account
                    </button>
                    <button
                        onClick={() => setIsCreateModalOpen(true)}
                        className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg transition-colors flex items-center gap-2"
                    >
                        <Plus size={20} /> Create Post
                    </button>
                </div>
            </div>

            {/* Stats Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="bg-[#161b22] border border-gray-800 rounded-xl p-6 flex items-center justify-between">
                    <div>
                        <p className="text-gray-400 text-sm mb-1">Total Reach</p>
                        <h3 className="text-2xl font-bold">{(stats?.followers || 0).toLocaleString()}</h3>
                        <span className="text-green-400 text-xs flex items-center gap-1 mt-1">
                            <TrendingUp size={12} /> +12% this month
                        </span>
                    </div>
                    <div className="p-3 bg-blue-500/10 rounded-lg text-blue-400">
                        <Users size={24} />
                    </div>
                </div>
                <div className="bg-[#161b22] border border-gray-800 rounded-xl p-6 flex items-center justify-between">
                    <div>
                        <p className="text-gray-400 text-sm mb-1">Following</p>
                        <h3 className="text-2xl font-bold">{(stats?.following || 0).toLocaleString()}</h3>
                        <span className="text-green-400 text-xs flex items-center gap-1 mt-1">
                            <TrendingUp size={12} /> +0.5% this month
                        </span>
                    </div>
                    <div className="p-3 bg-purple-500/10 rounded-lg text-purple-400">
                        <ActivityIcon size={24} />
                    </div>
                </div>
                <div className="bg-[#161b22] border border-gray-800 rounded-xl p-6 flex items-center justify-between">
                    <div>
                        <p className="text-gray-400 text-sm mb-1">Posts</p>
                        <h3 className="text-2xl font-bold">{(stats?.posts || 0).toLocaleString()}</h3>
                        <span className="text-gray-500 text-xs mt-1">
                            {scheduledPosts.length} scheduled
                        </span>
                    </div>
                    <div className="p-3 bg-pink-500/10 rounded-lg text-pink-400">
                        <Megaphone size={24} />
                    </div>
                </div>
            </div>

            {/* Calendar Section */}
            <div className="bg-[#161b22] border border-gray-800 rounded-xl overflow-hidden">
                <div className="p-6 border-b border-gray-800 flex items-center justify-between">
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                        <Calendar size={18} className="text-gray-400" />
                        Content Calendar
                    </h3>
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2 text-sm text-gray-400">
                            <span className="w-2 h-2 rounded-full bg-blue-500"></span> Social
                            <span className="w-2 h-2 rounded-full bg-purple-500 ml-2"></span> Email
                            <span className="w-2 h-2 rounded-full bg-green-500 ml-2"></span> Content
                        </div>
                        <button className="p-2 hover:bg-gray-800 rounded text-gray-400">
                            <MoreHorizontal size={20} />
                        </button>
                    </div>
                </div>

                {/* Calendar Grid Header */}
                <div className="grid grid-cols-7 bg-bg-dark border-b border-gray-800">
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                        <div key={day} className="py-2 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">
                            {day}
                        </div>
                    ))}
                </div>

                {/* Calendar Grid Body */}
                <div className="grid grid-cols-7 bg-bg-dark">
                    {renderCalendarGrid()}
                </div>
            </div>

            {/* Social Feed */}
            <div className="mt-8">
                <SocialFeed />
            </div>

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
