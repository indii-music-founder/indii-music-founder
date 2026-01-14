import React from 'react';
import { Search, Bell, Plus, Filter, Command } from 'lucide-react';

interface MarketingToolbarProps {
    title?: string;
    onAction?: () => void;
    actionLabel?: string;
}

export const MarketingToolbar: React.FC<MarketingToolbarProps> = ({
    title = "Campaign Dashboard",
    onAction,
    actionLabel = "New Campaign"
}) => {
    return (
        <div className="h-16 border-b border-white/5 bg-black/20 backdrop-blur-md flex items-center justify-between px-6 flex-shrink-0 z-10">
            {/* Left: Breadcrumb / Title */}
            <div className="flex items-center gap-4">
                <h1 className="text-lg font-semibold text-white tracking-tight">
                    {title}
                </h1>
                <div className="h-4 w-[1px] bg-white/10 mx-2" />
                <div className="relative group">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-purple-400 transition-colors" />
                    <input
                        type="text"
                        placeholder="Search campaigns..."
                        className="bg-black/20 border border-white/10 rounded-lg pl-9 pr-4 py-1.5 text-sm text-gray-300 focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/50 w-64 transition-all"
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 opacity-50">
                        <Command size={10} className="text-gray-500" />
                        <span className="text-[10px] text-gray-500 font-mono">K</span>
                    </div>
                </div>
            </div>

            {/* Right: Actions */}
            <div className="flex items-center gap-3">
                <button className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors relative">
                    <Bell size={18} />
                    <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border border-black" />
                </button>

                <button className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors">
                    <Filter size={18} />
                </button>

                {onAction && (
                    <button
                        onClick={onAction}
                        className="flex items-center gap-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white text-sm font-semibold px-4 py-2 rounded-lg shadow-lg shadow-purple-900/20 transition-all hover:scale-105 active:scale-95 ml-2"
                    >
                        <Plus size={16} />
                        {actionLabel}
                    </button>
                )}
            </div>
        </div>
    );
};
