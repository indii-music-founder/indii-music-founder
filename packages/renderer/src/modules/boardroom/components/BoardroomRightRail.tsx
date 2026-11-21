import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
    ShieldCheck,
    Bot,
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
import { AVAILABLE_AGENTS, BOARDROOM_PRIMARY_HEAD_IDS } from './ParticipantSelector';

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
    const history = useStore(state => state.agentHistory);
    const isAgentProcessing = useStore(state => state.isAgentProcessing);
    const a2aMessages = useStore(state => state.a2aMessages);
    const latestStep = history?.slice().reverse().find(message => message.agentId === selectedAgent && message.metadata?.boardroomStepId);
    const latestHandoff = a2aMessages?.slice().reverse().find(message => message.toAgent === selectedAgent);

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
    const referencedAssets = useStore(state => state.referencedAssets) || [];
    const removeReferencedAsset = useStore(state => state.removeReferencedAsset);
    const clearReferencedAssets = useStore(state => state.clearReferencedAssets);

    const handleSeatAll = () => {
        useStore.setState({
            activeAgents: ['generalist', ...BOARDROOM_PRIMARY_HEAD_IDS],
        });
    };

    const handleReset = () => {
        useStore.setState({
            activeAgents: ['generalist'],
        });
    };

    const tabs = [
        { id: 'resources' as const, icon: ShieldCheck, label: 'Standards & Resources' },
        { id: 'presets' as const, icon: Sliders, label: 'Room Presets & Console' },
        { id: 'feed' as const, icon: Bot, label: 'Swarm Activity Feed' },
        { id: 'plans' as const, icon: Layers, label: 'Living Plans' },
    ];

    const agents = [
        { id: 'generalist', name: 'Conductor', icon: Sparkles, color: 'text-emerald-300' },
        ...AVAILABLE_AGENTS.map(agent => ({
            id: agent.id, name: agent.shortTitle, icon: agent.icon, color: agent.brightText,
        })),
    ];

    return (
        <aside
            data-testid="boardroom-right-rail"
            className="h-full border-l border-white/5 bg-zinc-950/80 backdrop-blur-2xl shrink-0 flex flex-row z-40 shadow-2xl relative"
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
                        className="absolute right-full top-0 h-full w-[min(22rem,calc(100vw-3.5rem))] flex flex-col border-r border-white/10 overflow-hidden bg-zinc-950 shadow-2xl"
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
                                        <p>{isAgentProcessing && latestStep?.isStreaming
                                            ? latestStep.metadata?.boardroomStepStatus === 'awaiting_approval' ? 'Awaiting approval' : 'Working on assigned step'
                                            : 'Idle'}</p>
                                        {typeof latestStep?.metadata?.boardroomStepTask === 'string' && (
                                            <p className="whitespace-pre-wrap break-words">{latestStep.metadata.boardroomStepTask}</p>
                                        )}
                                        {latestStep?.thoughts?.at(-1)?.toolName && (
                                            <p>Latest tool: {latestStep.thoughts.at(-1)?.toolName}</p>
                                        )}
                                        {latestHandoff && (
                                            <p>{latestHandoff.requiresApproval && !latestHandoff.approved ? 'Approval requested' : 'Latest handoff'} from {latestHandoff.fromAgent}</p>
                                        )}
                                        <button
                                            type="button"
                                            className="rounded-lg border border-white/15 p-2 hover:bg-white/10"
                                            onClick={() => toggleAgent(selectedAgent)}
                                        >
                                            {activeAgents.includes(selectedAgent) ? 'Unseat agent' : 'Seat agent'}
                                        </button>
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
                                        Control room seating, execute one-click executive swarms, or isolate departments for 1-on-1 strategy.
                                    </p>

                                    <button
                                        type="button"
                                        onClick={handleSeatAll}
                                        className="w-full flex items-center justify-between p-3 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/35 border border-indigo-500/40 text-indigo-200 transition-all text-left shadow-md group"
                                    >
                                        <div>
                                            <div className="font-bold flex items-center gap-1.5">
                                                <UserPlus size={13} className="text-indigo-400" />
                                                Convene Primary Swarm
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
                                                <span
                                                    key={id}
                                                    onClick={() => toggleAgent(id)}
                                                    className="px-2 py-1 rounded-full bg-white/10 hover:bg-rose-500/20 hover:text-rose-300 text-[10px] font-semibold text-white/80 border border-white/10 cursor-pointer transition-colors"
                                                    title="Click to remove from table"
                                                >
                                                    {id} ×
                                                </span>
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
                                        Open Full Swarm Collaboration Feed
                                    </button>
                                </div>
                            )}

                            {/* TAB 4: LIVING PLANS */}
                            {activeTab === 'plans' && (
                                <div className="space-y-3">
                                    <p className="text-[11px] text-white/40">
                                        Active living roadmaps, deliverable trackers, and multi-stage goals created by the swarm.
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
                    const working = isAgentProcessing && history?.some(message =>
                        message.agentId === agent.id && message.isStreaming && message.metadata?.boardroomStepId);
                    const approval = (isAgentProcessing && history?.some(message =>
                        message.agentId === agent.id && message.isStreaming && message.metadata?.boardroomStepStatus === 'awaiting_approval'))
                        || a2aMessages?.some(message => message.toAgent === agent.id && message.requiresApproval && !message.approved);
                    const status = approval ? 'Approval requested' : working ? 'Working' : 'Idle';
                    return (
                        <button
                            key={agent.id}
                            type="button"
                            title={`${agent.name} · ${status}`}
                            aria-label={`${agent.name} · ${status}`}
                            aria-expanded={isOpen && activeTab === 'team' && selectedAgent === agent.id}
                            onClick={event => {
                                opener.current = event.currentTarget;
                                setSelectedAgent(agent.id);
                                setActiveTab('team');
                                setIsOpen(true);
                            }}
                            className={cn("relative shrink-0 rounded-full border border-white/10 bg-white/5 p-2.5 hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-indigo-400", agent.color)}
                        >
                            <agent.icon size={16} />
                            {working && <span className="pointer-events-none absolute inset-0 rounded-full ring-1 ring-emerald-400 motion-safe:animate-pulse" />}
                            {approval && <span aria-hidden="true" className="absolute -right-1 -top-1 rounded-full bg-amber-300 px-1 text-[10px] font-bold text-black">!</span>}
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
