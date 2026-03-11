import React from 'react';
import { CheckCircle2, AlertCircle, Loader2, Clock, X } from 'lucide-react';
import { useStore } from '@/core/store';
import { useShallow } from 'zustand/react/shallow';
import type { BatchedTask } from '@/services/agent/MaestroBatchingService';

const STATUS_CONFIG: Record<BatchedTask['status'], {
    icon: React.FC<{ size?: string | number; className?: string }>;
    color: string;
    label: string;
}> = {
    pending: {
        icon: Clock,
        color: 'text-slate-400',
        label: 'Pending',
    },
    processing: {
        icon: Loader2,
        color: 'text-blue-400',
        label: 'Running',
    },
    completed: {
        icon: CheckCircle2,
        color: 'text-cyan-400',
        label: 'Done',
    },
    error: {
        icon: AlertCircle,
        color: 'text-red-400',
        label: 'Failed',
    },
};

const PRIORITY_BADGE: Record<string, string> = {
    URGENT: 'bg-red-500/20 text-red-300 border-red-500/30',
    HIGH: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
    MEDIUM: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
    LOW: 'bg-slate-700 text-slate-400 border-slate-600',
};

export const TaskTracker: React.FC = () => {
    const { batchingTasks, clearCompletedBatchTasks } = useStore(
        useShallow(s => ({
            batchingTasks: s.batchingTasks,
            clearCompletedBatchTasks: s.clearCompletedBatchTasks,
        }))
    );

    const activeTasks = batchingTasks.filter(t => t.status === 'pending' || t.status === 'processing');
    const completedTasks = batchingTasks.filter(t => t.status === 'completed' || t.status === 'error');

    if (batchingTasks.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-slate-600 space-y-3">
                <div className="p-4 bg-slate-900 rounded-full border border-slate-800">
                    <CheckCircle2 size={28} className="opacity-40" />
                </div>
                <p className="text-sm font-medium text-slate-500">No active tasks</p>
                <p className="text-xs text-slate-600">Tasks queued via Maestro will appear here.</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 shrink-0">
                <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-white">Task Queue</h3>
                    {activeTasks.length > 0 && (
                        <span className="flex items-center gap-1 text-xs text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded-full">
                            <Loader2 size={10} className="animate-spin" />
                            {activeTasks.length} running
                        </span>
                    )}
                </div>
                {completedTasks.length > 0 && (
                    <button
                        onClick={clearCompletedBatchTasks}
                        className="flex items-center gap-1 text-xs text-slate-500 hover:text-white transition-colors"
                    >
                        <X size={12} />
                        Clear done
                    </button>
                )}
            </div>

            {/* Task list */}
            <div className="flex-1 overflow-y-auto custom-scrollbar divide-y divide-slate-800/50">
                {batchingTasks.map(task => {
                    const config = STATUS_CONFIG[task.status];
                    const StatusIcon = config.icon;
                    const priorityClass = PRIORITY_BADGE[task.priority] ?? PRIORITY_BADGE.LOW;

                    return (
                        <div
                            key={task.id}
                            className={`px-4 py-3 transition-opacity ${task.status === 'completed' ? 'opacity-50' : 'opacity-100'
                                }`}
                        >
                            <div className="flex items-start gap-3">
                                <StatusIcon
                                    size={16}
                                    className={`mt-0.5 shrink-0 ${config.color} ${task.status === 'processing' ? 'animate-spin' : ''
                                        }`}
                                />
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <p className="text-sm text-slate-200 leading-snug truncate">
                                            {task.description}
                                        </p>
                                        <span className={`text-xs px-1.5 py-0.5 rounded border shrink-0 ${priorityClass}`}>
                                            {task.priority}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2 mt-1">
                                        <span className="text-xs text-slate-500">{task.agentId}</span>
                                        <span className="text-xs text-slate-600">·</span>
                                        <span className={`text-xs ${config.color}`}>{config.label}</span>
                                    </div>
                                    {task.error && (
                                        <p className="text-xs text-red-400 mt-1 bg-red-500/10 px-2 py-1 rounded">
                                            {task.error}
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
