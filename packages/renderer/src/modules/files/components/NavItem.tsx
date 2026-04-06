import React from 'react';
import { cn } from '@/lib/utils';

interface NavItemProps {
    icon: React.ElementType;
    label: string;
    count?: number;
    active?: boolean;
    onClick?: () => void;
}

/** Sidebar navigation item for the file dashboard filter panel. */
export function NavItem({ icon: Icon, label, count, active, onClick }: NavItemProps) {
    return (
        <button
            onClick={onClick}
            className={cn(
                "w-full flex items-center justify-between px-3 py-2 rounded-lg transition-all text-sm",
                active
                    ? "bg-blue-500/10 text-blue-400 font-medium"
                    : "text-gray-400 hover:text-gray-200 hover:bg-white/5"
            )}
        >
            <div className="flex items-center gap-3">
                <Icon size={16} />
                <span>{label}</span>
            </div>
            {count !== undefined && (
                <span className={cn(
                    "text-[10px] font-bold px-2 py-0.5 rounded-full",
                    active ? "bg-blue-500/20 text-blue-300" : "bg-white/5 text-gray-500"
                )}>
                    {count}
                </span>
            )}
        </button>
    );
}
