import React, { useState, useEffect } from 'react';
import { Activity, Zap, MessageSquare, Film, Flame, TrendingUp } from 'lucide-react';
import { DashboardService, AnalyticsData } from '@/services/dashboard/DashboardService';
import { AnimatedNumber } from '@/components/motion-primitives/animated-number';

export default function AnalyticsView() {
    const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);

    useEffect(() => {
        DashboardService.getAnalytics().then(setAnalytics);
    }, []);

    // Find max for chart scaling
    const maxActivity = analytics ? Math.max(...analytics.weeklyActivity, 1) : 1;

    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

    return (
        <div className="bg-[#090b0e] border border-white/5 rounded-lg p-6 relative overflow-hidden group hover:border-white/10 transition-all">
            {/* Animated focus gradient */}
            <div className="absolute -top-24 -left-24 w-48 h-48 bg-blue-500/10 rounded-full blur-3xl group-hover:bg-blue-500/20 transition-all duration-700" />

            <div className="flex items-center justify-between mb-6 relative z-10">
                <div className="flex items-center gap-3">
                    <Activity className="text-green-500" size={20} />
                    <h2 className="text-sm font-bold text-white uppercase tracking-widest font-mono">Studio Stats</h2>
                </div>
                {analytics && analytics.streak > 0 && (
                    <div className="flex items-center gap-1.5 bg-gradient-to-r from-orange-500/20 to-red-500/20 px-3 py-1.5 rounded-full border border-orange-500/30">
                        <Flame size={16} className="text-orange-400" />
                        <span className="text-sm font-bold text-orange-300">
                            <AnimatedNumber value={analytics.streak} /> day streak
                        </span>
                    </div>
                )}
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8 relative z-10">
                <div className="bg-[#11161d] p-4 rounded-md border border-white/5 hover:border-blue-500/30 transition-all group/stat">
                    <div className="flex items-center gap-2 text-gray-500 mb-2">
                        <Zap size={14} className="group-hover/stat:text-blue-400" />
                        <span className="text-[10px] uppercase tracking-wider font-mono">Generations</span>
                    </div>
                    <div className="text-2xl font-bold text-white font-mono tracking-tighter">
                        {analytics ? <AnimatedNumber value={analytics.totalGenerations} /> : '—'}
                    </div>
                </div>

                <div className="bg-[#11161d] p-4 rounded-md border border-white/5 hover:border-purple-500/30 transition-all group/stat">
                    <div className="flex items-center gap-2 text-gray-500 mb-2">
                        <MessageSquare size={14} className="group-hover/stat:text-purple-400" />
                        <span className="text-[10px] uppercase tracking-wider font-mono">Messages</span>
                    </div>
                    <div className="text-2xl font-bold text-white font-mono tracking-tighter">
                        {analytics ? <AnimatedNumber value={analytics.totalMessages} /> : '—'}
                    </div>
                </div>

                <div className="bg-[#11161d] p-4 rounded-md border border-white/5 hover:border-green-500/30 transition-all group/stat">
                    <div className="flex items-center gap-2 text-gray-500 mb-2">
                        <Film size={14} className="group-hover/stat:text-green-400" />
                        <span className="text-[10px] uppercase tracking-wider font-mono">Video Secs</span>
                    </div>
                    <div className="text-2xl font-bold text-white font-mono tracking-tighter">
                        {analytics ? <AnimatedNumber value={analytics.totalVideoSeconds} /> : '—'}
                    </div>
                </div>

                <div className="bg-[#11161d] p-4 rounded-md border border-white/5 hover:border-orange-500/30 transition-all group/stat">
                    <div className="flex items-center gap-2 text-gray-500 mb-2">
                        <TrendingUp size={14} className="group-hover/stat:text-orange-400" />
                        <span className="text-[10px] uppercase tracking-wider font-mono">Projects</span>
                    </div>
                    <div className="text-2xl font-bold text-white font-mono tracking-tighter">
                        {analytics ? <AnimatedNumber value={analytics.totalProjects} /> : '—'}
                    </div>
                </div>
            </div>


            {/* Weekly Activity Chart */}
            <div className="mb-6">
                <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3 font-mono">Weekly Activity</h3>
                <div className="h-24 flex items-end justify-between gap-2">
                    {analytics?.weeklyActivity.map((count, i) => (
                        <div key={i} className="flex-1 flex flex-col items-center gap-1">
                            <div
                                className="w-full bg-gradient-to-t from-green-600 to-green-400 rounded-t transition-all duration-500"
                                style={{ height: `${Math.max((count / maxActivity) * 100, 4)}%` }}
                            />
                            <span className="text-[10px] text-gray-500">{days[i]}</span>
                        </div>
                    )) ?? (
                            Array(7).fill(0).map((_, i) => (
                                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                                    <div className="w-full bg-gray-800 rounded-t h-2" />
                                    <span className="text-[10px] text-gray-500">{days[i]}</span>
                                </div>
                            ))
                        )}
                </div>
            </div>

            {/* Word Cloud / Top Prompts */}
            {analytics && analytics.topPromptWords.length > 0 && (
                <div>
                    <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3 font-mono">Top Prompt Words</h3>
                    <div className="flex flex-wrap gap-2">
                        {analytics.topPromptWords.map(({ word, count }, i) => {
                            // Size based on position (first = largest)
                            const sizeClass = i === 0 ? 'text-base px-3 py-1.5' : i < 3 ? 'text-sm px-2.5 py-1' : 'text-xs px-2 py-0.5';
                            const colorClass = i === 0 ? 'bg-purple-500/30 text-purple-300 border-purple-500/40' :
                                i < 3 ? 'bg-blue-500/20 text-blue-300 border-blue-500/30' :
                                    'bg-gray-800 text-gray-400 border-gray-700';
                            return (
                                <span
                                    key={word}
                                    className={`${sizeClass} ${colorClass} rounded-full border font-medium`}
                                    title={`Used ${count} times`}
                                >
                                    {word}
                                </span>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}
