import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Loader2, CheckCircle2, XCircle, Clock,
    ArrowRight, AlertCircle, RefreshCw, X
} from 'lucide-react';
import type { DistributorId } from '@/services/distribution/types/distributor';

export interface DistributorProgress {
    distributorId: DistributorId;
    name: string;
    status: 'queued' | 'uploading' | 'processing' | 'complete' | 'failed';
    progress?: number;
    message?: string;
    releaseId?: string;
    error?: string;
}

interface MultiDistributorProgressProps {
    distributors: DistributorProgress[];
    totalComplete: number;
    totalCount: number;
    estimatedTimeRemaining?: string;
    onCancel?: () => void;
    onRetry?: (distributorId: DistributorId) => void;
    className?: string;
}

export const MultiDistributorProgress: React.FC<MultiDistributorProgressProps> = ({
    distributors,
    totalComplete,
    totalCount,
    estimatedTimeRemaining,
    onCancel,
    onRetry,
    className = ""
}) => {
    const overallProgress = (totalComplete / totalCount) * 100;

    return (
        <div className={`bg-[#121212] border border-gray-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col ${className}`}>
            {/* Header */}
            <div className="p-6 border-b border-gray-800 bg-gray-900/20">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
                        Submitting to {totalCount} Distributors
                        {overallProgress < 100 && <Loader2 size={18} className="text-blue-500 animate-spin" />}
                    </h2>
                    {onCancel && overallProgress < 100 && (
                        <button
                            onClick={onCancel}
                            className="p-2 text-gray-500 hover:text-white hover:bg-gray-800 rounded-lg transition-all"
                        >
                            <X size={18} />
                        </button>
                    )}
                </div>

                {/* Overall Progress Bar */}
                <div className="space-y-2">
                    <div className="flex justify-between text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                        <span>{totalComplete} / {totalCount} Complete</span>
                        <span>{Math.round(overallProgress)}%</span>
                    </div>
                    <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                        <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${overallProgress}%` }}
                            className="h-full bg-blue-500 transition-all duration-500"
                        />
                    </div>
                    {estimatedTimeRemaining && overallProgress < 100 && (
                        <p className="text-xs text-blue-400 font-medium text-right">
                            Estimated: {estimatedTimeRemaining} remaining
                        </p>
                    )}
                </div>
            </div>

            {/* Distributor List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 max-h-[400px]">
                {distributors.map((d) => (
                    <div
                        key={d.distributorId}
                        className={`p-4 rounded-xl border transition-all ${d.status === 'failed' ? 'bg-red-500/[0.02] border-red-500/20' :
                                d.status === 'complete' ? 'bg-green-500/[0.02] border-green-500/20' :
                                    'bg-gray-900/40 border-gray-800'
                            }`}
                    >
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-3">
                                <StatusIcon status={d.status} />
                                <div>
                                    <h4 className="text-sm font-bold text-white capitalize">{d.name}</h4>
                                    <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">
                                        {d.message || statusToText(d.status)}
                                    </p>
                                </div>
                            </div>

                            {d.status === 'failed' && onRetry && (
                                <button
                                    onClick={() => onRetry(d.distributorId)}
                                    className="p-2 text-red-500 hover:bg-red-500/10 rounded-lg transition-all"
                                    title="Retry"
                                >
                                    <RefreshCw size={14} />
                                </button>
                            )}

                            {d.status === 'complete' && d.releaseId && (
                                <div className="px-2 py-0.5 bg-green-500/10 rounded text-[9px] font-mono text-green-500">
                                    ID: {d.releaseId}
                                </div>
                            )}
                        </div>

                        {/* Individual Progress Bar */}
                        {d.status === 'uploading' && d.progress !== undefined && (
                            <div className="mt-3 space-y-1">
                                <div className="h-1 bg-gray-800 rounded-full overflow-hidden">
                                    <motion.div
                                        initial={{ width: 0 }}
                                        animate={{ width: `${d.progress}%` }}
                                        className="h-full bg-blue-400"
                                    />
                                </div>
                                <div className="flex justify-end">
                                    <span className="text-[9px] text-blue-400/70 font-mono">{d.progress}%</span>
                                </div>
                            </div>
                        )}

                        {d.error && (
                            <div className="mt-2 flex items-start gap-2 text-xs text-red-400/80 bg-red-500/5 p-2 rounded-lg">
                                <AlertCircle size={12} className="shrink-0 mt-0.5" />
                                <span>{d.error}</span>
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {/* Footer */}
            {overallProgress === 100 && (
                <div className="p-6 border-t border-gray-800 bg-green-500/[0.02]">
                    <button className="w-full py-3 bg-white text-black rounded-xl font-bold text-sm hover:bg-gray-200 transition-all flex items-center justify-center gap-2">
                        View Releases <ArrowRight size={18} />
                    </button>
                </div>
            )}
        </div>
    );
};

const StatusIcon = ({ status }: { status: DistributorProgress['status'] }) => {
    switch (status) {
        case 'complete': return <CheckCircle2 className="text-green-500" size={20} />;
        case 'failed': return <XCircle className="text-red-500" size={20} />;
        case 'uploading': return <Loader2 className="text-blue-500 animate-spin" size={20} />;
        case 'processing': return <RefreshCw className="text-yellow-500 animate-spin" size={20} />;
        case 'queued': return <Clock className="text-gray-600" size={20} />;
        default: return <Circle className="text-gray-800" size={20} />;
    }
};

const statusToText = (status: DistributorProgress['status']) => {
    switch (status) {
        case 'queued': return 'In Queue';
        case 'uploading': return 'Uploading Assets';
        case 'processing': return 'Distributor In-Review';
        case 'complete': return 'Live';
        case 'failed': return 'Submission Failed';
        default: return status;
    }
};

const Circle = ({ className, size }: { className?: string; size?: number }) => (
    <div
        className={`rounded-full border-2 ${className}`}
        style={{ width: size, height: size }}
    />
);
