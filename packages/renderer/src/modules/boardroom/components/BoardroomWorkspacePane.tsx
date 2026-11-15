import React, { useState, useEffect } from 'react';
import { useStore } from '@/core/store';
import { useShallow } from 'zustand/react/shallow';
import {
    Globe,
    LayoutGrid,
    Layers,
    Radio,
    Maximize2,
    Columns,
    X,
    Sparkles,
    Users,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { BoardroomBrowserView } from './BoardroomBrowserView';
import { BoardroomModulePreview } from './BoardroomModulePreview';
import { BoardroomWorkbenchView } from './BoardroomWorkbenchView';
import { BoardroomAgentFeedView } from './BoardroomAgentFeedView';
import { AVAILABLE_AGENTS } from './ParticipantSelector';
import type { BoardroomWorkspaceTab } from '@/core/store/slices/boardroomSlice';
import {
    judgeBoardroomWorkspaceRecommendation,
    type BoardroomWorkspaceRecommendation,
} from '@/config/typesafeJudgments';

interface BoardroomWorkspacePaneProps {
    hasOverlayOpen?: boolean;
}

export function BoardroomWorkspacePane({ hasOverlayOpen = false }: BoardroomWorkspacePaneProps) {
    const {
        boardroomWorkspaceLayout,
        setBoardroomWorkspaceLayout,
        boardroomWorkspaceTab,
        setBoardroomWorkspaceTab,
        setBoardroomPreviewModuleId,
        agentHistory,
        activeAgents,
        toggleAgent,
        soloAgent,
        isCommandMenuOpen,
    } = useStore(
        useShallow(state => ({
            boardroomWorkspaceLayout: state.boardroomWorkspaceLayout,
            setBoardroomWorkspaceLayout: state.setBoardroomWorkspaceLayout,
            boardroomWorkspaceTab: state.boardroomWorkspaceTab,
            setBoardroomWorkspaceTab: state.setBoardroomWorkspaceTab,
            setBoardroomPreviewModuleId: state.setBoardroomPreviewModuleId,
            agentHistory: state.agentHistory || [],
            activeAgents: state.activeAgents || [],
            toggleAgent: state.toggleAgent,
            soloAgent: state.soloAgent,
            isCommandMenuOpen: state.isCommandMenuOpen ?? false,
        }))
    );

    const [rawJevRecommendation, setJevRecommendation] = useState<BoardroomWorkspaceRecommendation | null>(null);
    const jevRecommendation = agentHistory.length > 0 ? rawJevRecommendation : null;

    useEffect(() => {
        let isMounted = true;
        if (agentHistory.length > 0) {
            void judgeBoardroomWorkspaceRecommendation(agentHistory)
                .then(rec => {
                    if (isMounted) setJevRecommendation(rec);
                })
                .catch(() => {});
        }
        return () => {
            isMounted = false;
        };
    }, [agentHistory]);

    const tabs: { id: BoardroomWorkspaceTab; label: string; icon: React.ElementType }[] = [
        { id: 'browser', label: 'Live Browser', icon: Globe },
        { id: 'module', label: 'Studio Preview', icon: LayoutGrid },
        { id: 'workbench', label: 'Asset Workbench', icon: Layers },
        { id: 'agent-feed', label: 'Agent Live Feed', icon: Radio },
    ];

    const isStage = boardroomWorkspaceLayout === 'stage';
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

                {/* Right: Stage / Split toggle & Close button */}
                <div className="flex items-center gap-1 shrink-0 pt-0.5">
                    <button
                        type="button"
                        onClick={() => setBoardroomWorkspaceLayout(isStage ? 'split' : 'stage')}
                        className="p-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/70"
                        title={isStage ? "Switch to Split 3-Pane View" : "Maximize Workspace to Full Left Stage"}
                        aria-label="Toggle Layout"
                        data-testid="boardroom-workspace-layout-toggle"
                    >
                        {isStage ? <Columns size={14} /> : <Maximize2 size={14} />}
                    </button>
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
                        className="flex flex-wrap items-center gap-1.5 px-2.5 py-1 rounded-xl bg-indigo-500/15 hover:bg-indigo-500/25 border border-indigo-500/30 text-[11px] text-indigo-200 transition-all shadow-sm group animate-fadeIn min-w-0 max-w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/70"
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

            {/* Inline Mini Seated Roster Bar (Rendered when in 'stage' mode to keep table controls accessible) */}
            {isStage && (
                <div className="flex items-center gap-1 px-3 py-1.5 bg-black/40 border-b border-white/5 overflow-x-auto custom-scrollbar shrink-0 text-xs">
                    <div className="flex items-center gap-1.5 text-[10px] font-mono text-white/40 uppercase tracking-wider shrink-0 mr-1">
                        <Users size={11} className="text-indigo-400" />
                        <span>Seated Swarm:</span>
                    </div>

                    {/* Conductor Pill */}
                    <button
                        type="button"
                        onClick={() => toggleAgent('generalist')}
                        className={cn(
                            "flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold transition-all shrink-0 border",
                            activeAgents.includes('generalist')
                                ? "bg-emerald-500/20 text-emerald-300 border-emerald-400/40"
                                : "bg-white/5 text-white/40 border-white/5"
                        )}
                    >
                        <Sparkles size={10} />
                        <span>Conductor</span>
                    </button>

                    {/* Department Heads */}
                    {AVAILABLE_AGENTS.map(agent => {
                        const isSeated = activeAgents.includes(agent.id);
                        const Icon = agent.icon;

                        return (
                            <button
                                key={agent.id}
                                type="button"
                                onClick={(e) => {
                                    if (e.altKey) {
                                        soloAgent(agent.id);
                                    } else {
                                        toggleAgent(agent.id);
                                    }
                                }}
                                className={cn(
                                    "flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold transition-all shrink-0 border",
                                    isSeated
                                        ? `${agent.brightBg} ${agent.brightText} ${agent.brightBorder} shadow-xs`
                                        : "bg-white/5 text-white/40 hover:text-white/80 border-white/5"
                                )}
                                title={`${agent.fullName} (Click to toggle, Option+Click to Solo)`}
                            >
                                <Icon size={10} />
                                <span>{agent.shortTitle}</span>
                            </button>
                        );
                    })}
                </div>
            )}

            {/* Active Workspace View Body */}
            <div className="flex-1 relative min-h-0 min-w-0 overflow-hidden flex flex-col">
                {boardroomWorkspaceTab === 'browser' && (
                    <BoardroomBrowserView isVisible={!hasOverlayOpen && !isCommandMenuOpen} />
                )}
                {boardroomWorkspaceTab === 'module' && (
                    <BoardroomModulePreview />
                )}
                {boardroomWorkspaceTab === 'workbench' && (
                    <BoardroomWorkbenchView />
                )}
                {boardroomWorkspaceTab === 'agent-feed' && (
                    <BoardroomAgentFeedView />
                )}
            </div>
        </section>
    );
}
export default BoardroomWorkspacePane;
