import React from 'react';
import { CheckCircle } from 'lucide-react';

export type StepStatus = 'pending' | 'active' | 'complete';

interface GauntletStepProps {
    num: number;
    title: string;
    status: StepStatus;
    detail: string;
}

/**
 * GauntletStep — A single step in the gauntlet execution pipeline.
 * Displays with three visual states: pending (dimmed), active (purple glow + ping),
 * and complete (green checkmark).
 */
export function GauntletStep({ num, title, status, detail }: GauntletStepProps) {
    const isPending = status === 'pending';
    const isActive = status === 'active';
    const isComplete = status === 'complete';

    return (
        <div className={`p-3 rounded-lg border transition-all duration-500 ${isActive ? 'bg-purple-900/30 border-purple-500 shadow-[0_0_15px_rgba(168,85,247,0.2)]' :
            isComplete ? 'bg-green-900/10 border-green-500/30' :
                'bg-surface/30 border-white/5 opacity-50'
            }`}
            data-testid={`gauntlet-step-${num}`}
            data-status={status}
        >
            <div className="flex items-center gap-3">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${isActive ? 'bg-purple-500 text-white animate-pulse' :
                    isComplete ? 'bg-green-500 text-black' :
                        'bg-white/10 text-white'
                    }`}>
                    {isComplete ? <CheckCircle className="w-4 h-4" /> : num}
                </div>
                <div className="flex-1">
                    <p className={`text-xs font-bold ${isActive ? 'text-white' : isComplete ? 'text-green-400' : 'text-muted-foreground'}`}>
                        {title}
                    </p>
                    <p className="text-[10px] opacity-60 leading-tight mt-0.5">{detail}</p>
                </div>
                {isActive && <div className="w-1.5 h-1.5 bg-purple-500 rounded-full animate-ping" />}
            </div>
        </div>
    );
}
