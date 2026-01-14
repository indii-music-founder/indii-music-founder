import React, { useState } from 'react';
import {
    LayoutDashboard,
    Megaphone,
    Calendar,
    BarChart,
    Settings,
    Plus,
    History,
    Target
} from 'lucide-react';
import { motion } from 'framer-motion';

interface MarketingSidebarProps {
    activeTab: string;
    onTabChange: (tab: string) => void;
}

export const MarketingSidebar: React.FC<MarketingSidebarProps> = ({ activeTab, onTabChange }) => {
    const [collapsed, setCollapsed] = useState(false);

    const mainNav = [
        { id: 'overview', label: 'Overview', icon: LayoutDashboard },
        { id: 'campaigns', label: 'Campaigns', icon: Megaphone },
        { id: 'calendar', label: 'Calendar', icon: Calendar },
        { id: 'analytics', label: 'Analytics', icon: BarChart },
    ];

    const secondaryNav = [
        { id: 'history', label: 'History', icon: History },
        { id: 'audiences', label: 'Audiences', icon: Target },
        { id: 'settings', label: 'Settings', icon: Settings },
    ];

    return (
        <div className="h-full flex flex-col bg-black/40 border-r border-white/5 backdrop-blur-xl w-64 flex-shrink-0 transition-all duration-300">
            {/* Header */}
            <div className="h-16 flex items-center px-6 border-b border-white/5">
                <div className="h-8 w-8 bg-gradient-to-br from-pink-500 to-purple-600 rounded-lg flex items-center justify-center mr-3 shadow-lg shadow-purple-900/20">
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
                                        ? 'bg-purple-500/10 text-purple-400 font-medium'
                                        : 'text-gray-400 hover:bg-white/5 hover:text-gray-200'
                                    }`}
                            >
                                <item.icon
                                    size={18}
                                    className={`transition-colors ${activeTab === item.id ? 'text-purple-400' : 'text-gray-500 group-hover:text-gray-400'
                                        }`}
                                />
                                <span>{item.label}</span>
                                {activeTab === item.id && (
                                    <motion.div
                                        layoutId="sidebar-active"
                                        className="ml-auto w-1.5 h-1.5 rounded-full bg-purple-400"
                                    />
                                )}
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
                                        ? 'bg-purple-500/10 text-purple-400 font-medium'
                                        : 'text-gray-400 hover:bg-white/5 hover:text-gray-200'
                                    }`}
                            >
                                <item.icon
                                    size={18}
                                    className={`transition-colors ${activeTab === item.id ? 'text-purple-400' : 'text-gray-500 group-hover:text-gray-400'
                                        }`}
                                />
                                <span>{item.label}</span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Pro Tip Card */}
                <div className="px-3 mt-auto">
                    <div className="p-4 rounded-xl bg-gradient-to-br from-purple-900/20 to-pink-900/20 border border-white/5 relative overflow-hidden group">
                        <div className="absolute inset-0 bg-gradient-to-r from-purple-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                        <h4 className="font-semibold text-purple-200 mb-1 relative z-10">AI Insights</h4>
                        <p className="text-xs text-gray-400 leading-relaxed relative z-10">
                            Check prediction scores before launching to maximize reach.
                        </p>
                    </div>
                </div>
            </div>

            {/* User Profile / Footer (Optional placeholder) */}
            <div className="p-4 border-t border-white/5">
                <div className="flex items-center gap-3 p-2 rounded-lg bg-white/5 border border-white/5">
                    <div className="h-8 w-8 rounded-full bg-indigo-500 flex items-center justify-center text-xs font-bold text-white">
                        CM
                    </div>
                    <div className="overflow-hidden">
                        <p className="text-sm font-medium text-white truncate">Campaign Mgr</p>
                        <p className="text-xs text-green-400 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                            Online
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};
