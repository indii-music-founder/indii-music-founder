import React from 'react';
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

export function BoardroomWorkspacePane() {
    const {
        boardroomWorkspaceLayout,
        setBoardroomWorkspaceLayout,
        boardroomWorkspaceTab,
        setBoardroomWorkspaceTab,
        activeAgents,
        toggleAgent,
        soloAgent,
    } = useStore(
        useShallow(state => ({
            boardroomWorkspaceLayout: state.boardroomWorkspaceLayout,
            setBoardroomWorkspaceLayout: state.setBoardroomWorkspaceLayout,
            boardroomWorkspaceTab: state.boardroomWorkspaceTab,
            setBoardroomWorkspaceTab: state.setBoardroomWorkspaceTab,
            activeAgents: state.activeAgents || [],
            toggleAgent: state.toggleAgent,
            soloAgent: state.soloAgent,
        }))
    );

    const tabs: { id: BoardroomWorkspaceTab; label: string; icon: React.ElementType }[] = [
        { id: 'browser', label: 'Live Browser', icon: Globe },
        { id: 'module', label: 'Studio Preview', icon: LayoutGrid },
        { id: 'workbench', label: 'Asset Workbench', icon: Layers },
        { id: 'agent-feed', label: 'Agent Live Feed', icon: Radio },
    ];

    const isStage = boardroomWorkspaceLayout === 'stage';

    return (
        <section
            data-testid="boardroom-workspace-pane"
            className="h-full flex flex-col bg-zinc-950 border-r border-white/5 min-h-0 min-w-0 flex-1 overflow-hidden relative z-10"
        >
            {/* Top Workspace Bar */}
            <div className="flex items-center justify-between px-3 py-2 bg-[#09090d] border-b border-white/10 shrink-0 gap-2 select-none">
                {/* Left: 4 Tab Switchers */}
                <div className="flex items-center gap-1 bg-white/5 p-0.5 rounded-xl border border-white/5 shrink-0 overflow-x-auto custom-scrollbar">
                    {tabs.map(t => {
                        const Icon = t.icon;
                        const isActive = boardroomWorkspaceTab === t.id;

                        return (
                            <button
                                key={t.id}
                                type="button"
                                onClick={() => setBoardroomWorkspaceTab(t.id)}
                                data-testid={`boardroom-tab-${t.id}`}
                                className={cn(
                                    "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap",
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
                <div className="flex items-center gap-1 shrink-0">
                    <button
                        type="button"
                        onClick={() => setBoardroomWorkspaceLayout(isStage ? 'split' : 'stage')}
                        className="p-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors"
                        title={isStage ? "Switch to Split 3-Pane View" : "Maximize Workspace to Full Left Stage"}
                        aria-label="Toggle Layout"
                        data-testid="boardroom-workspace-layout-toggle"
                    >
                        {isStage ? <Columns size={14} /> : <Maximize2 size={14} />}
                    </button>
                    <button
                        type="button"
                        onClick={() => setBoardroomWorkspaceLayout('closed')}
                        className="p-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors"
                        title="Close Workspace Pane"
                        aria-label="Close Workspace"
                        data-testid="boardroom-workspace-close-btn"
                    >
                        <X size={15} />
                    </button>
                </div>
            </div>

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
                    <BoardroomBrowserView isVisible={true} />
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
