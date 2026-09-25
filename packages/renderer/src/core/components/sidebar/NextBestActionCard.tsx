import React, { useState, useEffect } from 'react';
import { Sparkles, ArrowRight, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { judgeNextBestAction, type NextBestActionVerdict } from '@/config/typesafeJudgments';
import { useStore } from '@/core/store';
import { type ModuleId } from '@/core/constants';

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
    const [dismissedForModule, setDismissedForModule] = useState<string | null>(null);

    useEffect(() => {
        let isMounted = true;
        const fetchNextAction = async () => {
            try {
                const state = useStore.getState();
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
    }, [currentModule]);

    if (!isSidebarOpen || !verdict || verdict.nextModule === currentModule || dismissedForModule === currentModule) {
        return null;
    }

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
                        <span className="text-[10px] font-bold uppercase tracking-wider">Suggested Next</span>
                    </div>
                    <button
                        onClick={() => setDismissedForModule(currentModule)}
                        className="text-gray-500 hover:text-gray-300 p-0.5 rounded transition-colors"
                        aria-label="Dismiss recommendation"
                    >
                        <X size={11} />
                    </button>
                </div>

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
            </motion.div>
        </AnimatePresence>
    );
};
