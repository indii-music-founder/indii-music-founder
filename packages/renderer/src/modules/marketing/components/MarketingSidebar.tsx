import React, { useState } from 'react';
import {
    LayoutDashboard,
    Megaphone,
    Calendar,
    BarChart,
    Settings,
    History,
    Target,
    Wand2,
    DollarSign,
    Mail,
    Bookmark,
    MessageSquare,
    Users,
    FileText,
    Hash,
    Star,
    TrendingUp,
    Share2
} from 'lucide-react';
import { motion } from 'motion/react';

interface MarketingSidebarProps {
    activeTab: string;
    onTabChange: (tab: string) => void;
}

export const MarketingSidebar: React.FC<MarketingSidebarProps> = ({ activeTab, onTabChange }) => {
    const [collapsed, setCollapsed] = useState(false);

    const mainNav = [
        { id: 'overview', label: 'Overview', icon: LayoutDashboard },
        { id: 'campaigns', label: 'Campaigns', icon: Megaphone },
        { id: 'asset-generator', label: 'Asset Generator', icon: Wand2 },
        { id: 'auto-poster', label: 'Auto-Poster', icon: Share2 },
        { id: 'momentum', label: 'Momentum', icon: TrendingUp },
    ];

    const growthNav = [
        { id: 'ad-buying', label: 'Ad Buying', icon: DollarSign },
        { id: 'email', label: 'Email Marketing', icon: Mail },
        { id: 'pre-save', label: 'Pre-Save Builder', icon: Bookmark },
        { id: 'sms', label: 'SMS Engine', icon: MessageSquare },
        { id: 'fan-data', label: 'Fan Enrichment', icon: Users },
        { id: 'epk', label: 'Press Kit (EPK)', icon: FileText },
        { id: 'community', label: 'Community Webhook', icon: Hash },
        { id: 'influencers', label: 'Influencer Board', icon: Star },
    ];

    const secondaryNav = [
        { id: 'calendar', label: 'Calendar', icon: Calendar },
        { id: 'analytics', label: 'Analytics', icon: BarChart },
        { id: 'history', label: 'History', icon: History },
        { id: 'audiences', label: 'Audiences', icon: Target },
        { id: 'settings', label: 'Settings', icon: Settings },
    ];

    return (
        <div className="h-full flex flex-col bg-background/40 border-r border-white/5 backdrop-blur-xl w-64 flex-shrink-0 transition-all duration-300">
            {/* Header */}
            <div className="h-16 flex items-center px-6 border-b border-white/5">
                <div className="h-8 w-8 bg-dept-marketing rounded-lg flex items-center justify-center mr-3 shadow-lg shadow-dept-marketing/20">
                    <Megaphone size={18} className="text-white" />
                </div>
                <span className="font-bold text-white tracking-wide">Marketing</span>
            </div>

            {/* Navigation */}
            <div className="flex-1 overflow-y-auto py-6 px-3 space-y-8 custom-scrollbar">

                {/* Main Section */}
                <div>
                    <h3 className="px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                        Management
                    </h3>
                    <div className="space-y-1">
                        {mainNav.map((item) => (
                            <button
                                key={item.id}
                                onClick={() => onTabChange(item.id)}
                                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group ${activeTab === item.id
                                    ? 'bg-dept-marketing/10 text-dept-marketing font-medium'
                                    : 'text-gray-400 hover:bg-white/5 hover:text-gray-200'
                                    }`}
                            >
                                <item.icon
                                    size={18}
                                    className={`transition-colors ${activeTab === item.id ? 'text-dept-marketing' : 'text-gray-500 group-hover:text-gray-400'
                                        }`}
                                />
                                <span>{item.label}</span>
                                {activeTab === item.id && (
                                    <motion.div
                                        layoutId="sidebar-active"
                                        className="ml-auto w-1.5 h-1.5 rounded-full bg-dept-marketing"
                                    />
                                )}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Growth Tools Section */}
                <div>
                    <h3 className="px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                        Growth Tools
                    </h3>
                    <div className="space-y-1">
                        {growthNav.map((item) => (
                            <button
                                key={item.id}
                                onClick={() => onTabChange(item.id)}
                                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group ${activeTab === item.id
                                    ? 'bg-dept-marketing/10 text-dept-marketing font-medium'
                                    : 'text-gray-400 hover:bg-white/5 hover:text-gray-200'
                                    }`}
                            >
                                <item.icon
                                    size={18}
                                    className={`transition-colors ${activeTab === item.id ? 'text-dept-marketing' : 'text-gray-500 group-hover:text-gray-400'
                                        }`}
                                />
                                <span>{item.label}</span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Secondary Section */}
                <div>
                    <h3 className="px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                        Resources
                    </h3>
                    <div className="space-y-1">
                        {secondaryNav.map((item) => (
                            <button
                                key={item.id}
                                onClick={() => onTabChange(item.id)}
                                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group ${activeTab === item.id
                                    ? 'bg-dept-marketing/10 text-dept-marketing font-medium'
                                    : 'text-gray-400 hover:bg-white/5 hover:text-gray-200'
                                    }`}
                            >
                                <item.icon
                                    size={18}
                                    className={`transition-colors ${activeTab === item.id ? 'text-dept-marketing' : 'text-gray-500 group-hover:text-gray-400'
                                        }`}
                                />
                                <span>{item.label}</span>
                            </button>
                        ))}
                    </div>
                </div>

                <div className="px-3 mt-auto">
                    <div className="p-4 rounded-xl bg-dept-marketing/10 border border-dept-marketing/20 relative overflow-hidden group">
                        <h4 className="font-semibold text-dept-marketing mb-1 relative z-10">AI Insights</h4>
                        <p className="text-xs text-gray-400 leading-relaxed relative z-10">
                            Check prediction scores before launching to maximize reach.
                        </p>
                    </div>
                </div>
            </div>

            {/* Module Footer */}
            <div className="p-4 border-t border-white/5">
                <div className="flex items-center gap-3 p-2 rounded-lg bg-white/5 border border-white/5">
                    <div className="h-8 w-8 rounded-full bg-dept-marketing/20 flex items-center justify-center">
                        <Megaphone size={14} className="text-dept-marketing" />
                    </div>
                    <div className="overflow-hidden">
                        <p className="text-sm font-medium text-white truncate">Marketing Studio</p>
                        <p className="text-xs text-gray-500">indiiOS</p>
                    </div>
                </div>
            </div>
        </div>
    );
};
