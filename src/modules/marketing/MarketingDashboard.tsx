import React, { useState } from 'react';
import { Megaphone, Calendar, Plus, TrendingUp, Users, BarChart2, MoreHorizontal } from 'lucide-react';
import { useToast } from '@/core/context/ToastContext';

export default function MarketingDashboard() {
    const toast = useToast();
    const [currentMonth, setCurrentMonth] = useState(new Date());

    const handleCreateCampaign = () => {
        toast.info("Create Campaign modal would open here.");
    };

    // Mock Calendar Data
    const daysInMonth = 30; // Simplified
    const startDay = 2; // Tuesday

    const campaigns = [
        { day: 5, title: "Product Launch Teaser", type: "social", platform: "Instagram" },
        { day: 12, title: "Blog Post: AI Trends", type: "content", platform: "Medium" },
        { day: 15, title: "Newsletter Blast", type: "email", platform: "Mailchimp" },
        { day: 24, title: "Feature Highlight Video", type: "video", platform: "YouTube" },
    ];

    const renderCalendarGrid = () => {
        const days = [];
        // Empty cells for start of month
        for (let i = 0; i < startDay; i++) {
            days.push(<div key={`empty-${i}`} className="h-32 bg-[#0d1117] border border-gray-800/50"></div>);
        }
        // Days
        for (let i = 1; i <= daysInMonth; i++) {
            const campaign = campaigns.find(c => c.day === i);
            days.push(
                <div key={i} className="h-32 bg-[#0d1117] border border-gray-800/50 p-2 relative group hover:bg-[#161b22] transition-colors">
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
        <div className="h-full flex flex-col bg-[#0d1117] text-white p-6 overflow-y-auto">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-bold mb-2 flex items-center gap-3">
                        <Megaphone className="text-pink-500" />
                        Marketing Dashboard
                    </h1>
                    <p className="text-gray-400">Plan, execute, and track your campaigns.</p>
                </div>
                <button
                    onClick={handleCreateCampaign}
                    className="px-6 py-2 bg-pink-600 hover:bg-pink-500 text-white font-bold rounded-lg transition-colors flex items-center gap-2"
                >
                    <Plus size={20} /> Create Campaign
                </button>
            </div>

            {/* Stats Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="bg-[#161b22] border border-gray-800 rounded-xl p-6 flex items-center justify-between">
                    <div>
                        <p className="text-gray-400 text-sm mb-1">Total Reach</p>
                        <h3 className="text-2xl font-bold">124.5K</h3>
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
                        <p className="text-gray-400 text-sm mb-1">Engagement Rate</p>
                        <h3 className="text-2xl font-bold">4.8%</h3>
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
                        <p className="text-gray-400 text-sm mb-1">Active Campaigns</p>
                        <h3 className="text-2xl font-bold">3</h3>
                        <span className="text-gray-500 text-xs mt-1">
                            2 scheduled
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
                        Campaign Calendar
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
                <div className="grid grid-cols-7 bg-[#0d1117] border-b border-gray-800">
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                        <div key={day} className="py-2 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">
                            {day}
                        </div>
                    ))}
                </div>

                {/* Calendar Grid Body */}
                <div className="grid grid-cols-7 bg-[#0d1117]">
                    {renderCalendarGrid()}
                </div>
            </div>
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
