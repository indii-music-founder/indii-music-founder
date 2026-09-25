import React, { useState, useEffect } from 'react';
import { Sparkles, ArrowRight, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { judgeNextBestAction, type NextBestActionVerdict } from '@/config/typesafeJudgments';
import { useStore } from '@/core/store';
import { type ModuleId } from '@/core/constants';
import { workflowStateService } from '@/services/agent/WorkflowStateService';
import type { WorkflowPredictionReport } from '@indii/shared';

interface NextBestActionCardProps {
    onNavigate: (id: ModuleId) => void;
    currentModule: ModuleId;
    isSidebarOpen: boolean;
}

export const NextBestActionCard: React.FC<NextBestActionCardProps> = ({
    onNavigate,
    currentModule,
    isSidebarOpen,
}) => {
    const [verdict, setVerdict] = useState<NextBestActionVerdict | null>(null);
    const [historyPrediction, setHistoryPrediction] = useState<WorkflowPredictionReport | null>(null);
    const [dismissedForModule, setDismissedForModule] = useState<string | null>(null);
    const userId = useStore(state => state.user?.uid);
    const artistEntityId = useStore(state => state.userProfile?.artistContext?.artistEntityId ?? state.userProfile?.artistEntityId);

    useEffect(() => {
        if (!isSidebarOpen) return;
        let isMounted = true;
        const fetchNextAction = async () => {
            setHistoryPrediction(null);
            try {
                const state = useStore.getState();
                if (userId && artistEntityId) {
                    try {
                        const prediction = await workflowStateService.getNextWorkflowPrediction(userId, artistEntityId);
                        if (isMounted) setHistoryPrediction(prediction);
                    } catch {
                        // Historical suggestions are optional and fail closed.
                    }
                }
                const unreleasedTrackCount = (state as unknown as { catalog?: Array<{ isrc?: string }> }).catalog?.filter((t) => !t.isrc)?.length ?? 1;
                const hasActiveCampaign = Boolean((state as unknown as { campaigns?: unknown[] }).campaigns && (state as unknown as { campaigns?: unknown[] }).campaigns!.length > 0);
                const pendingSplitCount = (state as unknown as { splits?: Array<{ status: string }> }).splits?.filter((s) => s.status === 'pending')?.length ?? 0;
                const hasUnreadStatements = Boolean((state as unknown as { unreadStatements?: boolean }).unreadStatements);

                const result = await judgeNextBestAction({
                    currentModule,
                    unreleasedTrackCount,
                    hasActiveCampaign,
                    pendingSplitCount,
                    hasUnreadStatements,
                });

                if (isMounted && result) {
                    setVerdict(result);
                }
            } catch {
                // Keep silent on background recommendation errors
            }
        };

        fetchNextAction();
        return () => {
            isMounted = false;
        };
    }, [currentModule, isSidebarOpen, userId, artistEntityId]);

    if (!isSidebarOpen || (!verdict && !historyPrediction) || (verdict?.nextModule === currentModule && !historyPrediction) || dismissedForModule === currentModule) {
        return null;
    }

    const historicalSuggestion = historyPrediction?.predictions[0];

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0, y: -4, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -4, scale: 0.98 }}
                className="mx-3 my-2 p-2.5 rounded-xl border border-indigo-500/20 bg-linear-to-r from-indigo-500/10 via-purple-500/5 to-transparent relative group shadow-sm overflow-hidden"
                data-testid="next-best-action-card"
            >
                <div className="flex items-start justify-between gap-1.5">
                    <div className="flex items-center gap-1.5 text-indigo-400">
                        <Sparkles size={13} className="animate-pulse flex-shrink-0" />
                        <span className="text-[10px] font-bold uppercase tracking-wider">{verdict ? 'Suggested Next' : 'Your Workflow History'}</span>
                    </div>
                    <button
                        onClick={() => setDismissedForModule(currentModule)}
                        className="text-gray-500 hover:text-gray-300 p-0.5 rounded transition-colors"
                        aria-label="Dismiss recommendation"
                    >
                        <X size={11} />
                    </button>
                </div>

                {verdict && verdict.nextModule !== currentModule && (
                    <>
                        <p className="text-[11px] text-gray-200 font-medium mt-1 leading-snug line-clamp-2">
                            {verdict.callToAction}
                        </p>
                        <button
                            onClick={() => onNavigate(verdict.nextModule as ModuleId)}
                            className="mt-2 w-full flex items-center justify-between px-2 py-1 rounded-lg text-[10px] font-bold bg-white/5 hover:bg-white/10 text-white transition-all group-hover:border group-hover:border-white/10"
                        >
                            <span className="truncate capitalize">Open {verdict.nextModule}</span>
                            <ArrowRight size={11} className="transition-transform group-hover:translate-x-0.5" />
                        </button>
                    </>
                )}

                {historicalSuggestion && (
                    <div className="mt-2 border-t border-white/10 pt-2" data-testid="historical-workflow-suggestion">
                        <p className="text-[10px] text-gray-300 leading-snug">
                            Your completed “{historicalSuggestion.followsWorkflowId}” workflows continued with “{historicalSuggestion.workflowId}” in {historicalSuggestion.supportCount} of {historicalSuggestion.observedTransitionCount} observed sequences. This is a suggestion from your history only.
                        </p>
                        <button
                            onClick={() => onNavigate('workflow')}
                            className="mt-2 w-full flex items-center justify-between px-2 py-1 rounded-lg text-[10px] font-bold bg-white/5 hover:bg-white/10 text-white transition-all group-hover:border group-hover:border-white/10"
                        >
                            <span className="truncate">Review in Workflows</span>
                            <ArrowRight size={11} className="transition-transform group-hover:translate-x-0.5" />
                        </button>
                    </div>
                )}
            </motion.div>
        </AnimatePresence>
    );
};
