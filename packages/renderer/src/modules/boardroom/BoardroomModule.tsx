import React from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { useStore } from '@/core/store';
import { useShallow } from 'zustand/react/shallow';
import ParticipantSelector from './components/ParticipantSelector';
import { BoardroomTable } from './components/BoardroomTable';
import { BoardroomConversationPanel } from './components/BoardroomConversationPanel';
import { useMobile } from '@/hooks/useMobile';
import { BoardroomJourney } from './components/BoardroomJourney';

import { ArrowLeft, Users, Layers, Bot, Network, Globe, LayoutGrid, Radio } from 'lucide-react';
import { LivingPlansTracker } from './components/LivingPlansTracker';
import { SwarmCollaborationFeed } from './components/SwarmCollaborationFeed';
import { MobileParticipantDrawer } from './components/MobileParticipantDrawer';
import { BoardroomWorkspacePane } from './components/BoardroomWorkspacePane';
import { getColorForModule } from '@/core/theme/moduleColors';
import { cn } from '@/lib/utils';

import { useToast } from '@/core/context/ToastContext';
import { trackFounderFunnelEvent } from '@/services/founders/founderFunnel';
import { BoardroomRightRail } from './components/BoardroomRightRail';

/**
 * BoardroomModule — The virtual multi-agent boardroom.
 *
 * Split-panel layout:
 * - Left:  Orbital visualization (glassmorphic oval + agent icons)
 * - Right: Persistent, scrollable conversation panel
 *
 * On mobile, the orbital ring collapses and the conversation panel
 * takes full width for a chat-focused experience.
 *
 * Architecture:
 * - BoardroomTable            → Glassmorphic oval with core glow + status
 * - ParticipantSelector       → Draggable agent icons around the perimeter
 * - BoardroomConversationPanel → Full-height scrollable message feed
 *
 * */
export function BoardroomModule() {
    const toast = useToast();
    const { 
        conversationMode, 
        boardroomMessages, 
        activeAgents, 
        userProfile,
        setConversationMode,
        consumeHandoff,
        addReferencedAsset,
        boardroomWorkspaceLayout,
        boardroomWorkspaceTab,
        setBoardroomWorkspaceLayout,
        setBoardroomWorkspaceTab,
    } = useStore(
        useShallow(state => ({
            conversationMode: state.conversationMode,
            boardroomMessages: state.agentHistory,
            activeAgents: state.activeAgents,
            userProfile: state.userProfile,
            setConversationMode: state.setConversationMode,
            consumeHandoff: state.consumeHandoff,
            addReferencedAsset: state.addReferencedAsset,
            toggleAgent: state.toggleAgent,
            boardroomWorkspaceLayout: state.boardroomWorkspaceLayout ?? 'closed',
            boardroomWorkspaceTab: state.boardroomWorkspaceTab ?? 'browser',
            setBoardroomWorkspaceLayout: state.setBoardroomWorkspaceLayout,
            setBoardroomWorkspaceTab: state.setBoardroomWorkspaceTab,
        }))
    );
    const isBoardroomMode = conversationMode === 'boardroom';

    const { isAnyPhone } = useMobile();

    const activeCount = activeAgents?.length || 0;
    const [isTrackerOpen, setIsTrackerOpen] = React.useState(false);
    const [isSwarmFeedOpen, setIsSwarmFeedOpen] = React.useState(false);
    const [isMobileSeatingOpen, setIsMobileSeatingOpen] = React.useState(false);
    const hasTrackedBoardroomView = React.useRef(false);

    // Staged Handoff Hook Interceptor
    React.useEffect(() => {
        if (isBoardroomMode) {
            const isFounderAccess =
                userProfile?.subscriptionTier === 'founder' ||
                userProfile?.tier === 'founder' ||
                userProfile?.isFounder === true ||
                (typeof window !== 'undefined' && window.localStorage.getItem('indii_founder_preview_pending') === 'true');

            if (isFounderAccess && !hasTrackedBoardroomView.current) {
                hasTrackedBoardroomView.current = true;
                void trackFounderFunnelEvent('founder_boardroom_reached', {
                    surface: 'boardroom',
                    activeAgents: activeCount,
                }, {
                    userId: userProfile?.id ?? null,
                    email: userProfile?.email ?? null,
                });
            }

            const payload = consumeHandoff('boardroom');
            if (payload) {
                addReferencedAsset({
                    id: payload.assetId,
                    name: payload.prompt || 'Creative Asset Plot',
                    type: 'url',
                    value: payload.assetUrl
                });
                toast.success(`Creative graphic "${payload.prompt || 'staged asset'}" loaded into Boardroom references!`);
            }
        }
    }, [isBoardroomMode, consumeHandoff, addReferencedAsset, toast, userProfile, activeCount]);

    if (!isBoardroomMode) return null;

    if (typeof document === 'undefined') return null;

    return createPortal(
        <AnimatePresence>
            <motion.div
                key="boardroom-canvas"
                data-testid="boardroom-module"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                className="fixed inset-0 z-[99999] bg-bg-dark flex flex-col"
            >
                {/* Single Unified 48px Header Row */}
                <div
                    data-testid="boardroom-header"
                    className="flex items-center justify-between px-3 md:px-4 py-2 h-12 gap-2 bg-[#060608]/95 backdrop-blur-xl border-b border-white/6 shrink-0 select-none z-20"
                >
                    {/* Left: Navigation, Identity & Integrated Executive Missions */}
                    <div className="flex items-center gap-2 md:gap-3 min-w-0 flex-1">
                        <div className="flex items-center gap-0.5 shrink-0 bg-white/[0.03] p-0.5 rounded-lg border border-white/5">
                            <button
                                onClick={() => setConversationMode('direct')}
                                className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-gray-400 hover:text-white hover:bg-white/10 transition-colors text-[11px] font-semibold"
                                title="Exit Boardroom"
                                aria-label="Back to Studio"
                                data-testid="boardroom-back-btn"
                            >
                                <ArrowLeft size={13} />
                                <span className="hidden sm:inline">Back to Studio</span>
                            </button>
                        </div>

                        <div className="flex items-center gap-2 text-gray-400 shrink-0">
                            <Network size={15} className="text-indigo-400" />
                            <h1 className="text-xs font-bold text-indigo-300 tracking-tight uppercase">
                                Boardroom HQ
                            </h1>
                        </div>

                        {(activeCount > 0 || isAnyPhone) && (
                            <button
                                onClick={() => isAnyPhone && setIsMobileSeatingOpen(true)}
                                className={`flex items-center gap-1 text-[10px] font-mono ${activeCount === 0 ? 'text-indigo-400 bg-indigo-500/10 hover:bg-indigo-500/20 border-indigo-500/20' : 'text-gray-400 bg-white/[0.03] hover:bg-white/10 border-white/8'} px-2 py-0.5 rounded-md border transition-colors shrink-0 ${!isAnyPhone && 'cursor-default hover:bg-white/[0.03]'}`}
                                aria-label="Seat agents"
                            >
                                <Users size={10} />
                                <span>{activeCount > 0 ? `${activeCount} active` : 'Seat Agents'}</span>
                            </button>
                        )}

                        <div className="h-3.5 w-px bg-white/8 mx-0.5 shrink-0" />

                        {/* Integrated Executive Missions, Jev Recommendation & Meta-Harness Pill */}
                        <BoardroomJourney />
                    </div>

                    {/* Right: Consolidated Utility Dock */}
                    <div className="flex items-center gap-1.5 shrink-0 justify-end">
                        {/* Boardroom Multi-Use Workspace Switchers */}
                        <div className="hidden md:flex items-center bg-white/4 p-0.5 rounded-lg border border-white/6" data-testid="boardroom-workspace-dock">
                            <button
                                onClick={() => {
                                    if (boardroomWorkspaceLayout !== 'closed' && boardroomWorkspaceTab === 'browser') {
                                        setBoardroomWorkspaceLayout('closed');
                                    } else {
                                        setBoardroomWorkspaceTab('browser');
                                        if (boardroomWorkspaceLayout === 'closed') setBoardroomWorkspaceLayout('split');
                                    }
                                }}
                                data-testid="boardroom-workspace-toggle-browser"
                                className={cn(
                                    "flex items-center gap-1.5 px-2.5 py-1 rounded-md transition-all text-[10px] font-bold uppercase tracking-wider",
                                    boardroomWorkspaceLayout !== 'closed' && boardroomWorkspaceTab === 'browser'
                                        ? "bg-indigo-600 text-white shadow-sm shadow-indigo-500/25"
                                        : "text-gray-300 hover:text-white hover:bg-white/10"
                                )}
                                title="Live Web Browser"
                                aria-label="Toggle Live Browser"
                            >
                                <Globe size={11} className={boardroomWorkspaceLayout !== 'closed' && boardroomWorkspaceTab === 'browser' ? "text-white" : "text-indigo-400"} />
                                <span className="hidden lg:inline">Browser</span>
                            </button>
                            <button
                                onClick={() => {
                                    if (boardroomWorkspaceLayout !== 'closed' && boardroomWorkspaceTab === 'module') {
                                        setBoardroomWorkspaceLayout('closed');
                                    } else {
                                        setBoardroomWorkspaceTab('module');
                                        if (boardroomWorkspaceLayout === 'closed') setBoardroomWorkspaceLayout('split');
                                    }
                                }}
                                data-testid="boardroom-workspace-toggle-module"
                                className={cn(
                                    "flex items-center gap-1.5 px-2.5 py-1 rounded-md transition-all text-[10px] font-bold uppercase tracking-wider",
                                    boardroomWorkspaceLayout !== 'closed' && boardroomWorkspaceTab === 'module'
                                        ? "bg-indigo-600 text-white shadow-sm shadow-indigo-500/25"
                                        : "text-gray-300 hover:text-white hover:bg-white/10"
                                )}
                                title="In-Place Studio Module Preview"
                                aria-label="Toggle Studio Module"
                            >
                                <LayoutGrid size={11} className={boardroomWorkspaceLayout !== 'closed' && boardroomWorkspaceTab === 'module' ? "text-white" : "text-emerald-400"} />
                                <span className="hidden lg:inline">Studio</span>
                            </button>
                            <button
                                onClick={() => {
                                    if (boardroomWorkspaceLayout !== 'closed' && boardroomWorkspaceTab === 'workbench') {
                                        setBoardroomWorkspaceLayout('closed');
                                    } else {
                                        setBoardroomWorkspaceTab('workbench');
                                        if (boardroomWorkspaceLayout === 'closed') setBoardroomWorkspaceLayout('split');
                                    }
                                }}
                                data-testid="boardroom-workspace-toggle-workbench"
                                className={cn(
                                    "flex items-center gap-1.5 px-2.5 py-1 rounded-md transition-all text-[10px] font-bold uppercase tracking-wider",
                                    boardroomWorkspaceLayout !== 'closed' && boardroomWorkspaceTab === 'workbench'
                                        ? "bg-indigo-600 text-white shadow-sm shadow-indigo-500/25"
                                        : "text-gray-300 hover:text-white hover:bg-white/10"
                                )}
                                title="Asset & Document Workbench"
                                aria-label="Toggle Asset Workbench"
                            >
                                <Layers size={11} className={boardroomWorkspaceLayout !== 'closed' && boardroomWorkspaceTab === 'workbench' ? "text-white" : "text-purple-400"} />
                                <span className="hidden lg:inline">Workbench</span>
                            </button>
                            <button
                                onClick={() => {
                                    if (boardroomWorkspaceLayout !== 'closed' && boardroomWorkspaceTab === 'agent-feed') {
                                        setBoardroomWorkspaceLayout('closed');
                                    } else {
                                        setBoardroomWorkspaceTab('agent-feed');
                                        if (boardroomWorkspaceLayout === 'closed') setBoardroomWorkspaceLayout('split');
                                    }
                                }}
                                data-testid="boardroom-workspace-toggle-feed"
                                className={cn(
                                    "flex items-center gap-1.5 px-2.5 py-1 rounded-md transition-all text-[10px] font-bold uppercase tracking-wider",
                                    boardroomWorkspaceLayout !== 'closed' && boardroomWorkspaceTab === 'agent-feed'
                                        ? "bg-indigo-600 text-white shadow-sm shadow-indigo-500/25"
                                        : "text-gray-300 hover:text-white hover:bg-white/10"
                                )}
                                title="Live Agent Computer Feed & Telemetry"
                                aria-label="Toggle Live Agent Feed"
                            >
                                <Radio size={11} className={boardroomWorkspaceLayout !== 'closed' && boardroomWorkspaceTab === 'agent-feed' ? "text-white" : "text-cyan-400"} />
                                <span className="hidden lg:inline">Feed</span>
                            </button>
                        </div>

                        <div className="flex items-center bg-white/4 p-0.5 rounded-lg border border-white/6">
                            <button
                                onClick={() => setIsSwarmFeedOpen(true)}
                                data-testid="boardroom-swarm-feed-btn"
                                className="flex items-center gap-1.5 px-2.5 py-1 rounded-md transition-all text-[10px] font-bold uppercase tracking-wider text-indigo-300 hover:text-white hover:bg-indigo-500/15"
                                title="View Swarm Collaboration Feed"
                                aria-label="Swarm Feed"
                            >
                                <Bot size={11} className="text-indigo-400" />
                                <span className="hidden sm:inline">Swarm Feed</span>
                            </button>
                            <button
                                onClick={() => setIsTrackerOpen(true)}
                                data-testid="boardroom-living-plans-btn"
                                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md transition-all text-[10px] font-bold uppercase tracking-wider ${getColorForModule('agent').text} hover:bg-white/8`}
                                title="View Active Plans"
                                aria-label="Living Plans"
                            >
                                <Layers size={11} />
                                <span className="hidden sm:inline">Living Plans</span>
                            </button>
                        </div>

                        <div className="hidden lg:flex items-center gap-1.5 px-1.5 py-0.5 bg-white/3 rounded-md border border-white/6 shrink-0" title="Executive Swarm Status">
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_6px_rgba(16,185,129,0.4)]" />
                            <span className="text-[8px] font-mono text-white/40 uppercase tracking-widest">ONLINE</span>
                        </div>
                    </div>
                </div>

                {/* Split-Panel Content */}
                <div className="flex-1 flex min-h-0 overflow-hidden">
                    {/* Left: Orbital Visualization — rendered when not on mobile and not full-stage */}
                    {!isAnyPhone && boardroomWorkspaceLayout !== 'stage' && (
                        <motion.div
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.1, type: 'spring', damping: 25, stiffness: 200 }}
                            className={cn(
                                "relative shrink-0 flex items-center justify-center p-6 transition-all duration-300",
                                boardroomWorkspaceLayout === 'split' ? "w-[28%]" : "w-[55%]"
                            )}
                            data-testid="boardroom-orbital-panel"
                        >
                            <div className="relative w-full h-full max-w-2xl max-h-[70vh]">
                                <BoardroomTable
                                    messages={boardroomMessages}
                                    activeCount={activeCount}
                                    onOpenLivingPlans={() => setIsTrackerOpen(true)}
                                />
                                <ParticipantSelector />
                            </div>
                        </motion.div>
                    )}

                    {/* Middle: Boardroom Multi-Use Workspace Pane (Browser, Studio Module, Workbench, Agent Feed) */}
                    {boardroomWorkspaceLayout !== 'closed' && (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.98 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ duration: 0.2 }}
                            className="flex-1 min-w-0 min-h-0 flex flex-col overflow-hidden"
                            data-testid="boardroom-workspace-container"
                        >
                            <BoardroomWorkspacePane />
                        </motion.div>
                    )}

                    {/* Right: Persistent Conversation Panel */}
                    <motion.div
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.15, type: 'spring', damping: 25, stiffness: 200 }}
                        className={cn(
                            "flex flex-col min-h-0 min-w-0 bg-white/1 overflow-hidden transition-all duration-300",
                            isAnyPhone ? "flex-1" :
                            boardroomWorkspaceLayout === 'closed' ? "flex-1 border-l border-white/5" :
                            boardroomWorkspaceLayout === 'stage' ? "w-[36%] shrink-0 border-l border-white/5" :
                            "w-[32%] shrink-0 border-l border-white/5"
                        )}
                        data-testid="boardroom-conversation-container"
                    >
                        <BoardroomConversationPanel messages={boardroomMessages} />
                    </motion.div>

                    {/* Dedicated Boardroom Right Vertical Rail */}
                    {!isAnyPhone && (
                        <BoardroomRightRail
                            onOpenLivingPlans={() => setIsTrackerOpen(true)}
                            onOpenSwarmFeed={() => setIsSwarmFeedOpen(true)}
                        />
                    )}
                </div>

                <LivingPlansTracker isOpen={isTrackerOpen} onClose={() => setIsTrackerOpen(false)} />
                <SwarmCollaborationFeed isOpen={isSwarmFeedOpen} onClose={() => setIsSwarmFeedOpen(false)} />
                {isAnyPhone && (
                    <MobileParticipantDrawer 
                        isOpen={isMobileSeatingOpen} 
                        onClose={() => setIsMobileSeatingOpen(false)} 
                    />
                )}
            </motion.div>
        </AnimatePresence>,
        document.body
    );
}
