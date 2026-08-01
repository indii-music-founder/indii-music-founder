import React from 'react';
import { ToggleLeft, ToggleRight, LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getColorForModule } from '@/core/theme/moduleColors';

interface SettingCardProps {
    icon: LucideIcon;
    title: string;
    description: string;
    enabled: boolean;
    onClick: () => void;
}

/** Toggle card for desktop integration settings with icon, description, and visual toggle state. */
export function SettingCard({ icon: Icon, title, description, enabled, onClick }: SettingCardProps) {
    const moduleColor = getColorForModule('desktop');

    return (
        <button
            onClick={onClick}
            className={cn(
                "w-full text-left p-6 rounded-3xl border transition-all duration-300 flex items-start gap-6 group hover:scale-[1.01] active:scale-95",
                enabled
                    ? `bg-surface/40 hover:bg-surface/60 ${moduleColor.border} shadow-lg`
                    : "bg-surface/20 hover:bg-surface/40 border-white/5"
            )}
        >
            <div className={cn(
                "p-3 rounded-2xl flex-shrink-0 transition-colors",
                enabled ? `${moduleColor.bg} ${moduleColor.text}` : "bg-black/40 text-gray-500 group-hover:text-gray-400"
            )}>
                <Icon size={24} />
            </div>

            <div className="flex-1 min-w-0">
                <h4 className={cn("text-lg font-bold mb-1 transition-colors", enabled ? "text-white" : "text-gray-300")}>{title}</h4>
                <p className="text-sm text-gray-500 leading-relaxed pr-8">{description}</p>
            </div>

            <div className="flex-shrink-0 ml-4 pt-1">
                {enabled ? (
                    <ToggleRight size={32} className={`${moduleColor.text} drop-shadow-md`} />
                ) : (
                    <ToggleLeft size={32} className="text-gray-600" />
                )}
            </div>
        </button>
    );
}
