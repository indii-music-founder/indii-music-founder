import React, { useState } from 'react';
import { Megaphone, TrendingUp, Users, Calendar, MoreHorizontal, Plus, Activity } from 'lucide-react';
import { useStore } from '@/core/store';
import { ModuleDashboard } from '@/components/layout/ModuleDashboard';
import { useMarketing } from '@/modules/marketing/hooks/useMarketing';
import CreateCampaignModal from './components/CreateCampaignModal';
import BrandManager from './components/BrandManager';
import PostGenerator from './components/PostGenerator';

export default function MarketingDashboard() {
    const { currentModule } = useStore();
    const [activeTab, setActiveTab] = useState<'overview' | 'generator' | 'brand'>('overview');
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

    // Use the new Beta hook
    // Use the new Beta hook
    const {
        stats,
        campaigns,
        isLoading,
        error,
        actions
    } = useMarketing();

    // Actions Component
    const DashboardActions = (
        <>
            <button
                onClick={() => useStore.setState({ currentModule: 'social' })}
                className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white font-medium rounded-lg transition-colors flex items-center gap-2 border border-gray-700"
            >
                <Megaphone size={18} /> Social Media
            </button>
            <button
                onClick={() => setIsCreateModalOpen(true)}
                className="px-6 py-2 bg-dept-marketing hover:bg-dept-marketing/90 text-white font-bold rounded-lg transition-colors flex items-center gap-2 shadow-lg shadow-dept-marketing/20"
            >
                <Plus size={20} /> Create Campaign
            </button>
        </>
    );

    // Dynamic Calendar Logic
    const today = new Date();
    const currentMonth = today.toLocaleString('default', { month: 'long' });
    const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).getDay(); // 0 is Sunday

    const renderCalendarGrid = () => {
        const days = [];

        // Empty cells for start of month
        for (let i = 0; i < firstDayOfMonth; i++) {
            days.push(<div key={`empty-${i}`} className="h-32 bg-background border border-border/50"></div>);
        }

        // Days of month
        for (let i = 1; i <= daysInMonth; i++) {
            // Find active campaigns for this day
            const campaignsForDay = campaigns.filter(c => {
                const start = new Date(c.startDate);
                // Simple equality check for day (Beta v1 logic)
                // In production, checking fully overlapping date ranges would be better
                return !isNaN(start.getTime()) && start.getDate() === i && start.getMonth() === today.getMonth();
            });

            days.push(
                <div key={i} className="h-32 bg-background border border-border/50 p-2 relative group hover:bg-surface transition-colors">
                    <span className={`text-sm font-mono ${i === today.getDate() ? 'text-dept-marketing font-bold' : 'text-muted-foreground'}`}>
                        {i}
                    </span>

                    <div className="mt-1 space-y-1 overflow-y-auto max-h-[80px] custom-scrollbar">
                        {campaignsForDay.map(campaign => (
                            <div key={campaign.id} className="p-1.5 rounded bg-blue-900/20 border border-blue-800/50 text-xs cursor-pointer hover:bg-blue-900/40 transition-colors group/item">
                                <div className="font-semibold text-blue-300 truncate">{campaign.title}</div>
                                <div className="text-blue-400/70 flex items-center gap-1 mt-0.5 text-[10px]">
                                    <span className="w-1 h-1 rounded-full bg-blue-500"></span>
                                    {campaign.posts?.[0]?.platform || "Campaign"}
                                </div>
                            </div>
                        ))}
                    </div>

                    <button className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 p-1 hover:bg-gray-700 rounded text-gray-400 transition-opacity">
                        <Plus size={14} />
                    </button>
                </div>
            );
        }
        return days;
    };

    if (error) {
        return (
            <div className="p-8 text-center">
                <div className="bg-red-500/10 text-red-400 p-4 rounded-lg inline-block">
                    Error loading marketing data: {error.message}
                </div>
            </div>
        );
    }

    return (
        <ModuleDashboard
            title="Marketing Dashboard"
            description="Plan, execute, and track your campaigns."
            icon={<Megaphone className="text-dept-marketing" />}
            actions={DashboardActions}
            tabs={[
                { label: 'Overview', value: 'overview' },
                { label: 'Post Generator', value: 'generator' },
                { label: 'Brand Manager', value: 'brand' }
            ]}
            activeTab={activeTab}
            onTabChange={(val) => setActiveTab(val as any)}
        >
            {activeTab === 'overview' ? (
                <div className="animate-in fade-in duration-500">
                    {/* Stats Row */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                        <StatusCard
                            title="Total Reach"
                            value={isLoading ? "..." : (stats?.totalReach || 0).toLocaleString()}
                            icon={<Users size={24} />}
                            trend="+12% this month"
                            color="blue"
                        />
                        <StatusCard
                            title="Engagement Rate"
                            value={isLoading ? "..." : (stats?.engagementRate || 0) + '%'}
                            icon={<Activity size={24} />}
                            trend="+0.5% this month"
                            color="purple"
                        />
                        <StatusCard
                            title="Active Campaigns"
                            value={isLoading ? "..." : (stats?.activeCampaigns || 0).toString()}
                            icon={<Megaphone size={24} />}
                            subtext={`${campaigns.length} total`}
                            color="pink"
                        />
                    </div>

                    {isCreateModalOpen && (
                        <CreateCampaignModal
                            onClose={() => setIsCreateModalOpen(false)}
                            onSave={() => {
                                // Refresh is automatic via onSnapshot, but we close modal
                                setIsCreateModalOpen(false);
                            }}
                        />
                    )}

                    {/* Calendar Section */}
                    <div className="bg-surface border border-border rounded-xl overflow-hidden shadow-sm">
                        <div className="p-6 border-b border-border flex items-center justify-between">
                            <h3 className="text-lg font-semibold flex items-center gap-2 text-foreground">
                                <Calendar size={18} className="text-muted-foreground" />
                                {currentMonth} Campaign Calendar
                            </h3>
                            <div className="flex items-center gap-4">
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                    <span className="w-2 h-2 rounded-full bg-dept-social"></span> Social
                                    <span className="w-2 h-2 rounded-full bg-dept-creative ml-2"></span> Email
                                    <span className="w-2 h-2 rounded-full bg-green-500 ml-2"></span> Content
                                </div>
                                <button className="p-2 hover:bg-surface-elevated rounded text-muted-foreground transition-colors">
                                    <MoreHorizontal size={20} />
                                </button>
                            </div>
                        </div>

                        {/* Calendar Grid Header */}
                        <div className="grid grid-cols-7 bg-background border-b border-border">
                            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, i) => (
                                <div key={day} className={`py-3 text-center text-xs font-semibold ${i === 0 || i === 6 ? 'text-muted-foreground/70' : 'text-muted-foreground'} uppercase tracking-wider`}>
                                    {day}
                                </div>
                            ))}
                        </div>

                        {/* Calendar Grid Body */}
                        <div className="grid grid-cols-7 bg-background">
                            {renderCalendarGrid()}
                        </div>
                    </div>
                </div>
            ) : activeTab === 'brand' ? (
                <BrandManager />
            ) : (
                <PostGenerator />
            )}
        </ModuleDashboard>
    );
}

// Helper Component for Stats
function StatusCard({ title, value, icon, trend, subtext, color }: { title: string, value: string, icon: React.ReactNode, trend?: string, subtext?: string, color: 'blue' | 'purple' | 'pink' }) {
    const colorClasses = {
        blue: { bg: 'bg-dept-social/10', text: 'text-dept-social' },
        purple: { bg: 'bg-dept-creative/10', text: 'text-dept-creative' },
        pink: { bg: 'bg-dept-marketing/10', text: 'text-dept-marketing' }
    };

    return (
        <div className="bg-surface border border-border rounded-xl p-6 flex items-center justify-between hover:border-border/80 transition-colors shadow-sm">
            <div>
                <p className="text-muted-foreground text-sm mb-1">{title}</p>
                <h3 className="text-2xl font-bold text-foreground mb-1">
                    {value}
                </h3>
                {trend && (
                    <span className="text-green-400 text-xs flex items-center gap-1">
                        <TrendingUp size={12} /> {trend}
                    </span>
                )}
                {subtext && (
                    <span className="text-muted-foreground text-xs block">
                        {subtext}
                    </span>
                )}
            </div>
            <div className={`p-3 rounded-lg ${colorClasses[color].bg} ${colorClasses[color].text}`}>
                {icon}
            </div>
        </div>
    );
}

