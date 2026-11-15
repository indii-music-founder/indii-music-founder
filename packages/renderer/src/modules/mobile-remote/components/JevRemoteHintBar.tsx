import React from 'react';
import { Sparkles, ArrowRight } from 'lucide-react';
import type { MobileRemoteIntentJudgment } from '@/config/typesafeJudgments';
import { cn } from '@/lib/utils';

interface JevRemoteHintBarProps {
    judgment: MobileRemoteIntentJudgment | null;
    onAction?: (judgment: MobileRemoteIntentJudgment) => void;
    className?: string;
}

/**
 * Compact single-line TypeSafe Jev routing bar shared across Mobile Remote tabs.
 * Never opens a stacked popup or modal overlay.
 */
export function JevRemoteHintBar({ judgment, onAction, className }: JevRemoteHintBarProps) {
    if (!judgment) return null;

    return (
        <div
            data-testid="jev-remote-hint-bar"
            className={cn(
                'flex items-center justify-between gap-2 px-3 py-2 rounded-2xl bg-white/[0.03] border border-white/10 text-xs',
                className
            )}
        >
            <div className="flex items-center gap-2 min-w-0">
                <Sparkles className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <div className="min-w-0">
                    <span className="font-mono text-[10px] uppercase tracking-wider text-emerald-300 mr-1.5">
                        Jev · {judgment.recommendedDepartment}
                    </span>
                    <span className="text-stone-300 truncate">{judgment.hint}</span>
                </div>
            </div>
            {onAction && (
                <button
                    type="button"
                    onClick={() => onAction(judgment)}
                    data-testid="jev-remote-hint-action"
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-[#00ff66]/15 hover:bg-[#00ff66]/25 border border-[#00ff66]/30 text-[11px] font-bold text-[#00ff66] shrink-0 whitespace-nowrap transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/70"
                >
                    <span>{judgment.actionLabel}</span>
                    <ArrowRight className="w-3 h-3" />
                </button>
            )}
        </div>
    );
}
export default JevRemoteHintBar;
