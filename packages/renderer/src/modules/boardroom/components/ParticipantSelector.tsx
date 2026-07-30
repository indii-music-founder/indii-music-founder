import React from 'react';
import { motion, PanInfo } from 'motion/react';
import { useStore } from '@/core/store';
import { useShallow } from 'zustand/react/shallow';
import {
    Bot,
    BriefcaseBusiness,
    Calculator,
    CalendarDays,
    Camera,
    Clapperboard,
    CloudCog,
    GraduationCap,
    Handshake,
    Landmark,
    Library,
    LockKeyhole,
    Megaphone,
    Music2,
    Palette,
    PenLine,
    Route,
    Scale,
    Share2,
    ShieldCheck,
    Sparkles,
    Utensils,
    Video,
    type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { AnimatePresence } from 'motion/react';
import { DEPARTMENTS, listHeadIds } from '@/services/agent/departments';
import {
    resolveAgentVisualIdentity,
    type AgentVisualIconKey,
} from '@/services/agent/AgentVisualIdentity';

const AGENT_ICONS: Readonly<Record<AgentVisualIconKey, LucideIcon>> = Object.freeze({
    bot: Bot,
    'briefcase-business': BriefcaseBusiness,
    calculator: Calculator,
    'calendar-days': CalendarDays,
    camera: Camera,
    clapperboard: Clapperboard,
    'cloud-cog': CloudCog,
    'graduation-cap': GraduationCap,
    handshake: Handshake,
    landmark: Landmark,
    library: Library,
    'lock-keyhole': LockKeyhole,
    megaphone: Megaphone,
    'music-2': Music2,
    palette: Palette,
    'pen-line': PenLine,
    route: Route,
    scale: Scale,
    'share-2': Share2,
    'shield-check': ShieldCheck,
    sparkles: Sparkles,
    utensils: Utensils,
    video: Video,
});

const AVAILABLE_AGENTS = listHeadIds().map(agentId => resolveAgentVisualIdentity(agentId));

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

const COMPACT_BREAKPOINT = 760;
const COMPACT_HEIGHT_BREAKPOINT = 540;
const DEFAULT_LAYOUT_WIDTH = 960;
const DEFAULT_LAYOUT_HEIGHT = 640;

/**
 * Deterministic, bounded geometry for the complete canonical head roster.
 * Compact layouts use three rings to preserve spacing; wide layouts use two.
 * Coordinates are measured against the selector container, never the viewport.
 */
// eslint-disable-next-line react-refresh/only-export-components -- exported for deterministic geometry contract tests
export function calculateParticipantSeatLayout(
    count: number,
    requestedWidth: number,
    requestedHeight: number,
): ParticipantSeatLayout {
    const width = Math.max(320, Math.round(requestedWidth));
    const height = Math.max(280, Math.round(requestedHeight));
    const mode: ParticipantLayoutMode =
        width < COMPACT_BREAKPOINT || height < COMPACT_HEIGHT_BREAKPOINT
            ? 'compact'
            : 'wide';
    const seatDiameter = mode === 'compact' ? 34 : 44;
    const ringCapacities = mode === 'compact' ? [6, 8, 9] : [9, 14];
    const ringScales = mode === 'compact' ? [0.5, 0.74, 1] : [0.64, 1];
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
    const { activeAgents, toggleAgent, activeGraphExecution } = useStore(
        useShallow(state => ({
            activeAgents: state.activeAgents,
            toggleAgent: state.toggleAgent,
            activeGraphExecution: state.activeGraphExecution
        }))
    );

    const [focusedHead, setFocusedHead] = React.useState<string | null>(null);
    const containerRef = React.useRef<HTMLDivElement>(null);
    const [containerSize, setContainerSize] = React.useState({
        width: DEFAULT_LAYOUT_WIDTH,
        height: DEFAULT_LAYOUT_HEIGHT,
    });

    React.useLayoutEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const updateSize = () => {
            const bounds = container.getBoundingClientRect();
            if (bounds.width <= 0 || bounds.height <= 0) return;
            const nextSize = {
                width: Math.round(bounds.width),
                height: Math.round(bounds.height),
            };
            setContainerSize(current =>
                current.width === nextSize.width && current.height === nextSize.height
                    ? current
                    : nextSize
            );
        };

        updateSize();
        const observer = new ResizeObserver(updateSize);
        observer.observe(container);
        return () => observer.disconnect();
    }, []);

    const participantLayout = React.useMemo(
        () => calculateParticipantSeatLayout(
            AVAILABLE_AGENTS.length,
            containerSize.width,
            containerSize.height,
        ),
        [containerSize.height, containerSize.width],
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

    const handleDragEnd = (event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo, agentId: string, isActive: boolean) => {
        // Center of viewport
        const cx = window.innerWidth / 2;
        const cy = window.innerHeight / 2;

        // Distance from drop point to center
        const dist = Math.hypot(info.point.x - cx, info.point.y - cy);

        // Threshold (roughly the edge of the oval)
        const THRESHOLD = 350;

        if (dist < THRESHOLD && !isActive) {
            toggleAgent(agentId); // Dragged in
        } else if (dist > THRESHOLD && isActive) {
            toggleAgent(agentId); // Dragged out
        }
    };

    return (
        <div
            ref={containerRef}
            className="absolute inset-0 pointer-events-none"
            data-layout-mode={participantLayout.mode}
            data-layout-rings={participantLayout.ringCounts.length}
        >
            <TooltipProvider delayDuration={50}>
                {AVAILABLE_AGENTS.map((identity, index) => {
                    const isActive = activeAgents.includes(identity.agentId);
                    const isExecuting = isAgentExecuting(identity.agentId);
                    const seat = participantLayout.seats[index]!;
                    const isFocused = focusedHead === identity.agentId;
                    const AgentIcon = AGENT_ICONS[identity.iconKey];
                    const iconSize = participantLayout.mode === 'compact' ? 13 : 16;
                    const labelWidth = participantLayout.mode === 'compact' ? 80 : 112;

                    return (
                        <React.Fragment key={identity.agentId}>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                <motion.button
                                    data-testid={`boardroom-seat-${identity.agentId}`}
                                    data-agent-id={identity.agentId}
                                    data-agent-role={identity.role}
                                    data-agent-accent={identity.accent}
                                    data-agent-icon={identity.iconKey}
                                    data-seat-ring={seat.ring}
                                    aria-label={`${identity.ariaLabel}, ${isExecuting ? 'executing workflow' : isActive ? 'active' : 'inactive'}`}
                                    aria-pressed={isActive}
                                    type="button"
                                    onClick={() => {
                                        if (isActive) {
                                            setFocusedHead(prev => prev === identity.agentId ? null : identity.agentId);
                                        } else {
                                            toggleAgent(identity.agentId);
                                        }
                                    }}
                                    drag
                                    dragSnapToOrigin
                                    onDragEnd={(e, info) => handleDragEnd(e, info, identity.agentId, isActive)}
                                    initial={{ left: seat.x, top: seat.y }}
                                    animate={{ left: seat.x, top: seat.y }}
                                    transition={{ type: 'spring', stiffness: 150, damping: 20 }}
                                    className={cn(
                                        "group absolute rounded-full flex flex-col items-center justify-center border transition-all duration-500 pointer-events-auto cursor-grab active:cursor-grabbing focus-visible:outline-2 focus-visible:outline-offset-2",
                                        isExecuting
                                            ? "animate-pulse scale-105 z-20"
                                            : isActive
                                                ? "z-20"
                                                : "hover:scale-105 z-10"
                                    )}
                                    style={{
                                        ...identity.cssProperties,
                                        width: participantLayout.seatDiameter,
                                        height: participantLayout.seatDiameter,
                                        marginLeft: -participantLayout.seatDiameter / 2,
                                        marginTop: -participantLayout.seatDiameter / 2,
                                        backgroundColor: identity.surface,
                                        borderColor: identity.border,
                                        color: identity.foreground,
                                        outlineColor: identity.accent,
                                        boxShadow: isActive || isExecuting ? `0 0 ${isExecuting ? 35 : 25}px ${identity.glow}` : 'none',
                                    } as React.CSSProperties}
                                    whileHover={{ scale: isExecuting ? 1.05 : isActive ? 1.05 : 1.15 }}
                                    whileTap={{ scale: 0.95 }}
                                >
                                    <AgentIcon
                                        size={iconSize}
                                        aria-hidden="true"
                                        className="transition-all duration-500"
                                        style={{ color: identity.accent }}
                                    />
                                    <span className="text-[7px] font-black leading-none mt-0.5" style={{ color: identity.foreground }}>
                                        {identity.initials}
                                    </span>

                                    {/* Active "speaking" or "listening" ripple indicator */}
                                    {isActive && !isExecuting && (
                                        <div
                                            className="absolute inset-0 rounded-full animate-ping opacity-30 pointer-events-none border"
                                            style={{ borderColor: identity.accent }}
                                        />
                                    )}
                                    
                                    {/* Swarm Executing double ripple / ping effects */}
                                    {isExecuting && (
                                        <>
                                            <div className="absolute inset-0 rounded-full animate-ping opacity-50 border pointer-events-none scale-110" style={{ borderColor: identity.accent }} />
                                            <div className="absolute inset-0 rounded-full animate-ping opacity-25 border pointer-events-none scale-125 [animation-delay:0.3s]" style={{ borderColor: identity.accent }} />
                                        </>
                                    )}

                                    {/* One bounded label may be pinned; all others reveal on hover/focus. */}
                                    <span
                                        className={cn(
                                            "absolute top-full mt-1 left-1/2 -translate-x-1/2 truncate text-[8px] font-bold tracking-wider uppercase bg-black/85 backdrop-blur-md px-1.5 py-0.5 rounded border pointer-events-none transition-opacity duration-150 shadow-lg",
                                            isFocused
                                                ? "opacity-100"
                                                : "opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100"
                                        )}
                                        style={{
                                            width: labelWidth,
                                            maxWidth: labelWidth,
                                            color: identity.foreground,
                                            borderColor: identity.border,
                                        }}
                                    >
                                        {identity.displayName}
                                    </span>
                                </motion.button>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="bg-[#1a1a1a] text-white border border-white/10 px-3 py-2 font-medium tracking-wide z-[100]">
                                <p className="text-white text-xs">
                                    <span className="font-bold">{identity.displayName}</span>
                                    <span className="opacity-70 ml-1">
                                        {isExecuting
                                            ? "(Executing workflow...)"
                                            : isActive
                                                ? "(Active)"
                                                : "(Drag into table to activate)"}
                                    </span>
                                </p>
                            </TooltipContent>
                        </Tooltip>
                        </React.Fragment>
                    );
                })}
            </TooltipProvider>

            {/* Inner Orbit for Workers */}
            <AnimatePresence>
                {focusedHead && (DEPARTMENTS[focusedHead]?.workerIds?.length ?? 0) > 0 && (
                    <>
                        {DEPARTMENTS[focusedHead]!.workerIds!.map((workerId, index) => {
                            const total = DEPARTMENTS[focusedHead]!.workerIds!.length;
                            const angle = (index / Math.max(total, 1)) * Math.PI * 2;
                            const radiusX = participantLayout.mode === 'compact' ? 16 : 18;
                            const radiusY = participantLayout.mode === 'compact' ? 10 : 12;
                            const left = 50 + radiusX * Math.cos(angle);
                            const top = 50 + radiusY * Math.sin(angle);
                            
                            const identity = resolveAgentVisualIdentity(workerId);
                            const WorkerIcon = AGENT_ICONS[identity.iconKey];
                            const isWorkerExecuting = executingAgentIds.includes(workerId);
                            const workerDiameter = participantLayout.mode === 'compact' ? 38 : 44;

                            return (
                                <motion.div
                                    key={workerId}
                                    initial={{ opacity: 0, scale: 0.5, left: '50%', top: '50%' }}
                                    animate={{ opacity: 1, scale: 1, left: `${left}%`, top: `${top}%` }}
                                    exit={{ opacity: 0, scale: 0.5, left: '50%', top: '50%' }}
                                    transition={{ type: 'spring', stiffness: 200, damping: 25 }}
                                    className={cn(
                                        "absolute rounded-full flex flex-col items-center justify-center border transition-all duration-500 z-30 pointer-events-auto",
                                        isWorkerExecuting && "scale-105 animate-pulse",
                                        "backdrop-blur-md"
                                    )}
                                    style={{
                                        ...identity.cssProperties,
                                        width: workerDiameter,
                                        height: workerDiameter,
                                        marginLeft: -workerDiameter / 2,
                                        marginTop: -workerDiameter / 2,
                                        backgroundColor: identity.surface,
                                        borderColor: identity.border,
                                        boxShadow: `0 0 ${isWorkerExecuting ? 25 : 15}px ${identity.glow}`,
                                        color: identity.foreground,
                                    } as React.CSSProperties}
                                    title={identity.ariaLabel}
                                    aria-label={identity.ariaLabel}
                                    data-agent-id={identity.agentId}
                                    data-agent-role={identity.role}
                                    data-agent-accent={identity.accent}
                                    data-agent-icon={identity.iconKey}
                                >
                                    <WorkerIcon size={13} aria-hidden="true" style={{ color: identity.accent }} />
                                    <span className="text-[8px] font-black leading-none mt-0.5">
                                        {identity.initials}
                                    </span>
                                    <span className="sr-only">{identity.displayName}</span>
                                    
                                    {/* Executing sub-worker double ripple / ping effects */}
                                    {isWorkerExecuting && (
                                        <>
                                            <div className="absolute inset-0 rounded-full animate-ping opacity-50 border pointer-events-none scale-110" style={{ borderColor: identity.accent }} />
                                            <div className="absolute inset-0 rounded-full animate-ping opacity-25 border pointer-events-none scale-125 [animation-delay:0.3s]" style={{ borderColor: identity.accent }} />
                                        </>
                                    )}
                                </motion.div>
                            );
                        })}
                    </>
                )}
            </AnimatePresence>
        </div>
    );
}
