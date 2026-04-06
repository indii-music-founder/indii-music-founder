import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useShallow } from 'zustand/react/shallow';
import { useStore } from '@/core/store';
import {
    CheckCircle2,
    XCircle,
    Loader2,
    Clock,
    SkipForward,
    ChevronDown,
    ChevronUp,
    X,
    Cpu,
} from 'lucide-react';
import type { PlanStep, PlanStepStatus } from '@/types/AgentPlan';

/**
 * TaskPlanWidget — Structured Progress Updates UI
 *
 * Renders the active agent execution plan as a collapsible step-by-step
 * checklist overlay. Anchored to the bottom-right of the chat area.
 *
 * Each step shows: status icon, label, agent badge, and elapsed time.
 * Automatically appears when the Conductor emits a plan event.
 */

const STATUS_CONFIG: Record<PlanStepStatus, {
    icon: React.ComponentType<{ size?: string | number; className?: string }>;
    color: string;
    animate?: boolean;
}> = {
    pending: { icon: Clock, color: 'text-zinc-500' },
    running: { icon: Loader2, color: 'text-blue-400', animate: true },
    done: { icon: CheckCircle2, color: 'text-emerald-400' },
    failed: { icon: XCircle, color: 'text-red-400' },
    skipped: { icon: SkipForward, color: 'text-zinc-600' },
};

const StepRow: React.FC<{ step: PlanStep }> = ({ step }) => {
    const config = STATUS_CONFIG[step.status];
    const Icon = config.icon;

    const elapsed = (step.startedAt && step.completedAt)
        ? Math.round((step.completedAt - step.startedAt) / 1000)
        : 0;

    return (
        <motion.div
            layout
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-3 py-1.5"
        >
            <div className={`flex-shrink-0 ${config.color}`}>
                <Icon
                    size={16}
                    className={config.animate ? 'animate-spin' : ''}
                />
            </div>

            <span className={`flex-1 text-sm ${step.status === 'done' ? 'text-zinc-400 line-through' :
                step.status === 'running' ? 'text-white font-medium' :
                    step.status === 'failed' ? 'text-red-300' :
                        'text-zinc-500'
                }`}>
                {step.label}
            </span>

            {step.agentId && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/5 text-zinc-500 font-mono">
                    {step.agentId}
                </span>
            )}

            {step.status === 'running' && elapsed > 0 && (
                <span className="text-[10px] text-zinc-600 font-mono tabular-nums">
                    {elapsed}s
                </span>
            )}

            {step.error && (
                <span className="text-[10px] text-red-400 max-w-[120px] truncate" title={step.error}>
                    {step.error}
                </span>
            )}
        </motion.div>
    );
};

export const TaskPlanWidget: React.FC = () => {
    const [isCollapsed, setIsCollapsed] = React.useState(false);

    const { activePlan, clearPlan } = useStore(useShallow((state) => ({
        activePlan: state.activePlan,
        clearPlan: state.clearPlan,
    })));

    if (!activePlan) return null;

    const doneCount = activePlan.steps.filter(
        (s) => s.status === 'done' || s.status === 'skipped'
    ).length;
    const totalCount = activePlan.steps.length;
    const failCount = activePlan.steps.filter((s) => s.status === 'failed').length;
    const allDone = doneCount + failCount === totalCount;
    const progressPct = totalCount > 0 ? Math.round(((doneCount + failCount) / totalCount) * 100) : 0;

    return (
        <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-20 right-6 z-50 w-80 bg-zinc-900/95 border border-white/10 rounded-2xl shadow-2xl backdrop-blur-xl overflow-hidden"
        >
            {/* Header */}
            <div className="flex items-center gap-2 px-4 py-3 border-b border-white/5">
                <Cpu size={14} className="text-blue-400" />
                <h3 className="text-sm font-semibold text-white flex-1 truncate">
                    {activePlan.title}
                </h3>
                <span className="text-[10px] text-zinc-500 font-mono tabular-nums">
                    {doneCount}/{totalCount}
                </span>
                <button
                    onClick={() => setIsCollapsed(!isCollapsed)}
                    className="p-1 hover:bg-white/5 rounded-lg transition-colors"
                    aria-label={isCollapsed ? 'Expand plan' : 'Collapse plan'}
                >
                    {isCollapsed ? <ChevronUp size={14} className="text-zinc-500" /> : <ChevronDown size={14} className="text-zinc-500" />}
                </button>
                {allDone && (
                    <button
                        onClick={clearPlan}
                        className="p-1 hover:bg-white/5 rounded-lg transition-colors"
                        aria-label="Dismiss plan"
                    >
                        <X size={14} className="text-zinc-500" />
                    </button>
                )}
            </div>

            {/* Progress Bar */}
            <div className="h-0.5 bg-zinc-800">
                <motion.div
                    className={`h-full ${failCount > 0 ? 'bg-red-500' : 'bg-blue-500'}`}
                    initial={{ width: 0 }}
                    animate={{ width: `${progressPct}%` }}
                    transition={{ duration: 0.3 }}
                />
            </div>

            {/* Steps */}
            <AnimatePresence>
                {!isCollapsed && (
                    <motion.div
                        initial={{ height: 0 }}
                        animate={{ height: 'auto' }}
                        exit={{ height: 0 }}
                        className="overflow-hidden"
                    >
                        <div className="px-4 py-2 max-h-60 overflow-y-auto">
                            {activePlan.steps.map((step) => (
                                <StepRow key={step.id} step={step} />
                            ))}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
};
