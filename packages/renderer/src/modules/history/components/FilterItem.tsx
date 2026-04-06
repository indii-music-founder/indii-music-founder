import React from 'react';
import { cn } from '@/lib/utils';

interface FilterItemProps {
    icon: React.ElementType;
    label: string;
    active?: boolean;
    onClick?: () => void;
}

/** Sidebar filter button for the history timeline view. */
export function FilterItem({ icon: Icon, label, active, onClick }: FilterItemProps) {
    return (
        <button
            onClick={onClick}
            className={cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-sm font-medium",
                active
                    ? "bg-purple-500/20 text-purple-300 shadow-[0_0_15px_rgba(168,85,247,0.1)] border border-purple-500/30"
                    : "text-gray-400 hover:text-gray-200 hover:bg-white/5 border border-transparent"
            )}
        >
            <Icon size={16} />
            <span>{label}</span>
        </button>
    );
}
