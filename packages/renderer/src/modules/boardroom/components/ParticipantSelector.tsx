import React from 'react';
import { motion, PanInfo, AnimatePresence } from 'motion/react';
import { useStore } from '@/core/store';
import { useShallow } from 'zustand/react/shallow';
import { ChevronRight, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { resolveAgentVisualIdentity } from '@/services/agent/AgentVisualIdentity';
import { DEPARTMENTS, getDepartmentOf, listHeadIds } from '@/services/agent/departments';
import { AGENT_ICONS } from '../constants/agentIcons';

export interface AgentOrbitalConfig {
    readonly id: string;
    readonly shortTitle: string;
    readonly fullName: string;
    readonly icon: LucideIcon;
    readonly accent: string;
    readonly surface: string;
    readonly border: string;
    readonly glow: string;
    readonly foreground: string;
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

const PRIMARY_SHORT_TITLES: Readonly<Record<(typeof BOARDROOM_PRIMARY_HEAD_IDS)[number], { shortTitle: string; fullName: string }>> = {
    marketing: { shortTitle: 'Marketing', fullName: 'Marketing Department' },
    finance: { shortTitle: 'Finance', fullName: 'Finance Department' },
    legal: { shortTitle: 'Legal', fullName: 'Legal Department' },
    brand: { shortTitle: 'Brand', fullName: 'Brand Strategy' },
    creative: { shortTitle: 'Creative', fullName: 'Creative Direction' },
    video: { shortTitle: 'Video', fullName: 'Video Production' },
    social: { shortTitle: 'Social', fullName: 'Social Media' },
    publishing: { shortTitle: 'Publishing', fullName: 'Music Publishing' },
    music: { shortTitle: 'Music', fullName: 'Sonic Director' },
};

export const AVAILABLE_AGENTS: readonly AgentOrbitalConfig[] = Object.freeze(
    BOARDROOM_PRIMARY_HEAD_IDS.map((id) => {
        const identity = resolveAgentVisualIdentity(id);
        const titles = PRIMARY_SHORT_TITLES[id];
        return {
            id,
            shortTitle: titles.shortTitle,
            fullName: titles.fullName,
            icon: AGENT_ICONS[identity.iconKey],
            accent: identity.accent,
            surface: identity.surface,
            border: identity.border,
            glow: identity.glow,
            foreground: identity.foreground,
        };
    }),
);

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
    const [tableSize, setTableSize] = React.useState({ width: 0, height: 0 });
    const {
        activeAgents,
        toggleAgent,
        soloAgent,
        focusedHeadId,
        setFocusedHeadId,
        activeGraphExecution,
        conversationMode,
        activeDepartmentId,
        setConversationMode,
        setActiveDepartmentId,
        isAgentOpen,
        toggleAgentWindow,
    } = useStore(
        useShallow(state => ({
            activeAgents: state.activeAgents,
            toggleAgent: state.toggleAgent,
            soloAgent: state.soloAgent,
            focusedHeadId: state.focusedHeadId,
            setFocusedHeadId: state.setFocusedHeadId,
            activeGraphExecution: state.activeGraphExecution,
            conversationMode: state.conversationMode,
            activeDepartmentId: state.activeDepartmentId,
            setConversationMode: state.setConversationMode,
            setActiveDepartmentId: state.setActiveDepartmentId,
            isAgentOpen: state.isAgentOpen,
            toggleAgentWindow: state.toggleAgentWindow,
        }))
    );

    React.useLayoutEffect(() => {
        const table = containerRef.current;
        if (!table) return;
        const measure = () => {
            const { width, height } = table.getBoundingClientRect();
            setTableSize(previous =>
                previous.width === width && previous.height === height ? previous : { width, height }
            );
        };
        measure();
        if (typeof ResizeObserver === 'undefined') return;
        const observer = new ResizeObserver(measure);
        observer.observe(table);
        return () => observer.disconnect();
    }, []);

    const extraHeadIds = listHeadIds().filter(id => !AVAILABLE_AGENTS.some(agent => agent.id === id));
    const seatedExtraIds = extraHeadIds.filter(id => activeAgents.includes(id));
    const denseSeatIds = [...AVAILABLE_AGENTS.map(agent => agent.id), ...seatedExtraIds];
    const denseLayout = seatedExtraIds.length > 0 && tableSize.width >= 480 && tableSize.height >= 360
        ? calculateParticipantSeatLayout(denseSeatIds.length, tableSize.width, tableSize.height)
        : null;

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

    const renderWorkerButton = (workerId: string) => {
        const workerIdentity = resolveAgentVisualIdentity(workerId);
        const department = getDepartmentOf(workerId);
        const isDepartmentOpen = conversationMode === 'department' &&
            activeDepartmentId === department?.id;
        const isWorkerExecuting = executingAgentIds.includes(workerId);

        return (
            <button
                key={workerId}
                type="button"
                onClick={() => {
                    if (!department) return;
                    setActiveDepartmentId(department.id);
                    setConversationMode('department');
                    if (!isAgentOpen) toggleAgentWindow();
                }}
                aria-label={`Open ${department?.displayName ?? 'department'} department for ${workerIdentity.displayName}`}
                aria-pressed={isDepartmentOpen}
                title={`Open ${department?.displayName ?? 'department'} department to work with its specialists`}
                data-testid={`boardroom-worker-${workerId}`}
                className={cn(
                    "flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left text-xs transition-colors border",
                    isWorkerExecuting
                        ? "bg-emerald-500/20 border-emerald-400 text-emerald-300 font-bold motion-safe:animate-pulse"
                        : isDepartmentOpen
                            ? "bg-white/15 border-white/30 text-white font-semibold"
                            : "bg-white/5 border-white/5 text-white/70 hover:bg-white/10 hover:text-white"
                )}
            >
                <span className="truncate pr-2">
                    {workerIdentity.displayName}
                </span>
                <span className={cn(
                    "w-1.5 h-1.5 rounded-full shrink-0",
                    isDepartmentOpen ? "bg-emerald-400" : "bg-white/20"
                )} />
            </button>
        );
    };

    return (
        <div
            ref={containerRef}
            className="absolute inset-0 pointer-events-none"
            data-layout-rings={denseLayout?.ringCounts.length ?? 1}
            onClick={() => focusedHeadId && setFocusedHeadId(null)}
        >
            <TooltipProvider delayDuration={50}>
                {denseLayout && denseSeatIds.map((id, index) => {
                    const seat = denseLayout.seats[index];
                    if (!seat) return null;
                    const identity = resolveAgentVisualIdentity(id);
                    const isActive = activeAgents.includes(id);
                    const isExecuting = isAgentExecuting(id);
                    return (
                        <Tooltip key={id}>
                            <TooltipTrigger asChild>
                                <motion.button
                                    type="button"
                                    data-testid={`boardroom-seat-${id}`}
                                    data-agent-id={id}
                                    data-seat-ring={seat.ring}
                                    aria-label={identity.displayName}
                                    aria-pressed={isActive}
                                    onClick={event => handleBadgeClick(event, id)}
                                    drag
                                    dragSnapToOrigin
                                    onDragEnd={(event, info) => handleDragEnd(event, info, id, isActive)}
                                    className={cn(
                                        'pointer-events-auto absolute z-20 grid -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border bg-bg-dark text-xs font-bold focus-visible:outline focus-visible:outline-2 focus-visible:outline-white',
                                        isExecuting && 'motion-safe:animate-pulse ring-2 ring-emerald-400',
                                    )}
                                    style={{
                                        left: seat.x,
                                        top: seat.y,
                                        width: denseLayout.seatDiameter,
                                        height: denseLayout.seatDiameter,
                                        backgroundColor: isActive ? identity.surface : undefined,
                                        borderColor: isActive ? identity.accent : identity.border,
                                        color: isActive ? identity.accent : identity.foreground,
                                    }}
                                >
                                    {identity.initials}
                                </motion.button>
                            </TooltipTrigger>
                            <TooltipContent>{identity.displayName}</TooltipContent>
                        </Tooltip>
                    );
                })}
                {!denseLayout && AVAILABLE_AGENTS.map((agent, index) => {
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
                                        drag
                                        dragSnapToOrigin
                                        onDragEnd={(e, info) => handleDragEnd(e, info, agent.id, isActive)}
                                        initial={{ left: `${left}%`, top: `${top}%` }}
                                        animate={{ left: `${left}%`, top: `${top}%` }}
                                        transition={{ type: 'spring', stiffness: 150, damping: 20 }}
                                        className={cn(
                                            "absolute -translate-x-1/2 -translate-y-1/2 px-2 py-1 rounded-full flex items-center gap-1 border transition-colors duration-300 pointer-events-auto cursor-grab active:cursor-grabbing backdrop-blur-md select-none group",
                                            isExecuting
                                                ? "motion-safe:animate-pulse border-emerald-300 shadow-[0_0_40px_rgba(52,211,153,0.9),0_0_80px_rgba(52,211,153,0.5)] scale-110 bg-emerald-500/40 z-30 ring-2 ring-emerald-400 ring-offset-2 ring-offset-black"
                                                : isActive
                                                    ? "z-20 shadow-lg"
                                                    : "bg-bg-dark/90 border-white/10 opacity-80 hover:opacity-100 hover:scale-105 z-10 shadow-md",
                                            isSoloed && "ring-2 ring-amber-400 ring-offset-1 ring-offset-black"
                                        )}
                                        style={isActive && !isExecuting ? {
                                            backgroundColor: identity.surface,
                                            borderColor: identity.border,
                                            boxShadow: `0 0 20px ${identity.glow}`,
                                        } : undefined}
                                        whileHover={{ scale: isExecuting ? 1.08 : isActive ? 1.06 : 1.1 }}
                                        whileTap={{ scale: 0.95 }}
                                    >
                                        {isExecuting && (
                                            <>
                                                <span className="absolute -inset-2 rounded-full border border-emerald-400 motion-safe:animate-ping opacity-60 pointer-events-none" />
                                                <span className="absolute -inset-4 rounded-full border border-emerald-400/40 motion-safe:animate-pulse pointer-events-none" />
                                            </>
                                        )}

                                        <button
                                            type="button"
                                            data-testid={`boardroom-seat-${agent.id}`}
                                            data-agent-id={agent.id}
                                            data-agent-role={identity.role}
                                            data-agent-accent={identity.accent}
                                            data-agent-icon={identity.iconKey}
                                            data-seat-ring="0"
                                            aria-label={`${agent.fullName}, ${isExecuting ? 'executing workflow' : isActive ? 'active' : 'inactive'}`}
                                            aria-pressed={isActive}
                                            onClick={(e) => handleBadgeClick(e, agent.id)}
                                            className="flex items-center gap-1.5 rounded-full px-1 py-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                                        >
                                            <IconComponent
                                                size={14}
                                                aria-hidden="true"
                                                className={cn(
                                                    "shrink-0 transition-colors duration-300",
                                                    isExecuting && "text-emerald-300 motion-safe:animate-bounce"
                                                )}
                                                style={!isExecuting ? { color: isActive ? identity.accent : identity.foreground } : undefined}
                                            />

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

                                            {(isActive || isExecuting) && (
                                                <span className="relative flex h-2 w-2 shrink-0">
                                                    <span
                                                        className={cn(
                                                            "motion-safe:animate-ping absolute inline-flex h-full w-full rounded-full opacity-75",
                                                            isExecuting && "bg-emerald-400"
                                                        )}
                                                        style={!isExecuting ? { backgroundColor: identity.accent } : undefined}
                                                    />
                                                    <span
                                                        className={cn(
                                                            "relative inline-flex rounded-full h-2 w-2",
                                                            isExecuting && "bg-emerald-400 shadow-[0_0_8px_#34d399]"
                                                        )}
                                                        style={!isExecuting ? { backgroundColor: identity.accent } : undefined}
                                                    />
                                                </span>
                                            )}
                                        </button>

                                        {/* Mixing Console Solo Toggle Button */}
                                        <button
                                            type="button"
                                            onClick={() => soloAgent(agent.id)}
                                            className={cn(
                                                "text-[10px] font-black uppercase px-1 rounded transition-colors ml-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300",
                                                isSoloed
                                                    ? "bg-amber-400 text-black font-extrabold shadow-xs"
                                                    : "bg-white/10 text-white/50 hover:bg-amber-400 hover:text-black opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100"
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
                                                onClick={() => setFocusedHeadId(isFocused ? null : agent.id)}
                                                className={cn(
                                                    "p-0.5 rounded-full hover:bg-white/20 transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white",
                                                    isFocused && "rotate-90 text-white"
                                                )}
                                                title={`View ${agent.shortTitle} worker hierarchy`}
                                                aria-label={`Expand ${agent.shortTitle} sub-agents`}
                                            >
                                                <ChevronRight size={11} className={isFocused ? "text-white" : "text-white/40"} />
                                            </button>
                                        )}
                                    </motion.div>
                                </TooltipTrigger>
                                <TooltipContent side="top" className="bg-surface text-white border border-white/10 px-3 py-2 font-medium tracking-wide">
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
                                            <span className="text-[10px] font-black uppercase tracking-wider text-white/50">
                                                {agent.shortTitle} Hierarchy
                                            </span>
                                            <span className="text-[10px] font-mono text-white/30">
                                                {workerIds.length} sub-agents
                                            </span>
                                        </div>

                                        {workerIds.map(renderWorkerButton)}
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </React.Fragment>
                    );
                })}
            </TooltipProvider>
            <details
                className="absolute inset-x-0 bottom-0 z-40 text-xs text-white"
                onClick={event => event.stopPropagation()}
            >
                <summary className="pointer-events-auto w-fit cursor-pointer rounded-md border border-white/15 bg-bg-dark px-2 py-1.5 focus-visible:outline focus-visible:outline-2">
                    Departments{seatedExtraIds.length > 0 && !denseLayout ? ` (+${seatedExtraIds.length} seated)` : ''}
                </summary>
                <div role="group" aria-label="Department seats" className="pointer-events-auto absolute bottom-full left-0 mb-1 max-h-[min(50vh,18rem)] w-52 max-w-full overflow-y-auto rounded-md border border-white/15 bg-bg-dark p-1 shadow-xl">
                    {listHeadIds().map(id => {
                        const identity = resolveAgentVisualIdentity(id);
                        const isActive = activeAgents.includes(id);
                        const workerIds = DEPARTMENTS[id]?.workerIds ?? [];
                        return (
                            <div key={id}>
                                <div className="flex items-center gap-1">
                                    <button
                                        type="button"
                                        aria-pressed={isActive}
                                        onClick={event => handleBadgeClick(event, id)}
                                        className="min-w-0 flex-1 rounded px-2 py-2 text-left hover:bg-white/10 aria-pressed:bg-white/15"
                                    >
                                        {identity.displayName}
                                    </button>
                                    <button
                                        type="button"
                                        aria-label={`Solo ${identity.displayName}`}
                                        onClick={() => soloAgent(id)}
                                        className="rounded px-2 py-2 text-white/70 hover:bg-white/10"
                                    >
                                        Solo
                                    </button>
                                </div>
                                {denseLayout && workerIds.length > 0 && (
                                    <details className="mb-1 pl-2">
                                        <summary className="cursor-pointer py-1 text-white/70">
                                            {DEPARTMENTS[id]?.displayName} sub-agents
                                        </summary>
                                        <div className="grid gap-1 pb-1">
                                            {workerIds.map(renderWorkerButton)}
                                        </div>
                                    </details>
                                )}
                            </div>
                        );
                    })}
                </div>
            </details>
        </div>
    );
}
