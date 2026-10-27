import React from 'react';
import { Search, Plus, Command } from 'lucide-react';

interface MarketingToolbarProps {
    title?: string;
    onAction?: () => void;
    actionLabel?: string;
    searchValue?: string;
    onSearchChange?: (value: string) => void;
}

export const MarketingToolbar: React.FC<MarketingToolbarProps> = ({
    title = "Campaign Dashboard",
    onAction,
    actionLabel = "New Campaign",
    searchValue = '',
    onSearchChange,
}) => {
    return (
        <div className="h-16 border-b border-white/10 bg-[#000000]/40 backdrop-blur-xl flex items-center justify-between px-6 flex-shrink-0 z-10">
            {/* Left: Breadcrumb / Title */}
            <div className="flex items-center gap-4">
                <h1 className="text-base md:text-lg font-bold text-white tracking-tight flex items-center gap-2">
                    {title}
                </h1>
                <div className="h-4 w-[1px] bg-white/15 mx-2" />
                <div className="relative group">
                    <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-[#FFB800] transition-colors" />
                    <input
                        type="text"
                        placeholder="Search campaigns..."
                        value={searchValue}
                        onChange={event => onSearchChange?.(event.target.value)}
                        aria-label="Search campaigns"
                        className="bg-[#14100C]/70 border border-white/10 rounded-xl pl-9 pr-8 py-1.5 text-sm text-gray-200 placeholder:text-gray-500 focus:outline-none focus:border-[#FFB800]/50 focus:ring-1 focus:ring-[#FFB800]/30 w-64 md:w-72 transition-all shadow-inner"
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 opacity-50">
                        <Command size={10} className="text-gray-400" />
                        <span className="text-[10px] text-gray-400 font-mono">K</span>
                    </div>
                </div>
            </div>

            {/* Right: Actions */}
            <div className="flex items-center gap-3">
                {onAction && (
                    <button
                        onClick={onAction}
                        className="flex items-center gap-2 bg-gradient-to-r from-[#FFD700] via-[#FFB800] to-[#E65100] text-black text-sm font-black px-4 py-2 rounded-xl shadow-[0_0_20px_rgba(255,184,0,0.32)] hover:shadow-[0_0_28px_rgba(255,184,0,0.55),0_0_36px_rgba(229,57,53,0.25)] hover:scale-[1.02] active:scale-[0.98] transition-all ml-2"
                    >
                        <Plus size={16} className="stroke-[2.5]" />
                        {actionLabel}
                    </button>
                )}
            </div>
        </div>
    );
};
