import React from 'react';
import { motion, PanInfo, AnimatePresence } from 'motion/react';
import { useStore } from '@/core/store';
import { useShallow } from 'zustand/react/shallow';
import {
    Briefcase,
    Target,
    Scale,
    DollarSign,
    Palette,
    Film,
    Share2,
    Library,
    Headphones,
    ChevronRight,
    Headphones as MusicIcon,
    type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { resolveAgentVisualIdentity } from '@/services/agent/AgentVisualIdentity';
import { DEPARTMENTS, getDepartmentOf } from '@/services/agent/departments';

export interface AgentOrbitalConfig {
    readonly id: string;
    readonly shortTitle: string;
    readonly fullName: string;
    readonly icon: LucideIcon;
    readonly brightText: string;
    readonly brightBg: string;
    readonly brightBorder: string;
    readonly brightGlow: string;
    readonly dotColor: string;
}

/**
 * Core executive Department Heads seated around the Boardroom table.
 * Sub-agents and worker specialists remain in the department hierarchy
 * and expand outward via the satellite popout when a head is inspected.
 */
export const BOARDROOM_PRIMARY_HEAD_IDS = [
    'marketing',
    'finance',
    'legal',
    'brand',
    'creative',
    'video',
    'social',
    'publishing',
    'music',
] as const;

export const AVAILABLE_AGENTS: readonly AgentOrbitalConfig[] = Object.freeze([
    {
        id: 'marketing',
        shortTitle: 'Marketing',
        fullName: 'Marketing Department',
        icon: Target,
        brightText: 'text-rose-400',
        brightBg: 'bg-rose-500/25',
        brightBorder: 'border-rose-400/60',
        brightGlow: 'shadow-[0_0_20px_rgba(244,63,94,0.45)]',
        dotColor: 'bg-rose-400',
    },
    {
        id: 'finance',
        shortTitle: 'Finance',
        fullName: 'Finance Department',
        icon: DollarSign,
        brightText: 'text-emerald-400',
        brightBg: 'bg-emerald-500/25',
        brightBorder: 'border-emerald-400/60',
        brightGlow: 'shadow-[0_0_20px_rgba(52,211,153,0.45)]',
        dotColor: 'bg-emerald-400',
    },
    {
        id: 'legal',
        shortTitle: 'Legal',
        fullName: 'Legal Department',
        icon: Scale,
        brightText: 'text-amber-400',
        brightBg: 'bg-amber-500/25',
        brightBorder: 'border-amber-400/60',
        brightGlow: 'shadow-[0_0_20px_rgba(251,191,36,0.45)]',
        dotColor: 'bg-amber-400',
    },
    {
        id: 'brand',
        shortTitle: 'Brand',
        fullName: 'Brand Strategy',
        icon: Briefcase,
        brightText: 'text-fuchsia-400',
        brightBg: 'bg-fuchsia-500/25',
        brightBorder: 'border-fuchsia-400/60',
        brightGlow: 'shadow-[0_0_20px_rgba(192,132,252,0.45)]',
        dotColor: 'bg-fuchsia-400',
    },
    {
        id: 'creative',
        shortTitle: 'Creative',
        fullName: 'Creative Direction',
        icon: Palette,
        brightText: 'text-purple-400',
        brightBg: 'bg-purple-500/25',
        brightBorder: 'border-purple-400/60',
        brightGlow: 'shadow-[0_0_20px_rgba(168,85,247,0.45)]',
        dotColor: 'bg-purple-400',
    },
    {
        id: 'video',
        shortTitle: 'Video',
        fullName: 'Video Production',
        icon: Film,
        brightText: 'text-sky-400',
        brightBg: 'bg-sky-500/25',
        brightBorder: 'border-sky-400/60',
        brightGlow: 'shadow-[0_0_20px_rgba(56,189,248,0.45)]',
        dotColor: 'bg-sky-400',
    },
    {
        id: 'social',
        shortTitle: 'Social',
        fullName: 'Social Media',
        icon: Share2,
        brightText: 'text-cyan-400',
        brightBg: 'bg-cyan-500/25',
        brightBorder: 'border-cyan-400/60',
        brightGlow: 'shadow-[0_0_20px_rgba(0,188,212,0.45)]',
        dotColor: 'bg-cyan-400',
    },
    {
        id: 'publishing',
        shortTitle: 'Publishing',
        fullName: 'Music Publishing',
        icon: Library,
        brightText: 'text-orange-400',
        brightBg: 'bg-orange-500/25',
        brightBorder: 'border-orange-400/60',
        brightGlow: 'shadow-[0_0_20px_rgba(251,146,60,0.45)]',
        dotColor: 'bg-orange-400',
    },
    {
        id: 'music',
        shortTitle: 'Music',
        fullName: 'Sonic Director',
        icon: Headphones,
        brightText: 'text-teal-400',
        brightBg: 'bg-teal-500/25',
        brightBorder: 'border-teal-400/60',
        brightGlow: 'shadow-[0_0_20px_rgba(45,212,191,0.45)]',
        dotColor: 'bg-teal-400',
    },
]);

export type ParticipantLayoutMode = 'compact' | 'wide';

export interface ParticipantSeatPosition {
    readonly index: number;
    readonly ring: number;
    readonly x: number;
    readonly y: number;
}

export interface ParticipantSeatLayout {
    readonly mode: ParticipantLayoutMode;
    readonly width: number;
    readonly height: number;
    readonly seatDiameter: number;
    readonly ringCounts: readonly number[];
    readonly centerClearance: number;
    readonly seats: readonly ParticipantSeatPosition[];
}

export function calculateParticipantSeatLayout(
    totalHeads: number,
    viewportWidth: number,
    viewportHeight: number,
): ParticipantSeatLayout {
    const width = Math.max(320, viewportWidth);
    const height = Math.max(240, viewportHeight);
    const mode: ParticipantLayoutMode = width >= 860 && height >= 560 ? 'wide' : 'compact';
    const seatDiameter = mode === 'compact' ? 34 : 44;
    const count = Math.max(1, totalHeads);

    const ringCapacities = count <= 9 ? [count] : mode === 'compact' ? [6, 8, 9] : [9, 14];
    const ringScales = ringCapacities.length === 1 ? [1] : mode === 'compact' ? [0.5, 0.74, 1] : [0.64, 1];
    const ringCounts: number[] = [];
    let remaining = Math.max(0, Math.floor(count));

    for (const capacity of ringCapacities) {
        const ringCount = Math.min(remaining, capacity);
        if (ringCount > 0) ringCounts.push(ringCount);
        remaining -= ringCount;
    }
    if (remaining > 0) {
        ringCounts[ringCounts.length - 1] =
            (ringCounts[ringCounts.length - 1] ?? 0) + remaining;
    }

    const centerX = width / 2;
    const centerY = height / 2;
    const edgePadding = seatDiameter / 2 + 10;
    const outerRadiusX = Math.max(seatDiameter * 2.5, centerX - edgePadding);
    const outerRadiusY = Math.max(seatDiameter * 2.5, centerY - edgePadding);
    const seats: ParticipantSeatPosition[] = [];
    let seatIndex = 0;

    ringCounts.forEach((ringCount, ring) => {
        const scale = ringScales[ring] ?? 1;
        const radiusX = outerRadiusX * scale;
        const radiusY = outerRadiusY * scale;
        const stagger = ring === 0 ? 0 : Math.PI / ringCount;

        for (let position = 0; position < ringCount; position += 1) {
            const angle = -Math.PI / 2 + stagger + (position / ringCount) * Math.PI * 2;
            seats.push(Object.freeze({
                index: seatIndex,
                ring,
                x: Math.round((centerX + radiusX * Math.cos(angle)) * 100) / 100,
                y: Math.round((centerY + radiusY * Math.sin(angle)) * 100) / 100,
            }));
            seatIndex += 1;
        }
    });

    const centerClearance = seats.length === 0
        ? Math.min(centerX, centerY)
        : Math.min(...seats.map(seat =>
            Math.hypot(seat.x - centerX, seat.y - centerY) - seatDiameter / 2
        ));

    return Object.freeze({
        mode,
        width,
        height,
        seatDiameter,
        ringCounts: Object.freeze(ringCounts),
        centerClearance: Math.round(centerClearance * 100) / 100,
        seats: Object.freeze(seats),
    });
}

export default function ParticipantSelector() {
    const containerRef = React.useRef<HTMLDivElement>(null);
    const {
        activeAgents,
        toggleAgent,
        soloAgent,
        focusedHeadId,
        setFocusedHeadId,
        activeGraphExecution,
    } = useStore(
        useShallow(state => ({
            activeAgents: state.activeAgents,
            toggleAgent: state.toggleAgent,
            soloAgent: state.soloAgent,
            focusedHeadId: state.focusedHeadId,
            setFocusedHeadId: state.setFocusedHeadId,
            activeGraphExecution: state.activeGraphExecution,
        }))
    );

    const executingAgentIds = React.useMemo(() => {
        if (!activeGraphExecution || !activeGraphExecution.nodeStates) return [];

        const executingIds: string[] = [];
        const graphNodes = activeGraphExecution.graph?.nodes || [];

        Object.entries(activeGraphExecution.nodeStates).forEach(([nodeId, state]) => {
            if (state.status === 'EXECUTING_GENERATION') {
                const node = graphNodes.find(n => n.id === nodeId);
                if (node?.agentId) {
                    executingIds.push(node.agentId);
                }
            }
        });

        return executingIds;
    }, [activeGraphExecution]);

    const isAgentExecuting = React.useCallback((agentId: string) => {
        return executingAgentIds.some(
            execId => execId === agentId || execId.startsWith(`${agentId}.`)
        );
    }, [executingAgentIds]);

    const handleDragEnd = (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo, agentId: string, isActive: boolean) => {
        let cx = window.innerWidth / 2;
        let cy = window.innerHeight / 2;
        let threshold = 350;

        if (containerRef.current) {
            const rect = containerRef.current.getBoundingClientRect();
            cx = rect.left + rect.width / 2;
            cy = rect.top + rect.height / 2;
            threshold = Math.min(rect.width, rect.height) * 0.42;
        }

        const dist = Math.hypot(info.point.x - cx, info.point.y - cy);

        if (dist < threshold && !isActive) {
            toggleAgent(agentId); // Dragged in
        } else if (dist > threshold && isActive) {
            toggleAgent(agentId); // Dragged out
        }
    };

    const handleBadgeClick = (e: React.MouseEvent, agentId: string) => {
        // Option/Alt click triggers instant solo mode
        if (e.altKey) {
            e.stopPropagation();
            soloAgent(agentId);
            return;
        }
        toggleAgent(agentId);
    };

    return (
        <div
            ref={containerRef}
            className="absolute inset-0 pointer-events-none"
            data-layout-rings="1"
            onClick={() => focusedHeadId && setFocusedHeadId(null)}
        >
            <TooltipProvider delayDuration={50}>
                {AVAILABLE_AGENTS.map((agent, index) => {
                    const isActive = activeAgents.includes(agent.id);
                    const isExecuting = isAgentExecuting(agent.id);
                    const isSoloed = activeAgents.length === 1 && activeAgents[0] === agent.id;
                    const identity = resolveAgentVisualIdentity(agent.id);
                    const total = AVAILABLE_AGENTS.length;
                    const angle = (index / total) * Math.PI * 2;

                    // Active agents sit closer to the center of the table
                    const radiusX = isActive ? 36 : 48;
                    const radiusY = isActive ? 26 : 38;

                    const left = 50 + radiusX * Math.cos(angle);
                    const top = 50 + radiusY * Math.sin(angle);

                    const IconComponent = agent.icon;
                    const department = DEPARTMENTS[agent.id];
                    const workerIds = department?.workerIds || [];
                    const isFocused = focusedHeadId === agent.id;

                    return (
                        <React.Fragment key={agent.id}>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <motion.div
                                        data-testid={`boardroom-seat-${agent.id}`}
                                        data-agent-id={agent.id}
                                        data-agent-role={identity.role}
                                        data-agent-accent={identity.accent}
                                        data-agent-icon={identity.iconKey}
                                        data-seat-ring="0"
                                        aria-label={`${agent.fullName}, ${isExecuting ? 'executing workflow' : isActive ? 'active' : 'inactive'}`}
                                        aria-pressed={isActive}
                                        role="button"
                                        tabIndex={0}
                                        onClick={(e) => handleBadgeClick(e, agent.id)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' || e.key === ' ') {
                                                e.preventDefault();
                                                toggleAgent(agent.id);
                                            }
                                        }}
                                        drag
                                        dragSnapToOrigin
                                        onDragEnd={(e, info) => handleDragEnd(e, info, agent.id, isActive)}
                                        initial={{ left: `${left}%`, top: `${top}%` }}
                                        animate={{ left: `${left}%`, top: `${top}%` }}
                                        transition={{ type: 'spring', stiffness: 150, damping: 20 }}
                                        className={cn(
                                            // Pill-shaped container with clear readable title
                                            "absolute -translate-x-1/2 -translate-y-1/2 px-3 py-1.5 rounded-full flex items-center gap-1.5 border transition-all duration-300 pointer-events-auto cursor-grab active:cursor-grabbing backdrop-blur-md select-none group",
                                            // High-Visibility Active Studio Strobe / Pulse Beacon
                                            isExecuting
                                                ? "animate-pulse border-emerald-300 shadow-[0_0_40px_rgba(52,211,153,0.9),0_0_80px_rgba(52,211,153,0.5)] scale-110 bg-emerald-500/40 z-30 ring-2 ring-emerald-400 ring-offset-2 ring-offset-black"
                                                : isActive
                                                    ? `${agent.brightBg} ${agent.brightBorder} ${agent.brightGlow} z-20 shadow-lg`
                                                    : "bg-[#12161f]/90 border-white/10 opacity-75 hover:opacity-100 hover:scale-105 z-10 shadow-md",
                                            isSoloed && "ring-2 ring-amber-400 ring-offset-1 ring-offset-black"
                                        )}
                                        whileHover={{ scale: isExecuting ? 1.08 : isActive ? 1.06 : 1.1 }}
                                        whileTap={{ scale: 0.95 }}
                                    >
                                        {/* High-visibility executing ripple halo rings */}
                                        {isExecuting && (
                                            <>
                                                <span className="absolute -inset-2 rounded-full border border-emerald-400 animate-ping opacity-60 pointer-events-none" />
                                                <span className="absolute -inset-4 rounded-full border border-emerald-400/40 animate-pulse pointer-events-none" />
                                            </>
                                        )}

                                        {/* Department Icon */}
                                        <IconComponent
                                            size={14}
                                            aria-hidden="true"
                                            className={cn(
                                                "shrink-0 transition-colors duration-300",
                                                isExecuting
                                                    ? "text-emerald-300 animate-bounce"
                                                    : isActive
                                                        ? agent.brightText
                                                        : "text-white/60"
                                            )}
                                        />

                                        {/* Clear, readable shortened title */}
                                        <span
                                            className={cn(
                                                "text-xs font-semibold tracking-wide whitespace-nowrap",
                                                isExecuting
                                                    ? "text-emerald-200 font-black tracking-wider"
                                                    : isActive
                                                        ? "text-white font-bold"
                                                        : "text-white/80"
                                            )}
                                        >
                                            {agent.shortTitle}
                                        </span>

                                        {/* Mixing Console Solo Toggle Button */}
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                soloAgent(agent.id);
                                            }}
                                            className={cn(
                                                "text-[9px] font-black uppercase px-1 rounded transition-all ml-0.5",
                                                isSoloed
                                                    ? "bg-amber-400 text-black font-extrabold shadow-xs"
                                                    : "bg-white/10 text-white/50 hover:bg-amber-400 hover:text-black opacity-0 group-hover:opacity-100"
                                            )}
                                            title={`Solo ${agent.shortTitle} (mutes others)`}
                                            aria-label={`Solo ${agent.shortTitle}`}
                                        >
                                            S
                                        </button>

                                        {/* Satellite Hierarchy expander trigger (if department has workers) */}
                                        {workerIds.length > 0 && (
                                            <button
                                                type="button"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setFocusedHeadId(isFocused ? null : agent.id);
                                                }}
                                                className={cn(
                                                    "p-0.5 rounded-full hover:bg-white/20 transition-transform",
                                                    isFocused && "rotate-90 text-white"
                                                )}
                                                title={`View ${agent.shortTitle} worker hierarchy`}
                                                aria-label={`Expand ${agent.shortTitle} sub-agents`}
                                            >
                                                <ChevronRight size={11} className={isFocused ? "text-white" : "text-white/40"} />
                                            </button>
                                        )}

                                        {/* Active / Executing pulse dot beacon */}
                                        {(isActive || isExecuting) && (
                                            <span className="relative flex h-2 w-2 shrink-0">
                                                <span
                                                    className={cn(
                                                        "animate-ping absolute inline-flex h-full w-full rounded-full opacity-75",
                                                        isExecuting ? "bg-emerald-400" : agent.dotColor
                                                    )}
                                                />
                                                <span
                                                    className={cn(
                                                        "relative inline-flex rounded-full h-2 w-2",
                                                        isExecuting ? "bg-emerald-400 shadow-[0_0_8px_#34d399]" : agent.dotColor
                                                    )}
                                                />
                                            </span>
                                        )}
                                    </motion.div>
                                </TooltipTrigger>
                                <TooltipContent side="top" className="bg-[#1a1a1a] text-white border border-white/10 px-3 py-2 font-medium tracking-wide z-[100]">
                                    <p className="text-white text-xs">
                                        <span className="font-bold">{agent.fullName}</span>
                                        <span className="opacity-70 ml-1.5">
                                            {isExecuting
                                                ? "(Executing workflow...)"
                                                : isSoloed
                                                    ? "(Solo Mode • Active)"
                                                    : isActive
                                                        ? "(Active • Click to remove)"
                                                        : "(Click to seat • Option+Click to Solo)"}
                                        </span>
                                    </p>
                                    {workerIds.length > 0 && (
                                        <p className="text-[10px] text-white/40 mt-0.5">
                                            Sub-agents: {workerIds.map(w => resolveAgentVisualIdentity(w).displayName).join(', ')}
                                        </p>
                                    )}
                                </TooltipContent>
                            </Tooltip>

                            {/* Concept 1: Satellite Hierarchy Branch Popout */}
                            <AnimatePresence>
                                {isFocused && workerIds.length > 0 && (
                                    <motion.div
                                        initial={{ opacity: 0, scale: 0.8 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        exit={{ opacity: 0, scale: 0.8 }}
                                        transition={{ type: 'spring', damping: 20, stiffness: 300 }}
                                        className="absolute z-40 flex flex-col gap-1.5 p-2 rounded-xl bg-black/80 backdrop-blur-xl border border-white/15 shadow-2xl pointer-events-auto min-w-[140px]"
                                        style={{
                                            left: `${Math.min(85, Math.max(15, left + (left > 50 ? 6 : -6)))}%`,
                                            top: `${Math.min(85, Math.max(15, top + (top > 50 ? 5 : -5)))}%`,
                                        }}
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        <div className="flex items-center justify-between pb-1 border-b border-white/10 px-1">
                                            <span className="text-[9px] font-black uppercase tracking-wider text-white/50">
                                                {agent.shortTitle} Hierarchy
                                            </span>
                                            <span className="text-[9px] font-mono text-white/30">
                                                {workerIds.length} sub-agents
                                            </span>
                                        </div>

                                        {workerIds.map((workerId) => {
                                            const workerIdentity = resolveAgentVisualIdentity(workerId);
                                            const isWorkerActive = activeAgents.includes(workerId);
                                            const isWorkerExecuting = executingAgentIds.includes(workerId);

                                            return (
                                                <button
                                                    key={workerId}
                                                    type="button"
                                                    onClick={() => toggleAgent(workerId)}
                                                    className={cn(
                                                        "flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left text-xs transition-all border",
                                                        isWorkerExecuting
                                                            ? "bg-emerald-500/20 border-emerald-400 text-emerald-300 font-bold animate-pulse"
                                                            : isWorkerActive
                                                                ? "bg-white/15 border-white/30 text-white font-semibold"
                                                                : "bg-white/5 border-white/5 text-white/70 hover:bg-white/10 hover:text-white"
                                                    )}
                                                >
                                                    <span className="truncate pr-2">
                                                        {workerIdentity.displayName}
                                                    </span>
                                                    <span className={cn(
                                                        "w-1.5 h-1.5 rounded-full shrink-0",
                                                        isWorkerActive ? "bg-emerald-400" : "bg-white/20"
                                                    )} />
                                                </button>
                                            );
                                        })}
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </React.Fragment>
                    );
                })}
            </TooltipProvider>
        </div>
    );
}
