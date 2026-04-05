import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from '@/core/store';
import { useShallow } from 'zustand/react/shallow';
import {
    Loader2,
    CheckCircle2,
    XCircle,
    Clock,
    Zap,
    ChevronRight,
    Play
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

export const BatchingStatus: React.FC = () => {
    const { batchingTasks, clearCompletedBatchTasks } = useStore(
        useShallow((state) => ({
            batchingTasks: state.batchingTasks,
            clearCompletedBatchTasks: state.clearCompletedBatchTasks
        }))
    );

    if (batchingTasks.length === 0) return null;

    const completedCount = batchingTasks.filter(t => t.status === 'completed' || t.status === 'error').length;
    const progress = (completedCount / batchingTasks.length) * 100;
    const isProcessing = batchingTasks.some(t => t.status === 'processing');

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="p-4 bg-black/40 backdrop-blur-md border-t border-white/10"
        >
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <div className="relative">
                        <Zap className={cn(
                            "w-4 h-4 text-amber-400",
                            isProcessing && "animate-pulse"
                        )} />
                        {isProcessing && (
                            <motion.div
                                className="absolute inset-0 bg-amber-400/20 rounded-full blur-sm"
                                animate={{ scale: [1, 1.5, 1], opacity: [0.5, 0, 0.5] }}
                                transition={{ duration: 2, repeat: Infinity }}
                            />
                        )}
                    </div>
                    <span className="text-xs font-semibold uppercase tracking-wider text-white/70">
                        Maestro Batching
                    </span>
                </div>
                <div className="flex items-center gap-3">
                    <span className="text-[10px] font-mono text-white/40">
                        {completedCount}/{batchingTasks.length}
                    </span>
                    {completedCount === batchingTasks.length && (
                        <button
                            onClick={clearCompletedBatchTasks}
                            className="text-[10px] text-amber-400 hover:text-amber-300 transition-colors uppercase font-bold"
                        >
                            Clear
                        </button>
                    )}
                </div>
            </div>

            <Progress value={progress} className="h-1 bg-white/5 mb-4" />

            <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar pr-1">
                <AnimatePresence mode="popLayout">
                    {batchingTasks.map((task) => (
                        <motion.div
                            key={task.id}
                            layout
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className={cn(
                                "flex items-center gap-3 p-2 rounded-lg border transition-all duration-200",
                                task.status === 'processing' ? "bg-white/5 border-white/10" : "bg-transparent border-transparent"
                            )}
                        >
                            <div className="flex-shrink-0">
                                {task.status === 'pending' && <Clock className="w-3.5 h-3.5 text-white/30" />}
                                {task.status === 'processing' && <Loader2 className="w-3.5 h-3.5 text-amber-400 animate-spin" />}
                                {task.status === 'completed' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
                                {task.status === 'error' && <XCircle className="w-3.5 h-3.5 text-rose-400" />}
                            </div>

                            <div className="flex-grow min-w-0">
                                <div className="flex items-center gap-2 mb-0.5">
                                    <span className="text-[11px] font-medium text-white/80 truncate">
                                        {task.description}
                                    </span>
                                    <PriorityBadge priority={task.priority} />
                                </div>
                                <div className="flex items-center gap-1.5 text-[9px] text-white/30 font-mono uppercase tracking-tight">
                                    <span>{task.agentId}</span>
                                    {task.status === 'processing' && (
                                        <span className="flex items-center gap-1">
                                            <span className="w-1 h-1 rounded-full bg-amber-400 animate-pulse" />
                                            optimizing sequence...
                                        </span>
                                    )}
                                </div>
                            </div>
                        </motion.div>
                    ))}
                </AnimatePresence>
            </div>
        </motion.div>
    );
};

const PriorityBadge: React.FC<{ priority: string }> = ({ priority }) => {
    const colors = {
        URGENT: "bg-rose-500/20 text-rose-400 border-rose-500/30",
        HIGH: "bg-amber-500/20 text-amber-400 border-amber-500/30",
        MEDIUM: "bg-blue-500/20 text-blue-400 border-blue-500/30",
        LOW: "bg-white/5 text-white/40 border-white/10"
    };

    return (
        <span className={cn(
            "text-[8px] px-1 px-0.5 rounded border font-bold h-3 flex items-center",
            colors[priority as keyof typeof colors]
        )}>
            {priority}
        </span>
    );
};
