import React, { useState, useEffect } from 'react';
import type { AgentMessage } from '@/core/store/slices/agent';
import { useStore } from '@/core/store';
import { useShallow } from 'zustand/react/shallow';
import {
    Globe,
    LayoutGrid,
    Layers,
    Radio,
    X,
    Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { BoardroomBrowserView } from './BoardroomBrowserView';
import { BoardroomModulePreview } from './BoardroomModulePreview';
import { BoardroomWorkbenchView } from './BoardroomWorkbenchView';
import { BoardroomAgentFeedView } from './BoardroomAgentFeedView';
import type { BoardroomWorkspaceTab } from '@/core/store/slices/boardroomSlice';
import {
    judgeBoardroomWorkspaceRecommendation,
    type BoardroomWorkspaceRecommendation,
} from '@/config/typesafeJudgments';

const WORKSPACE_JUDGE_SETTLE_MS = 750;

/** Stable key for a settled conversation; null while empty or while any reply streams. */
function getSettledHistoryKey(history: AgentMessage[] | undefined): string | null {
    if (!history || history.length === 0) return null;
    if (history.some(message => message.isStreaming)) return null;
    const last = history[history.length - 1];
    return `${history.length}:${last.id}:${last.text?.length ?? 0}`;
}

interface BoardroomWorkspacePaneProps {
    hasOverlayOpen?: boolean;
}

export function BoardroomWorkspacePane({ hasOverlayOpen = false }: BoardroomWorkspacePaneProps) {
    const {
        setBoardroomWorkspaceLayout,
        boardroomWorkspaceTab,
        setBoardroomWorkspaceTab,
        setBoardroomPreviewModuleId,
        historyLength,
        settledHistoryKey,
        isCommandMenuOpen,
    } = useStore(
        useShallow(state => ({
            setBoardroomWorkspaceLayout: state.setBoardroomWorkspaceLayout,
            boardroomWorkspaceTab: state.boardroomWorkspaceTab,
            setBoardroomWorkspaceTab: state.setBoardroomWorkspaceTab,
            setBoardroomPreviewModuleId: state.setBoardroomPreviewModuleId,
            historyLength: state.agentHistory?.length ?? 0,
            settledHistoryKey: getSettledHistoryKey(state.agentHistory),
            isCommandMenuOpen: state.isCommandMenuOpen ?? false,
        }))
    );

    const [visitedTabs, setVisitedTabs] = useState<ReadonlySet<BoardroomWorkspaceTab>>(
        () => new Set([boardroomWorkspaceTab]),
    );
    if (!visitedTabs.has(boardroomWorkspaceTab)) {
        setVisitedTabs(new Set([...visitedTabs, boardroomWorkspaceTab]));
    }

    const [rawJevRecommendation, setJevRecommendation] = useState<BoardroomWorkspaceRecommendation | null>(null);
    const jevRecommendation = historyLength > 0 ? rawJevRecommendation : null;

    // The workspace judge is a paid backend call. Run it once per settled reply,
    // never per streamed token (ISSUE-1624): the key is null while any message streams.
    useEffect(() => {
        if (!settledHistoryKey) return undefined;
        let isMounted = true;
        const timer = setTimeout(() => {
            const history = useStore.getState().agentHistory ?? [];
            void judgeBoardroomWorkspaceRecommendation(history)
                .then(rec => {
                    if (isMounted) setJevRecommendation(rec);
                })
                .catch(() => {});
        }, WORKSPACE_JUDGE_SETTLE_MS);
        return () => {
            isMounted = false;
            clearTimeout(timer);
        };
    }, [settledHistoryKey]);

    const tabs: { id: BoardroomWorkspaceTab; label: string; icon: React.ElementType }[] = [
        { id: 'browser', label: 'Live Browser', icon: Globe },
        { id: 'module', label: 'Studio Preview', icon: LayoutGrid },
        { id: 'workbench', label: 'Asset Workbench', icon: Layers },
        { id: 'agent-feed', label: 'Agent Live Feed', icon: Radio },
    ];

    const recommendedTabMeta = jevRecommendation
        ? tabs.find(t => t.id === jevRecommendation.recommendedTab)
        : undefined;
    const recommendedTabLabel = recommendedTabMeta?.label ?? jevRecommendation?.recommendedTab;

    return (
        <section
            data-testid="boardroom-workspace-pane"
            className="@container h-full flex flex-col bg-zinc-950 border-r border-white/5 min-h-0 min-w-0 flex-1 overflow-hidden relative"
        >
            {/* Top Workspace Bar */}
            <div className="flex items-start justify-between px-3 py-2 bg-[#09090d] border-b border-white/10 shrink-0 gap-2 select-none min-w-0">
                {/* Left: 4 Tab Switchers */}
                <div
                    role="tablist"
                    aria-label="Boardroom workspace sections"
                    className="flex flex-wrap items-center gap-1 bg-white/5 p-0.5 rounded-xl border border-white/5 min-w-0"
                >
                    {tabs.map(t => {
                        const Icon = t.icon;
                        const isActive = boardroomWorkspaceTab === t.id;

                        return (
                            <button
                                key={t.id}
                                type="button"
                                role="tab"
                                aria-selected={isActive}
                                onClick={() => setBoardroomWorkspaceTab(t.id)}
                                data-testid={`boardroom-tab-${t.id}`}
                                className={cn(
                                    "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-all whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/70",
                                    isActive
                                        ? "bg-indigo-600 text-white shadow-sm shadow-indigo-500/25"
                                        : "text-white/60 hover:text-white hover:bg-white/5"
                                )}
                            >
                                <Icon size={13} className={isActive ? "text-white" : "text-white/40"} />
                                <span>{t.label}</span>
                            </button>
                        );
                    })}
                </div>

                {/* Close workspace */}
                <div className="flex items-center gap-1 shrink-0 pt-0.5">
                    <button
                        type="button"
                        onClick={() => setBoardroomWorkspaceLayout('closed')}
                        className="p-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/70"
                        title="Close Workspace Pane"
                        aria-label="Close Workspace"
                        data-testid="boardroom-workspace-close-btn"
                    >
                        <X size={15} />
                    </button>
                </div>
            </div>

            {/* TypeSafe Jev Smart Recommendation Strip (Dedicated row so workspace tabs never clip) */}
            {jevRecommendation && jevRecommendation.recommendedTab !== boardroomWorkspaceTab && (
                <div className="px-3 py-1.5 bg-indigo-950/35 border-b border-indigo-500/20 shrink-0 flex items-center justify-between gap-2 min-w-0">
                    <button
                        type="button"
                        onClick={() => {
                            setBoardroomWorkspaceTab(jevRecommendation.recommendedTab);
                            if (jevRecommendation.recommendedModule && setBoardroomPreviewModuleId) {
                                setBoardroomPreviewModuleId(jevRecommendation.recommendedModule);
                            }
                        }}
                        data-testid="boardroom-workspace-jev-suggestion"
                        className="flex flex-wrap items-center gap-1.5 px-2.5 py-1 rounded-xl bg-indigo-500/15 hover:bg-indigo-500/25 border border-indigo-500/30 text-[11px] text-indigo-200 transition-all shadow-sm group motion-safe:animate-in motion-safe:fade-in-0 min-w-0 max-w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/70"
                        title={jevRecommendation.reasoningHint}
                    >
                        <Sparkles size={11} className="text-indigo-400 group-hover:rotate-12 transition-transform shrink-0" />
                        <span className="font-semibold text-indigo-300 shrink-0">Jev Suggests:</span>
                        <span className="font-bold text-white">{recommendedTabLabel}</span>
                        {jevRecommendation.recommendedModule && (
                            <span className="text-indigo-300/80 font-mono text-[10px]">({jevRecommendation.recommendedModule})</span>
                        )}
                    </button>
                </div>
            )}

            <div className="flex-1 relative min-h-0 min-w-0 overflow-hidden">
                {visitedTabs.has('browser') && (
                    <div hidden={boardroomWorkspaceTab !== 'browser'} className="h-full">
                        <BoardroomBrowserView isVisible={boardroomWorkspaceTab === 'browser' && !hasOverlayOpen && !isCommandMenuOpen} />
                    </div>
                )}
                {visitedTabs.has('module') && (
                    <div hidden={boardroomWorkspaceTab !== 'module'} className="h-full">
                        <BoardroomModulePreview />
                    </div>
                )}
                {visitedTabs.has('workbench') && (
                    <div hidden={boardroomWorkspaceTab !== 'workbench'} className="h-full">
                        <BoardroomWorkbenchView />
                    </div>
                )}
                {boardroomWorkspaceTab === 'agent-feed' && <BoardroomAgentFeedView />}
            </div>
        </section>
    );
}
export default BoardroomWorkspacePane;
