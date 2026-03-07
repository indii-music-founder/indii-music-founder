import React from 'react';
import { useStore } from '@/core/store';
import { useShallow } from 'zustand/react/shallow';
import { X, CheckCircle, AlertCircle, Loader2, Film, Music, Cpu, ChevronDown, ChevronUp, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export const BackgroundJobMonitor: React.FC = () => {
    const {
        backgroundJobs,
        isJobMonitorOpen,
        toggleJobMonitor,
        removeJob,
        clearCompletedJobs
    } = useStore(useShallow(state => ({
        backgroundJobs: state.backgroundJobs,
        isJobMonitorOpen: state.isJobMonitorOpen,
        toggleJobMonitor: state.toggleJobMonitor,
        removeJob: state.removeJob,
        clearCompletedJobs: state.clearCompletedJobs,
    })));

    if (backgroundJobs.length === 0) return null;

    const inProgressCount = backgroundJobs.filter(i => i.status === 'running').length;
    const completedCount = backgroundJobs.filter(i => i.status === 'success').length;
    const errorCount = backgroundJobs.filter(i => i.status === 'error').length;

    const getIconForType = (type: string) => {
        switch (type) {
            case 'video_render': return <Film size={16} className="text-purple-400" />;
            case 'audio_process': return <Music size={16} className="text-orange-400" />;
            case 'ai_generation': return <Cpu size={16} className="text-blue-400" />;
            default: return <Loader2 size={16} className="text-gray-400" />;
        }
    };

    return (
        <div className="fixed bottom-4 left-4 z-[9990] w-80 bg-black/80 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl overflow-hidden flex flex-col transition-all duration-300">
            {/* Header */}
            <div
                className="flex items-center justify-between p-3 bg-white/5 border-b border-white/5 cursor-pointer hover:bg-white/10 transition-colors"
                onClick={() => toggleJobMonitor()}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        toggleJobMonitor();
                    }
                }}
                aria-expanded={isJobMonitorOpen}
            >
                <div>
                    <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                        Background Tasks
                        {inProgressCount > 0 && (
                            <span className="bg-purple-500/20 text-purple-400 text-[10px] px-1.5 py-0.5 rounded-full font-bold">
                                {inProgressCount} active
                            </span>
                        )}
                    </h3>
                    {(completedCount > 0 || errorCount > 0) && (
                        <p className="text-[10px] text-gray-400 mt-0.5">
                            {completedCount} success{errorCount > 0 ? `, ${errorCount} failed` : ''}
                        </p>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    {isJobMonitorOpen ? <ChevronDown size={18} className="text-gray-400" /> : <ChevronUp size={18} className="text-gray-400" />}
                </div>
            </div>

            {/* Body */}
            <AnimatePresence>
                {isJobMonitorOpen && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="flex flex-col max-h-80 overflow-y-auto custom-scrollbar"
                    >
                        {backgroundJobs.length > 0 ? (
                            <div className="flex flex-col divide-y divide-white/5">
                                {backgroundJobs.map(item => (
                                    <div key={item.id} className="p-3 flex items-start gap-3 hover:bg-white/5 transition-colors group">
                                        <div className="shrink-0 mt-0.5">
                                            {getIconForType(item.type)}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex justify-between items-start mb-1">
                                                <p className="text-xs font-medium text-gray-200 truncate pr-2 w-full">{item.title}</p>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); removeJob(item.id); }}
                                                    className="text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                                                    aria-label="Dismiss task"
                                                >
                                                    <X size={14} />
                                                </button>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                {item.status === 'running' && (
                                                    <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
                                                        <div
                                                            className="h-full bg-gradient-to-r from-purple-500 to-blue-500 rounded-full transition-all duration-300 relative"
                                                            style={{ width: `${Math.max(item.progress, 5)}%` }}
                                                        >
                                                            <div className="absolute inset-0 bg-white/20 animate-pulse" />
                                                        </div>
                                                    </div>
                                                )}
                                                {item.status === 'error' && <p className="text-[10px] text-red-400 truncate w-full">{item.error || 'Task failed'}</p>}
                                                {item.status === 'success' && <p className="text-[10px] text-green-400 truncate w-full">Completed successfully</p>}
                                            </div>
                                        </div>
                                        <div className="shrink-0">
                                            {item.status === 'running' && <Loader2 size={14} className="text-purple-400 animate-spin" />}
                                            {item.status === 'success' && <CheckCircle size={14} className="text-green-500" />}
                                            {item.status === 'error' && <AlertCircle size={14} className="text-red-500" />}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="p-8 text-center text-gray-500 text-xs">
                                No active tasks
                            </div>
                        )}

                        {/* Footer Actions */}
                        {completedCount > 0 && (
                            <div className="bg-white/5 border-t border-white/5 p-2 flex justify-end">
                                <button
                                    onClick={clearCompletedJobs}
                                    className="text-[10px] flex items-center gap-1 text-gray-400 hover:text-white transition-colors"
                                >
                                    <Trash2 size={12} />
                                    Clear Completed
                                </button>
                            </div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};
