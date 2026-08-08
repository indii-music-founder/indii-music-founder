import React from 'react';
import { CircleCheck, CircleMinus, LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getColorForModule } from '@/core/theme/moduleColors';

interface SettingCardProps {
    icon: LucideIcon;
    title: string;
    description: string;
    status: 'active' | 'managed' | 'unavailable';
}

const statusLabels = {
    active: 'Active',
    managed: 'Runtime managed',
    unavailable: 'Not available',
} as const;

/** Read-only capability card backed by the runtime state the app can verify. */
export function SettingCard({ icon: Icon, title, description, status }: SettingCardProps) {
    const moduleColor = getColorForModule('desktop');
    const available = status !== 'unavailable';

    return (
        <div
            data-availability={status}
            className={cn(
                'w-full text-left p-6 rounded-3xl border flex items-start gap-6',
                available
                    ? `bg-surface/40 ${moduleColor.border} shadow-lg`
                    : 'bg-surface/20 border-white/5'
            )}
        >
            <div className={cn(
                'p-3 rounded-2xl flex-shrink-0',
                available ? `${moduleColor.bg} ${moduleColor.text}` : 'bg-black/40 text-gray-500'
            )}>
                <Icon size={24} />
            </div>

            <div className="flex-1 min-w-0">
                <h4 className={cn('text-lg font-bold mb-1', available ? 'text-white' : 'text-gray-300')}>{title}</h4>
                <p className="text-sm text-gray-500 leading-relaxed pr-8">{description}</p>
            </div>

            <div className={cn(
                'flex flex-shrink-0 items-center gap-2 ml-4 pt-1 text-xs font-bold uppercase tracking-wider',
                available ? moduleColor.text : 'text-gray-500'
            )}>
                {available ? <CircleCheck size={16} /> : <CircleMinus size={16} />}
                <span>{statusLabels[status]}</span>
            </div>
        </div>
    );
}
