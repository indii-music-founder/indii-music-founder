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

import { ArrowLeft, Users, Layers, Network, Globe, LayoutGrid, Radio, MessageSquare, PanelLeft, X } from 'lucide-react';
import { LivingPlansTracker } from './components/LivingPlansTracker';
import { SwarmCollaborationFeed } from './components/SwarmCollaborationFeed';
import { MobileParticipantDrawer } from './components/MobileParticipantDrawer';
import { BoardroomWorkspacePane } from './components/BoardroomWorkspacePane';
import { cn } from '@/lib/utils';

import { useToast } from '@/core/context/ToastContext';
import { trackFounderFunnelEvent } from '@/services/founders/founderFunnel';
import { BoardroomRightRail } from './components/BoardroomRightRail';
import { normalizeBoardroomAgentIds } from '@/services/agent/departments';
import { Z_LAYER } from '@/core/zLayers';

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

    const { isAnyPhone, isDesktop } = useMobile();

    const activeCount = normalizeBoardroomAgentIds(activeAgents ?? []).length;
    const [isTrackerOpen, setIsTrackerOpen] = React.useState(false);
    const [isSwarmFeedOpen, setIsSwarmFeedOpen] = React.useState(false);
    const [isMobileSeatingOpen, setIsMobileSeatingOpen] = React.useState(false);
    const [isTableOpen, setIsTableOpen] = React.useState(false);
    const [isDiscussionOpen, setIsDiscussionOpen] = React.useState(false);
    // Opening a workspace tab folds the table away so the work gets the room.
    const [isTableDocked, setIsTableDocked] = React.useState(false);
    const [isDiscussionDocked, setIsDiscussionDocked] = React.useState(true);
    const [isRailOpen, setIsRailOpen] = React.useState(false);
    const discussionTrigger = React.useRef<HTMLButtonElement>(null);
    const discussionClose = React.useRef<HTMLButtonElement>(null);
    const returnDiscussionFocus = React.useRef(false);
    const workspaceOpen = boardroomWorkspaceLayout !== 'closed';
    const [workspaceVisited, setWorkspaceVisited] = React.useState(workspaceOpen);
    if (workspaceOpen && !workspaceVisited) setWorkspaceVisited(true);
    const dockSidePanels = isDesktop && !isAnyPhone && boardroomWorkspaceLayout === 'split';
    const enteredBoardroom = React.useRef(false);
    React.useLayoutEffect(() => {
        if (!isBoardroomMode) {
            enteredBoardroom.current = false;
            return;
        }
        if (enteredBoardroom.current) return;
        enteredBoardroom.current = true;
        if (isDesktop && !isAnyPhone && boardroomWorkspaceLayout === 'closed') {
            setBoardroomWorkspaceTab('browser');
            setBoardroomWorkspaceLayout('split');
        }
    }, [isBoardroomMode, isDesktop, isAnyPhone, boardroomWorkspaceLayout, setBoardroomWorkspaceLayout, setBoardroomWorkspaceTab]);

    const showTableOverlay = workspaceOpen && !dockSidePanels && !isAnyPhone && isTableOpen;
    const showDiscussionOverlay = workspaceOpen && !dockSidePanels && isDiscussionOpen;
    const showTable = !isAnyPhone && (!workspaceOpen || (dockSidePanels ? isTableDocked : showTableOverlay));
    const showDiscussion = !workspaceOpen || (dockSidePanels ? isDiscussionDocked : showDiscussionOverlay);
    const toggleTable = () => (dockSidePanels
        ? setIsTableDocked(value => !value)
        : setIsTableOpen(value => !value));
    const hasTrackedBoardroomView = React.useRef(false);

    React.useLayoutEffect(() => {
        if (showDiscussionOverlay) discussionClose.current?.focus();
        else if (returnDiscussionFocus.current) {
            returnDiscussionFocus.current = false;
            discussionTrigger.current?.focus();
        }
    }, [showDiscussionOverlay]);

    const closeDiscussion = () => {
        returnDiscussionFocus.current = true;
        setIsDiscussionOpen(false);
    };

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
                className={cn("fixed inset-0 bg-bg-dark flex flex-col", Z_LAYER.boardroom)}
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
                                <span className="hidden 2xl:inline">Back to Studio</span>
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
                                className={`flex items-center gap-1 text-[10px] font-mono ${activeCount === 0 ? 'text-indigo-400 bg-indigo-500/10 hover:bg-indigo-500/20 border-indigo-500/20' : 'text-gray-400 bg-white/[0.03] hover:bg-white/10 border-white/8'} px-2 py-0.5 rounded-md border transition-colors shrink-0 ${isAnyPhone ? '' : 'cursor-default hover:bg-white/[0.03]'}`}
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
                        {workspaceOpen && (
                            <>
                                {!isAnyPhone && showTable && (
                                    <button
                                        type="button"
                                        aria-label="Hide table"
                                        aria-expanded
                                        onClick={toggleTable}
                                        className="rounded-lg p-2 text-white/70 hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-indigo-400"
                                    >
                                        <PanelLeft size={16} />
                                    </button>
                                )}
                                <button
                                    ref={discussionTrigger}
                                    type="button"
                                    aria-label="Discussion"
                                    aria-expanded={showDiscussion}
                                    aria-controls="boardroom-discussion"
                                    onClick={() => {
                                        if (dockSidePanels) setIsDiscussionDocked(value => !value);
                                        else if (showDiscussionOverlay) closeDiscussion();
                                        else setIsDiscussionOpen(true);
                                    }}
                                    className="rounded-lg p-2 text-white/70 hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-indigo-400"
                                >
                                    <MessageSquare size={16} />
                                </button>
                            </>
                        )}
                        {!workspaceOpen && (
                            <button
                                type="button"
                                aria-label="Open workspace"
                                onClick={() => setBoardroomWorkspaceLayout('split')}
                                className="rounded-lg p-2 text-white/70 hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-indigo-400 md:hidden"
                            >
                                <LayoutGrid size={16} />
                            </button>
                        )}
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
                                    "flex items-center gap-1.5 px-2 py-1 rounded-md transition-all text-[10px] font-bold uppercase tracking-wider",
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
                                    "flex items-center gap-1.5 px-2 py-1 rounded-md transition-all text-[10px] font-bold uppercase tracking-wider",
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
                                    "flex items-center gap-1.5 px-2 py-1 rounded-md transition-all text-[10px] font-bold uppercase tracking-wider",
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
                                    "flex items-center gap-1.5 px-2 py-1 rounded-md transition-all text-[10px] font-bold uppercase tracking-wider",
                                    boardroomWorkspaceLayout !== 'closed' && boardroomWorkspaceTab === 'agent-feed'
                                        ? "bg-indigo-600 text-white shadow-sm shadow-indigo-500/25"
                                        : "text-gray-300 hover:text-white hover:bg-white/10"
                                )}
                                title="Agent workflow activity and handoffs"
                                aria-label="Toggle agent activity feed"
                            >
                                <Radio size={11} className={boardroomWorkspaceLayout !== 'closed' && boardroomWorkspaceTab === 'agent-feed' ? "text-white" : "text-cyan-400"} />
                                <span className="hidden lg:inline">Feed</span>
                            </button>
                        </div>
                    </div>
                </div>

                {/* Split-Panel Content */}
                <div className="relative flex-1 flex min-h-0 min-w-0 w-full overflow-hidden">
                    {/* Left: Boardroom table */}
                    {workspaceOpen && !isAnyPhone && !showTable && (
                        <button
                            type="button"
                            aria-label="Show table"
                            aria-expanded={false}
                            onClick={toggleTable}
                            data-testid="boardroom-show-table-edge"
                            className="shrink-0 w-6 flex flex-col items-center justify-center gap-2 border-r border-white/10 bg-white/[0.02] text-white/60 hover:bg-white/[0.06] hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-400"
                        >
                            <PanelLeft size={14} aria-hidden />
                            <span className="text-[10px] font-semibold uppercase tracking-widest [writing-mode:vertical-rl] rotate-180">Table</span>
                        </button>
                    )}
                    {showTable && (
                        <motion.div
                            key="boardroom-table"
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.1, type: 'spring', damping: 25, stiffness: 200 }}
                            className={cn(
                                "relative shrink-0 flex items-center justify-center p-4 lg:p-5 transition-all duration-300 min-w-0 overflow-hidden",
                                showTableOverlay
                                    ? "absolute inset-y-0 left-0 z-30 w-full max-w-lg border-r border-white/10 bg-zinc-950"
                                    : dockSidePanels ? "w-1/4 max-w-sm border-r border-white/10" : "w-[55%]"
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
                    {workspaceVisited && (
                        <motion.div
                            key="boardroom-workspace"
                            initial={{ opacity: 0, scale: 0.98 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ duration: 0.2 }}
                            hidden={!workspaceOpen}
                            className={cn("flex-1 min-w-0 min-h-0 flex-col overflow-hidden relative z-10 isolate", workspaceOpen ? "flex" : "hidden")}
                            data-testid="boardroom-workspace-container"
                        >
                            <BoardroomWorkspacePane
                                isOpen={workspaceOpen}
                                hasOverlayOpen={!workspaceOpen || isTrackerOpen || isSwarmFeedOpen || isMobileSeatingOpen || showTableOverlay || showDiscussionOverlay || isRailOpen}
                            />
                        </motion.div>
                    )}

                    <div
                        id="boardroom-discussion"
                        hidden={!showDiscussion}
                        className={cn(
                            "flex-col min-h-0 min-w-0 bg-zinc-950 overflow-hidden border-l border-white/10 z-30",
                            showDiscussion ? "flex" : "hidden",
                            showDiscussionOverlay
                                ? cn("absolute inset-y-0 w-full max-w-md shadow-2xl", isAnyPhone ? "right-0" : "right-14")
                                : dockSidePanels ? "relative w-[28%] max-w-md shrink-0" : "relative flex-1"
                        )}
                        onKeyDown={event => {
                            if (showDiscussionOverlay && event.key === 'Escape' && !event.defaultPrevented) {
                                event.stopPropagation();
                                closeDiscussion();
                            }
                        }}
                        data-testid="boardroom-conversation-container"
                    >
                        {showDiscussionOverlay && (
                            <button
                                ref={discussionClose}
                                type="button"
                                onClick={closeDiscussion}
                                className="m-2 self-end rounded-lg p-2 hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-indigo-400"
                                aria-label="Close discussion"
                            >
                                <X size={16} />
                            </button>
                        )}
                        <BoardroomConversationPanel messages={boardroomMessages} />
                    </div>

                    {/* Dedicated Boardroom Right Vertical Rail */}
                    {!isAnyPhone && (
                        <BoardroomRightRail
                            onOpenLivingPlans={() => setIsTrackerOpen(true)}
                            onOpenSwarmFeed={() => setIsSwarmFeedOpen(true)}
                            onOpenChange={setIsRailOpen}
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
