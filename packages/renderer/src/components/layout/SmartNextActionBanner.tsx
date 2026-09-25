import React, { useEffect, useState } from 'react';
import { ArrowRight, Sparkles, X } from 'lucide-react';
import { useStore } from '@/core/store';
import { judgeNextBestModule, NextBestModuleVerdict } from '@/config/typesafeJudgments';
import type { ModuleId } from '@/core/constants';

interface SmartNextActionBannerProps {
    className?: string;
    onDismiss?: () => void;
}

export const SmartNextActionBanner: React.FC<SmartNextActionBannerProps> = ({
    className = '',
    onDismiss
}) => {
    const currentModule = useStore((state) => state.currentModule);
    const setModule = useStore((state) => state.setModule);

    const [recommendation, setRecommendation] = useState<{
        module: ModuleId;
        verdict: NextBestModuleVerdict;
    } | null>(null);
    const [isDismissed, setIsDismissed] = useState(false);

    useEffect(() => {
        let active = true;

        // Fetch recommendations based on artist workflow state
        judgeNextBestModule({
            currentModule,
            hasUnreleasedMaster: currentModule === 'creative',
            recentMasterTitle: 'Detroit Rain (Mastered)',
            hasPendingDistribution: currentModule === 'distribution',
            hasUnallocatedSplits: false,
            totalMonthlyStreams: 14200,
            hasActiveTourCampaign: false,
        })
            .then((res) => {
                if (!active) return;
                setRecommendation({ module: currentModule, verdict: res });
            })
            .catch(() => undefined);

        return () => {
            active = false;
        };
    }, [currentModule]);

    if (isDismissed || !recommendation || recommendation.module !== currentModule) {
        return null;
    }

    const { verdict } = recommendation;

    // Do not show banner if artist is already in the target module
    if (verdict.targetModule === currentModule) {
        return null;
    }

    const handleActionClick = () => {
        setModule(verdict.targetModule as ModuleId);
    };

    const handleDismiss = () => {
        setIsDismissed(true);
        if (onDismiss) {
            onDismiss();
        }
    };

    return (
        <aside
            data-testid="smart-next-action-banner"
            aria-label="Next Step Suggestion"
            className={`flex items-center justify-between px-3.5 py-2 bg-gradient-to-r from-purple-950/70 via-gray-900 to-indigo-950/70 border-b border-purple-500/20 text-xs text-gray-200 transition-all ${className}`}
        >
            <div className="flex items-center gap-2.5 min-w-0">
                <div className="flex items-center justify-center w-5 h-5 rounded-full bg-purple-500/20 text-purple-400 flex-shrink-0">
                    <Sparkles className="w-3 h-3" />
                </div>

                <div className="flex items-center gap-2 min-w-0">
                    <span className="font-semibold text-white truncate flex items-center gap-1.5">
                        {verdict.actionTitle}
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-purple-900/60 text-purple-300 font-mono font-normal">
                            ★ Priority {verdict.relevanceScore}/5
                        </span>
                    </span>
                    <span className="text-gray-400 hidden sm:inline truncate">
                        — {verdict.actionDescription}
                    </span>
                </div>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                <button
                    onClick={handleActionClick}
                    data-testid="smart-action-navigate-btn"
                    className="flex items-center gap-1 px-2.5 py-1 rounded bg-purple-600 hover:bg-purple-500 text-white font-medium transition-colors shadow-sm"
                >
                    <span>Proceed to {verdict.targetModule}</span>
                    <ArrowRight className="w-3 h-3" />
                </button>

                <button
                    onClick={handleDismiss}
                    data-testid="smart-action-dismiss-btn"
                    className="p-1 rounded text-gray-500 hover:text-gray-300 hover:bg-white/5 transition-colors"
                    title="Dismiss"
                >
                    <X className="w-3.5 h-3.5" />
                </button>
            </div>
        </aside>
    );
};
