import React, { useEffect, useState, useCallback } from 'react';
import { ShieldCheck, ShieldAlert, ShieldX, Loader2, RefreshCw, DollarSign } from 'lucide-react';
import { MembershipService } from '@/services/MembershipService';
import { useStore } from '@/core/store';
import { useShallow } from 'zustand/react/shallow';

type BreakerState = 'closed' | 'open' | 'half-open' | 'loading';

interface BudgetStatus {
    allowed: boolean;
    remainingBudget: number;
    requiresApproval: boolean;
    dailySpent?: number;
    dailyLimit?: number;
}

const STATE_CONFIG: Record<BreakerState, {
    icon: React.FC<{ size?: number; className?: string }>;
    color: string;
    bg: string;
    label: string;
    description: string;
}> = {
    closed: {
        icon: ShieldCheck,
        color: 'text-emerald-400',
        bg: 'bg-emerald-500/10 border-emerald-500/20',
        label: 'Closed (Healthy)',
        description: 'All agent calls are permitted. Budget within limits.',
    },
    'half-open': {
        icon: ShieldAlert,
        color: 'text-yellow-400',
        bg: 'bg-yellow-500/10 border-yellow-500/20',
        label: 'Half-Open (Approval Required)',
        description: 'High-cost operations require explicit user approval before proceeding.',
    },
    open: {
        icon: ShieldX,
        color: 'text-red-400',
        bg: 'bg-red-500/10 border-red-500/20',
        label: 'Open (Blocked)',
        description: 'Daily budget exhausted. Agent API calls are paused until reset.',
    },
    loading: {
        icon: Loader2,
        color: 'text-slate-400',
        bg: 'bg-slate-800 border-slate-700',
        label: 'Checking…',
        description: '',
    },
};

export const CircuitBreakerPanel: React.FC = () => {
    const [breakerState, setBreakerState] = useState<BreakerState>('loading');
    const [budget, setBudget] = useState<BudgetStatus | null>(null);
    const [lastChecked, setLastChecked] = useState<Date | null>(null);

    const { user } = useStore(useShallow(s => ({ user: s.user })));

    const checkBudget = useCallback(async () => {
        setBreakerState('loading');
        try {
            const membershipService = new MembershipService();
            const result = await membershipService.checkBudget(0);
            setBudget(result);

            if (!result.allowed) {
                setBreakerState('open');
            } else if (result.requiresApproval) {
                setBreakerState('half-open');
            } else {
                setBreakerState('closed');
            }

            setLastChecked(new Date());
        } catch {
            // Unable to reach budget service — treat as unknown/closed
            setBreakerState('closed');
            setBudget(null);
        }
    }, []);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const membershipService = new MembershipService();
                const result = await membershipService.checkBudget(0);
                if (cancelled) return;
                setBudget(result);

                if (!result.allowed) {
                    setBreakerState('open');
                } else if (result.requiresApproval) {
                    setBreakerState('half-open');
                } else {
                    setBreakerState('closed');
                }

                setLastChecked(new Date());
            } catch {
                if (!cancelled) {
                    setBreakerState('closed');
                    setBudget(null);
                }
            }
        })();
        return () => { cancelled = true; };
    }, []);

    const config = STATE_CONFIG[breakerState];
    const StateIcon = config.icon;

    return (
        <div className="h-full overflow-y-auto custom-scrollbar px-6 py-5 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-white">Cost Circuit Breaker</h2>
                <button
                    onClick={checkBudget}
                    className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-white transition-colors"
                >
                    <RefreshCw size={13} />
                    Refresh
                </button>
            </div>

            {/* State card */}
            <div className={`flex items-start gap-4 rounded-xl border px-5 py-4 ${config.bg}`}>
                <StateIcon
                    size={28}
                    className={`${config.color} mt-0.5 shrink-0 ${breakerState === 'loading' ? 'animate-spin' : ''}`}
                />
                <div>
                    <p className={`text-base font-semibold ${config.color}`}>{config.label}</p>
                    {config.description && (
                        <p className="text-sm text-slate-400 mt-1">{config.description}</p>
                    )}
                </div>
            </div>

            {/* Budget breakdown */}
            {budget && (
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-4">
                    <div className="flex items-center gap-2">
                        <DollarSign size={16} className="text-slate-500" />
                        <h3 className="text-sm font-semibold text-white">Budget Status</h3>
                    </div>

                    <div className="space-y-3">
                        <div className="flex justify-between items-center">
                            <span className="text-sm text-slate-400">Remaining Budget</span>
                            <span className={`text-sm font-bold ${budget.remainingBudget > 0.5 ? 'text-emerald-400' : budget.remainingBudget > 0.1 ? 'text-yellow-400' : 'text-red-400'}`}>
                                ${budget.remainingBudget.toFixed(4)}
                            </span>
                        </div>

                        <div className="flex justify-between items-center">
                            <span className="text-sm text-slate-400">Approval Required</span>
                            <span className={`text-sm font-medium ${budget.requiresApproval ? 'text-yellow-400' : 'text-slate-500'}`}>
                                {budget.requiresApproval ? 'Yes' : 'No'}
                            </span>
                        </div>

                        <div className="flex justify-between items-center">
                            <span className="text-sm text-slate-400">API Access</span>
                            <span className={`text-sm font-medium ${budget.allowed ? 'text-emerald-400' : 'text-red-400'}`}>
                                {budget.allowed ? 'Allowed' : 'Blocked'}
                            </span>
                        </div>
                    </div>
                </div>
            )}

            {/* Explanation */}
            <div className="bg-slate-900/50 border border-slate-800 rounded-xl px-4 py-3">
                <p className="text-xs text-slate-500 leading-relaxed">
                    The cost circuit breaker monitors daily AI API spend. When budget thresholds
                    are exceeded, high-cost agent calls require explicit approval to prevent
                    unexpected charges. Budgets reset at midnight UTC.
                </p>
            </div>

            {lastChecked && (
                <p className="text-xs text-slate-600 text-right">
                    Last checked: {lastChecked.toLocaleTimeString()}
                </p>
            )}
        </div>
    );
};
