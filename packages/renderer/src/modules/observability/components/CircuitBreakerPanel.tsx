import React, { useEffect, useState, useCallback } from 'react';
import { ShieldCheck, ShieldAlert, ShieldX, Loader2, RefreshCw, DollarSign } from 'lucide-react';
import { MembershipService } from '@/services/MembershipService';
import { useStore } from '@/core/store';
import { useShallow } from 'zustand/react/shallow';
import { logger } from '@/utils/logger';

type BreakerState = 'closed' | 'open' | 'half-open' | 'loading' | 'unavailable';

interface BudgetStatus {
    allowed: boolean;
    remainingBudget: number;
    requiresApproval: boolean;
    dailySpent?: number;
    dailyLimit?: number;
}

const STATE_CONFIG: Record<BreakerState, {
    icon: React.FC<{ size?: string | number; className?: string }>;
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
    unavailable: {
        icon: ShieldAlert,
        color: 'text-slate-300',
        bg: 'bg-slate-800 border-slate-700',
        label: 'Status Unavailable',
        description: 'The budget service could not be reached. Spend limits are still enforced on every agent call.',
    },
    loading: {
        icon: Loader2,
        color: 'text-slate-400',
        bg: 'bg-slate-800 border-slate-700',
        label: 'Checking…',
        description: '',
    },
};

interface BreakerReading {
    state: Exclude<BreakerState, 'loading'>;
    budget: BudgetStatus | null;
}

async function readBreaker(): Promise<BreakerReading> {
    try {
        const budget = await MembershipService.checkBudget(0);
        const state = !budget.allowed ? 'open' : budget.requiresApproval ? 'half-open' : 'closed';
        return { state, budget };
    } catch (error) {
        // Fail closed in the UI: an unreachable budget service is "unknown", never "healthy".
        logger.warn('[CircuitBreakerPanel] Budget check failed', error);
        return { state: 'unavailable', budget: null };
    }
}

export const CircuitBreakerPanel: React.FC = () => {
    const [breakerState, setBreakerState] = useState<BreakerState>('loading');
    const [budget, setBudget] = useState<BudgetStatus | null>(null);
    const [lastChecked, setLastChecked] = useState<Date | null>(null);
    const userId = useStore(useShallow(s => s.user?.uid ?? null));

    const apply = useCallback((result: BreakerReading) => {
        setBudget(result.budget);
        setBreakerState(result.state);
        setLastChecked(new Date());
    }, []);

    const refresh = useCallback(async () => {
        setBreakerState('loading');
        apply(await readBreaker());
    }, [apply]);

    useEffect(() => {
        let cancelled = false;
        void readBreaker().then((result) => {
            if (!cancelled) apply(result);
        });
        return () => { cancelled = true; };
    }, [apply, userId]);

    const config = STATE_CONFIG[breakerState];
    const StateIcon = config.icon;

    return (
        <div className="space-y-5">
            {/* Header */}
            <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-white">Cost Circuit Breaker</h2>
                <button
                    onClick={() => void refresh()}
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
                                {Number.isFinite(budget.remainingBudget) ? `$${budget.remainingBudget.toFixed(4)}` : 'Unlimited'}
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
                    The cost circuit breaker monitors daily Autonomous API spend. When budget thresholds
                    are exceeded, high-cost agent calls require explicit approval to prevent
                    unexpected charges. Budgets reset at midnight UTC.
                </p>
            </div>

            {lastChecked && (
                <p className="text-xs text-slate-600 text-right">
                    Last checked: {lastChecked.toLocaleTimeString('en-US')}
                </p>
            )}
        </div>
    );
};
