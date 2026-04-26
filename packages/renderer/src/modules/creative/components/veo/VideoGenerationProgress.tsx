import React from 'react';
import { motion } from 'motion/react';
import { Loader2, Video, AlertCircle, CheckCircle2, X } from 'lucide-react';
import clsx from 'clsx';

export type JobStatus = 'idle' | 'queued' | 'processing' | 'completed' | 'failed' | 'stitching';

export interface VideoGenerationJob {
    id: string;
    prompt: string;
    status: JobStatus;
    progress?: number;
    error?: string;
}

interface VideoGenerationProgressProps {
    job: VideoGenerationJob;
    onCancel?: (jobId: string) => void;
}

export function VideoGenerationProgress({ job, onCancel }: VideoGenerationProgressProps) {
    const isError = job.status === 'failed';
    const isCompleted = job.status === 'completed';
    const isProcessing = job.status === 'processing' || job.status === 'stitching';
    const isQueued = job.status === 'queued' || job.status === 'idle';

    return (
        <motion.div
            layout
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -20 }}
            className="group relative aspect-square bg-white/5 rounded-xl overflow-hidden border border-white/10 flex flex-col items-center justify-center p-6 text-center"
        >
            {/* Animated Background Gradient for Processing */}
            {isProcessing && (
                <motion.div 
                    className="absolute inset-0 bg-gradient-to-tr from-purple-500/10 via-pink-500/10 to-blue-500/10 blur-xl opacity-50"
                    animate={{
                        backgroundPosition: ['0% 0%', '100% 100%'],
                        scale: [1, 1.1, 1]
                    }}
                    transition={{
                        duration: 4,
                        repeat: Infinity,
                        ease: "linear"
                    }}
                />
            )}

            {onCancel && (
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onCancel(job.id);
                    }}
                    className="absolute top-2 right-2 p-1.5 rounded-full bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors z-20"
                    title="Cancel Job"
                    aria-label="Cancel Job"
                >
                    <X size={14} />
                </button>
            )}

            <div className="relative z-10 flex flex-col items-center gap-4 w-full">
                {/* Icon Status */}
                <div className={clsx(
                    "w-12 h-12 rounded-2xl flex items-center justify-center border backdrop-blur-md shadow-lg",
                    isError ? "bg-red-500/10 border-red-500/20 text-red-400" :
                    isCompleted ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" :
                    "bg-white/5 border-white/10 text-purple-400"
                )}>
                    {isError ? <AlertCircle size={24} /> :
                     isCompleted ? <CheckCircle2 size={24} /> :
                     isProcessing ? <Loader2 size={24} className="animate-spin" /> :
                     <Video size={24} className="animate-pulse opacity-50" />}
                </div>

                {/* Text Status */}
                <div className="flex flex-col gap-1 w-full">
                    <h4 className="text-sm font-bold text-white">
                        {isError ? 'Generation Failed' :
                         isCompleted ? 'Ready to Play' :
                         isProcessing ? 'Generating Video...' :
                         'Queued for Generation'}
                    </h4>
                    <p className="text-xs text-gray-400 line-clamp-2 px-2" title={job.prompt}>
                        "{job.prompt}"
                    </p>
                </div>

                {/* Progress Bar */}
                {(isProcessing || isQueued) && (
                    <div className="w-full max-w-[120px] h-1.5 bg-white/10 rounded-full overflow-hidden mt-2">
                        {job.progress !== undefined ? (
                            <motion.div 
                                className="h-full bg-gradient-to-r from-purple-500 to-pink-500"
                                initial={{ width: 0 }}
                                animate={{ width: `${job.progress}%` }}
                                transition={{ type: "spring", bounce: 0, duration: 0.5 }}
                            />
                        ) : (
                            <motion.div 
                                className="h-full w-1/2 bg-gradient-to-r from-purple-500 to-pink-500"
                                animate={{
                                    x: ['-100%', '200%']
                                }}
                                transition={{
                                    duration: 1.5,
                                    repeat: Infinity,
                                    ease: "linear"
                                }}
                            />
                        )}
                    </div>
                )}

                {/* Error Message */}
                {isError && job.error && (
                    <p className="text-xs text-red-400 mt-2 bg-red-500/10 px-3 py-1.5 rounded-lg">
                        {job.error}
                    </p>
                )}
            </div>
        </motion.div>
    );
}
