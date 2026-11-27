import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
    Activity,
    AlertTriangle,
    Clock3,
    ShieldCheck,
    Bot,
    Globe,
    Layers,
    Sliders,
    ChevronRight,
    ChevronLeft,
    CheckCircle2,
    RotateCcw,
    Sparkles,
    UserPlus,
    X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useStore } from '@/core/store';
import { AVAILABLE_AGENTS, BOARDROOM_PRIMARY_HEAD_IDS } from '@/modules/boardroom/components/ParticipantSelector';

interface BoardroomRightRailProps {
    onOpenLivingPlans?: () => void;
    onOpenSwarmFeed?: () => void;
    onOpenChange?: (open: boolean) => void;
}

type RailTab = 'resources' | 'presets' | 'feed' | 'plans' | 'team';

export function BoardroomRightRail({ onOpenLivingPlans, onOpenSwarmFeed, onOpenChange }: BoardroomRightRailProps) {
    const [isOpen, setIsOpen] = React.useState(false);
    const [activeTab, setActiveTab] = React.useState<RailTab>('resources');

    const [selectedAgent, setSelectedAgent] = React.useState<string | null>(null);
    const opener = React.useRef<HTMLButtonElement | null>(null);
    const closeButton = React.useRef<HTMLButtonElement>(null);
    const isAgentProcessing = useStore(state => state.isAgentProcessing);
    const workingAgentsKey = useStore(state => {
        if (!state.isAgentProcessing || !state.agentHistory?.length) return '';
        const workingIds = new Set<string>();
        const awaitingIds = new Set<string>();
        for (const message of state.agentHistory) {
            if (!message.isStreaming || !message.agentId || !message.metadata?.boardroomStepId) continue;
            if (message.metadata.boardroomStepStatus === 'awaiting_approval') {
                awaitingIds.add(message.agentId);
            } else {
                workingIds.add(message.agentId);
            }
        }
        return `${Array.from(workingIds).sort().join(',')}|${Array.from(awaitingIds).sort().join(',')}`;
    });
    const pendingHandoffAgentsKey = useStore(state => {
        if (!state.a2aMessages?.length) return '';
        const pendingIds = new Set<string>();
        for (const message of state.a2aMessages) {
            if (message.toAgent && message.requiresApproval && !message.approved) {
                pendingIds.add(message.toAgent);
            }
        }
        return Array.from(pendingIds).sort().join(',');
    });
    const selectedStepIsStreaming = useStore(state => {
        if (!selectedAgent || !state.agentHistory?.length) return false;
        for (let i = state.agentHistory.length - 1; i >= 0; i -= 1) {
            const msg = state.agentHistory[i];
            if (msg.agentId === selectedAgent && msg.metadata?.boardroomStepId) {
                return Boolean(msg.isStreaming);
            }
        }
        return false;
    });
    const selectedStepStatus = useStore(state => {
        if (!selectedAgent || !state.agentHistory?.length) return '';
        for (let i = state.agentHistory.length - 1; i >= 0; i -= 1) {
            const msg = state.agentHistory[i];
            if (msg.agentId === selectedAgent && msg.metadata?.boardroomStepId) {
                return typeof msg.metadata.boardroomStepStatus === 'string' ? msg.metadata.boardroomStepStatus : '';
            }
        }
        return '';
    });
    const selectedStepTask = useStore(state => {
        if (!selectedAgent || !state.agentHistory?.length) return '';
        for (let i = state.agentHistory.length - 1; i >= 0; i -= 1) {
            const msg = state.agentHistory[i];
            if (msg.agentId === selectedAgent && msg.metadata?.boardroomStepId) {
                return typeof msg.metadata.boardroomStepTask === 'string' ? msg.metadata.boardroomStepTask : '';
            }
        }
        return '';
    });
    const selectedStepToolName = useStore(state => {
        if (!selectedAgent || !state.agentHistory?.length) return '';
        for (let i = state.agentHistory.length - 1; i >= 0; i -= 1) {
            const msg = state.agentHistory[i];
            if (msg.agentId === selectedAgent && msg.metadata?.boardroomStepId) {
                return msg.thoughts?.at(-1)?.toolName ?? '';
            }
        }
        return '';
    });
    const selectedHandoffSummary = useStore(state => {
        if (!selectedAgent || !state.a2aMessages?.length) return '';
        for (let i = state.a2aMessages.length - 1; i >= 0; i -= 1) {
            const msg = state.a2aMessages[i];
            if (msg.toAgent === selectedAgent) {
                return `${msg.requiresApproval && !msg.approved ? 'Approval requested' : 'Latest handoff'} from ${msg.fromAgent}`;
            }
        }
        return '';
    });

    const boardroomHostedBrowserActive = useStore(state => Boolean(state.boardroomHostedBrowserActive));
    const requestBoardroomBrowserGrant = useStore(state => state.requestBoardroomBrowserGrant);
    const latestA2AKey = useStore(state => {
        const last = state.a2aMessages?.at(-1);
        return last?.id && last?.toAgent ? `${last.id}:${last.toAgent}` : '';
    });
    const [highlightedAgent, setHighlightedAgent] = React.useState<string | null>(null);
    const prevA2AKeyRef = React.useRef(latestA2AKey);

    React.useEffect(() => {
        if (!latestA2AKey || latestA2AKey === prevA2AKeyRef.current) {
            prevA2AKeyRef.current = latestA2AKey;
            return;
        }
        prevA2AKeyRef.current = latestA2AKey;
        const receiver = latestA2AKey.slice(latestA2AKey.indexOf(':') + 1);
        if (!receiver) return;
        setHighlightedAgent(receiver);
        const timer = window.setTimeout(() => {
            setHighlightedAgent(current => (current === receiver ? null : current));
        }, 2000);
        return () => window.clearTimeout(timer);
    }, [latestA2AKey]);

    React.useEffect(() => {
        onOpenChange?.(isOpen);
        if (isOpen) closeButton.current?.focus();
    }, [isOpen, activeTab, onOpenChange]);

    const close = () => {
        setIsOpen(false);
        opener.current?.focus();
    };

    const activeAgents = useStore(state => state.activeAgents) || [];
    const soloAgent = useStore(state => state.soloAgent);
    const toggleAgent = useStore(state => state.toggleAgent);
    const seatAllDepartmentHeads = useStore(state => state.seatAllDepartmentHeads);
    const referencedAssets = useStore(state => state.referencedAssets) || [];
    const removeReferencedAsset = useStore(state => state.removeReferencedAsset);
    const clearReferencedAssets = useStore(state => state.clearReferencedAssets);

    const handleSeatAll = () => {
        if (seatAllDepartmentHeads) {
            seatAllDepartmentHeads();
        } else {
            useStore.setState({
                activeAgents: ['generalist', ...BOARDROOM_PRIMARY_HEAD_IDS],
            });
        }
    };

    const handleReset = () => {
        if (soloAgent) {
            soloAgent('generalist');
        } else {
            useStore.setState({
                activeAgents: ['generalist'],
            });
        }
    };

    const tabs = [
        { id: 'resources' as const, icon: ShieldCheck, label: 'Standards & Resources' },
        { id: 'presets' as const, icon: Sliders, label: 'Room Presets & Console' },
        { id: 'feed' as const, icon: Bot, label: 'Team Activity' },
        { id: 'plans' as const, icon: Layers, label: 'Living Plans' },
    ];

    const agents = [
        { id: 'generalist', name: 'Conductor', icon: Sparkles, accent: '#6ee7b7' },
        ...AVAILABLE_AGENTS.map(agent => ({
            id: agent.id, name: agent.shortTitle, icon: agent.icon, accent: agent.accent,
        })),
    ];

    return (
        <aside
            data-testid="boardroom-right-rail"
            className="h-full border-l border-white/5 bg-bg-dark/90 backdrop-blur-2xl shrink-0 flex flex-row z-40 shadow-2xl relative"
        >
            {/* Popout Content Panel */}
            <AnimatePresence mode="wait">
                {isOpen && (
                    <motion.div
                        key={activeTab}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ type: 'spring', damping: 25, stiffness: 250 }}
                        className="absolute right-full top-0 h-full w-[min(22rem,calc(100vw-3.5rem))] flex flex-col border-r border-white/10 overflow-hidden bg-bg-dark shadow-2xl"
                        onKeyDown={event => {
                            if (event.key === 'Escape' && !event.defaultPrevented) {
                                event.stopPropagation();
                                close();
                            }
                        }}
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 shrink-0">
                            <span className="text-xs font-bold uppercase tracking-wider text-white/80">
                                {activeTab === 'team' ? agents.find(agent => agent.id === selectedAgent)?.name ?? 'Add agent' : tabs.find(t => t.id === activeTab)?.label}
                            </span>
                            <button
                                type="button"
                                ref={closeButton}
                                onClick={close}
                                className="p-1 hover:bg-white/10 rounded-lg text-white/50 hover:text-white transition-all"
                                aria-label="Close Rail"
                            >
                                <ChevronRight size={15} />
                            </button>
                        </div>

                        {/* Content Body */}
                        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar text-xs text-white/70 space-y-4">
                            {activeTab === 'team' && (
                                selectedAgent ? (
                                    <div className="space-y-3">
                                        <p>{isAgentProcessing && selectedStepIsStreaming
                                            ? selectedStepStatus === 'awaiting_approval' ? 'Awaiting approval' : 'Working on assigned step'
                                            : 'Idle'}</p>
                                        {selectedStepTask && (
                                            <p className="whitespace-pre-wrap break-words">{selectedStepTask}</p>
                                        )}
                                        {selectedStepToolName && (
                                            <p>Latest tool: {selectedStepToolName}</p>
                                        )}
                                        {selectedHandoffSummary && (
                                            <p>{selectedHandoffSummary}</p>
                                        )}
                                        <div className="flex flex-wrap gap-2">
                                            <button
                                                type="button"
                                                className="rounded-lg border border-white/15 px-2.5 py-2 hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-indigo-400"
                                                onClick={() => toggleAgent(selectedAgent)}
                                            >
                                                {activeAgents.includes(selectedAgent) ? 'Unseat agent' : 'Seat agent'}
                                            </button>
                                            <button
                                                type="button"
                                                className="rounded-lg border border-emerald-400/30 bg-emerald-500/15 px-2.5 py-2 text-emerald-200 hover:bg-emerald-500/25 focus-visible:ring-2 focus-visible:ring-emerald-400"
                                                onClick={() => soloAgent(selectedAgent)}
                                            >
                                                Solo
                                            </button>
                                            {boardroomHostedBrowserActive && (
                                                <button
                                                    type="button"
                                                    className="flex items-center gap-1.5 rounded-lg border border-indigo-400/30 bg-indigo-500/15 px-2.5 py-2 text-indigo-200 hover:bg-indigo-500/25 focus-visible:ring-2 focus-visible:ring-indigo-400"
                                                    onClick={() => requestBoardroomBrowserGrant?.(selectedAgent)}
                                                >
                                                    <Globe size={12} aria-hidden="true" />
                                                    <span>Grant browser control</span>
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ) : agents.map(agent => (
                                    <button
                                        key={agent.id}
                                        type="button"
                                        aria-pressed={activeAgents.includes(agent.id)}
                                        onClick={() => toggleAgent(agent.id)}
                                        className="flex w-full items-center justify-between rounded-lg border border-white/10 p-2 hover:bg-white/10"
                                    >
                                        <span>{agent.name}</span>
                                        <span>{activeAgents.includes(agent.id) ? 'Seated' : 'Seat'}</span>
                                    </button>
                                ))
                            )}
                            {/* TAB 1: STANDARDS & RESOURCES */}
                            {activeTab === 'resources' && (
                                <>
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between text-[11px] font-bold text-white uppercase tracking-wider">
                                            <span className="flex items-center gap-1.5 text-rose-400">
                                                <ShieldCheck size={13} />
                                                Boardroom Standards
                                            </span>
                                        </div>
                                        <div className="p-2.5 rounded-xl bg-white/5 border border-white/5 space-y-2 text-[11px]">
                                            <div className="flex items-start gap-1.5">
                                                <CheckCircle2 size={12} className="text-emerald-400 shrink-0 mt-0.5" />
                                                <span><strong>Zero-Placeholder:</strong> Full production code and deliverables every turn.</span>
                                            </div>
                                            <div className="flex items-start gap-1.5">
                                                <CheckCircle2 size={12} className="text-emerald-400 shrink-0 mt-0.5" />
                                                <span><strong>Direct Conductor Handoff:</strong> Strategic cross-department alignment verified before release.</span>
                                            </div>
                                            <div className="flex items-start gap-1.5">
                                                <CheckCircle2 size={12} className="text-emerald-400 shrink-0 mt-0.5" />
                                                <span><strong>Living Memory Sync:</strong> Plans and milestones persisted across project state.</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between text-[11px] font-bold text-white uppercase tracking-wider">
                                            <span>Referenced Assets ({referencedAssets.length})</span>
                                            {referencedAssets.length > 0 && (
                                                <button
                                                    type="button"
                                                    onClick={clearReferencedAssets}
                                                    className="text-[10px] text-rose-400 hover:underline"
                                                >
                                                    Clear All
                                                </button>
                                            )}
                                        </div>
                                        {referencedAssets.length === 0 ? (
                                            <p className="text-[11px] text-white/30 italic p-2 bg-white/5 rounded-lg border border-white/5">
                                                No external audio stems or visual assets currently pinned to the table.
                                            </p>
                                        ) : (
                                            <div className="space-y-1">
                                                {referencedAssets.map((asset) => (
                                                    <div key={asset.id} className="p-2 rounded bg-white/5 border border-white/5 flex items-center justify-between">
                                                        <span className="truncate max-w-[180px]">{asset.name}</span>
                                                        <button
                                                            type="button"
                                                            aria-label={`Remove reference: ${asset.name}`}
                                                            onClick={() => removeReferencedAsset(asset.id)}
                                                            className="shrink-0 rounded p-1.5 text-white/55 hover:bg-white/10 hover:text-white focus-visible:outline focus-visible:outline-2"
                                                        >
                                                            <X size={12} aria-hidden="true" />
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </>
                            )}

                            {/* TAB 2: ROOM PRESETS & CONSOLE */}
                            {activeTab === 'presets' && (
                                <div className="space-y-3">
                                    <p className="text-[11px] text-white/40">
                                        Seat your team, run a one-click session, or focus on one department.
                                    </p>

                                    <button
                                        type="button"
                                        onClick={handleSeatAll}
                                        className="w-full flex items-center justify-between p-3 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/35 border border-indigo-500/40 text-indigo-200 transition-all text-left shadow-md group"
                                    >
                                        <div>
                                            <div className="font-bold flex items-center gap-1.5">
                                                <UserPlus size={13} className="text-indigo-400" />
                                                Seat the Core Team
                                            </div>
                                            <p className="text-[10px] text-white/40 mt-0.5">Seats Orchestrator + all 9 core Department Heads</p>
                                        </div>
                                        <span className="text-xs font-mono text-indigo-400 font-bold">10 Seats</span>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => soloAgent('generalist')}
                                        className="w-full flex items-center justify-between p-3 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-400/30 text-emerald-200 transition-all text-left group"
                                    >
                                        <div>
                                            <div className="font-bold flex items-center gap-1.5">
                                                <Sparkles size={13} className="text-emerald-400" />
                                                Solo indii Conductor
                                            </div>
                                            <p className="text-[10px] text-white/40 mt-0.5">Clear specialists and work 1-on-1 with Orchestrator</p>
                                        </div>
                                        <span className="text-xs font-mono text-emerald-400 font-bold">Solo</span>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={handleReset}
                                        className="w-full flex items-center justify-between p-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/60 hover:text-white transition-all text-left"
                                    >
                                        <div className="flex items-center gap-1.5 font-medium">
                                            <RotateCcw size={12} />
                                            Reset Seating
                                        </div>
                                        <span className="text-[10px] text-white/30 font-mono">Conductor only</span>
                                    </button>

                                    <div className="pt-2 border-t border-white/10">
                                        <span className="text-[10px] font-black uppercase text-white/40 tracking-wider">
                                            Current Seated Roster ({activeAgents.length})
                                        </span>
                                        <div className="mt-2 flex flex-wrap gap-1.5">
                                            {activeAgents.map(id => (
                                                <button
                                                    key={id}
                                                    type="button"
                                                    onClick={() => toggleAgent(id)}
                                                    aria-label={`Remove ${id} from table`}
                                                    className="px-2 py-1 rounded-full bg-white/10 hover:bg-rose-500/20 hover:text-rose-300 text-[10px] font-semibold text-white/80 border border-white/10 cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
                                                    title={`Remove ${id} from table`}
                                                >
                                                    {id} ×
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* TAB 3: SWARM FEED */}
                            {activeTab === 'feed' && (
                                <div className="space-y-3">
                                    <p className="text-[11px] text-white/40">
                                        Real-time stream of inter-agent tasks, capability mapping, and peer delegation.
                                    </p>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            if (onOpenSwarmFeed) onOpenSwarmFeed();
                                        }}
                                        className="w-full py-2 rounded-lg bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 font-semibold border border-indigo-500/30 transition-all text-xs"
                                    >
                                        Open Full Team Activity
                                    </button>
                                </div>
                            )}

                            {/* TAB 4: LIVING PLANS */}
                            {activeTab === 'plans' && (
                                <div className="space-y-3">
                                    <p className="text-[11px] text-white/40">
                                        Active living roadmaps, deliverable trackers, and multi-stage goals your team created.
                                    </p>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            if (onOpenLivingPlans) onOpenLivingPlans();
                                        }}
                                        className="w-full py-2 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 font-semibold border border-cyan-500/30 transition-all text-xs"
                                    >
                                        Open Living Plans Drawer
                                    </button>
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Vertical Icon Rail */}
            <div className="w-14 shrink-0 flex flex-col items-center overflow-y-auto py-3 gap-2 bg-black/60">
                {agents.filter(agent => agent.id === 'generalist' || activeAgents.includes(agent.id)).map(agent => {
                    const [workingRaw, awaitingRaw] = workingAgentsKey.split('|');
                    const working = Boolean(workingRaw && workingRaw.split(',').includes(agent.id));
                    const approval = Boolean(
                        (awaitingRaw && awaitingRaw.split(',').includes(agent.id)) ||
                        (pendingHandoffAgentsKey && pendingHandoffAgentsKey.split(',').includes(agent.id))
                    );
                    const isHighlighted = highlightedAgent === agent.id;
                    const status = approval ? 'Approval requested' : working ? 'Working' : 'Idle';
                    return (
                        <button
                            key={agent.id}
                            type="button"
                            title={`${agent.name} · ${status}`}
                            aria-label={`${agent.name} · ${status}`}
                            aria-expanded={isOpen && activeTab === 'team' && selectedAgent === agent.id}
                            data-handoff-highlight={isHighlighted ? 'true' : undefined}
                            onClick={event => {
                                opener.current = event.currentTarget;
                                setSelectedAgent(agent.id);
                                setActiveTab('team');
                                setIsOpen(true);
                            }}
                            className={cn(
                                "relative shrink-0 rounded-full border border-white/10 bg-white/5 p-2.5 hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-indigo-400 transition-colors",
                                isHighlighted && "motion-safe:ring-2 motion-safe:ring-indigo-400 motion-safe:animate-pulse"
                            )}
                            style={{ color: agent.accent }}
                        >
                            <agent.icon size={16} />
                            {working && <span className="pointer-events-none absolute inset-0 rounded-full ring-1 ring-emerald-400 motion-safe:animate-pulse" />}
                            {approval ? (
                                <span
                                    aria-label="Approval requested"
                                    className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-amber-300 text-black"
                                >
                                    <AlertTriangle size={10} aria-hidden="true" />
                                </span>
                            ) : working ? (
                                <span
                                    aria-label="Working"
                                    className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-400 text-black"
                                >
                                    <Activity size={10} aria-hidden="true" />
                                </span>
                            ) : (
                                <span
                                    aria-label="Idle"
                                    className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-white/20 text-white/80"
                                >
                                    <Clock3 size={10} aria-hidden="true" />
                                </span>
                            )}
                        </button>
                    );
                })}
                <button
                    type="button"
                    title="Add agent"
                    aria-label="Add agent"
                    aria-expanded={isOpen && activeTab === 'team' && !selectedAgent}
                    onClick={event => {
                        opener.current = event.currentTarget;
                        setSelectedAgent(null);
                        setActiveTab('team');
                        setIsOpen(true);
                    }}
                    className="shrink-0 rounded-lg p-2 text-white/60 hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-indigo-400"
                >
                    <UserPlus size={16} />
                </button>
                <button
                    type="button"
                    onClick={event => {
                        opener.current = event.currentTarget;
                        if (isOpen) close();
                        else {
                            setActiveTab('resources');
                            setIsOpen(true);
                        }
                    }}
                    className="p-2 hover:bg-white/10 rounded-xl text-gray-400 hover:text-white transition-colors mb-2"
                    title={isOpen ? 'Collapse Rail' : 'Expand Boardroom Standards & Tools'}
                    aria-label={isOpen ? 'Collapse Rail' : 'Expand Rail'}
                >
                    {isOpen ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
                </button>

                {tabs.map(({ id, icon: Icon, label }) => {
                    const isActive = isOpen && activeTab === id;

                    return (
                        <button
                            key={id}
                            type="button"
                            onClick={event => {
                                opener.current = event.currentTarget;
                                if (isOpen && activeTab === id) {
                                    close();
                                } else {
                                    setActiveTab(id);
                                    setIsOpen(true);
                                }
                            }}
                            className={cn(
                                "p-2.5 rounded-xl transition-all flex items-center justify-center relative group shrink-0",
                                isActive
                                    ? "bg-white/15 text-white shadow-[0_0_15px_rgba(255,255,255,0.2)]"
                                    : "text-gray-400 hover:text-white hover:bg-white/5"
                            )}
                            title={label}
                            aria-label={label}
                        >
                            <Icon size={18} />
                            {isActive && (
                                <div className="absolute inset-0 rounded-xl bg-white/5 blur-sm" />
                            )}
                        </button>
                    );
                })}
            </div>
        </aside>
    );
}
