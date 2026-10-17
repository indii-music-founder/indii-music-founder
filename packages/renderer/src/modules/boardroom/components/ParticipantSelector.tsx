import React from 'react';
import { motion, PanInfo } from 'motion/react';
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
    type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { resolveAgentVisualIdentity } from '@/services/agent/AgentVisualIdentity';

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
 * (departments.ts / AgentModePicker) without cluttering the table perimeter.
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

const COMPACT_BREAKPOINT = 760;
const COMPACT_HEIGHT_BREAKPOINT = 540;

/**
 * Deterministic, bounded geometry calculator preserved for layout contract tests.
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
    const { activeAgents, toggleAgent, activeGraphExecution } = useStore(
        useShallow(state => ({
            activeAgents: state.activeAgents,
            toggleAgent: state.toggleAgent,
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

    const handleDragEnd = (event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo, agentId: string, isActive: boolean) => {
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

    return (
        <div
            ref={containerRef}
            className="absolute inset-0 pointer-events-none"
            data-layout-rings="1"
        >
            <TooltipProvider delayDuration={50}>
                {AVAILABLE_AGENTS.map((agent, index) => {
                    const isActive = activeAgents.includes(agent.id);
                    const isExecuting = isAgentExecuting(agent.id);
                    const identity = resolveAgentVisualIdentity(agent.id);
                    const total = AVAILABLE_AGENTS.length;
                    const angle = (index / total) * Math.PI * 2;

                    // Active agents sit closer to the center of the table
                    const radiusX = isActive ? 36 : 48;
                    const radiusY = isActive ? 26 : 38;

                    const left = 50 + radiusX * Math.cos(angle);
                    const top = 50 + radiusY * Math.sin(angle);

                    const IconComponent = agent.icon;

                    return (
                        <Tooltip key={agent.id}>
                            <TooltipTrigger asChild>
                                <motion.button
                                    data-testid={`boardroom-seat-${agent.id}`}
                                    data-agent-id={agent.id}
                                    data-agent-role={identity.role}
                                    data-agent-accent={identity.accent}
                                    data-agent-icon={identity.iconKey}
                                    data-seat-ring="0"
                                    aria-label={`${agent.fullName}, ${isExecuting ? 'executing workflow' : isActive ? 'active' : 'inactive'}`}
                                    aria-pressed={isActive}
                                    type="button"
                                    onClick={() => toggleAgent(agent.id)}
                                    drag
                                    dragSnapToOrigin
                                    onDragEnd={(e, info) => handleDragEnd(e, info, agent.id, isActive)}
                                    initial={{ left: `${left}%`, top: `${top}%` }}
                                    animate={{ left: `${left}%`, top: `${top}%` }}
                                    transition={{ type: 'spring', stiffness: 150, damping: 20 }}
                                    className={cn(
                                        // Pill-shaped container with clear readable title
                                        "absolute -translate-x-1/2 -translate-y-1/2 px-3.5 py-1.5 rounded-full flex items-center gap-2 border transition-all duration-300 pointer-events-auto cursor-grab active:cursor-grabbing backdrop-blur-md select-none",
                                        isExecuting
                                            ? "animate-pulse border-emerald-400/80 shadow-[0_0_30px_rgba(52,211,153,0.75)] scale-105 bg-emerald-500/25 z-20"
                                            : isActive
                                                ? `${agent.brightBg} ${agent.brightBorder} ${agent.brightGlow} z-20`
                                                : "bg-[#12161f]/90 border-white/10 opacity-75 hover:opacity-100 hover:scale-105 z-10 shadow-md"
                                    )}
                                    whileHover={{ scale: isExecuting ? 1.06 : isActive ? 1.06 : 1.12 }}
                                    whileTap={{ scale: 0.95 }}
                                >
                                    {/* Department Icon */}
                                    <IconComponent
                                        size={15}
                                        aria-hidden="true"
                                        className={cn(
                                            "shrink-0 transition-colors duration-300",
                                            isExecuting
                                                ? "text-emerald-400"
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
                                                ? "text-emerald-300 font-bold"
                                                : isActive
                                                    ? "text-white font-bold"
                                                    : "text-white/80"
                                        )}
                                    >
                                        {agent.shortTitle}
                                    </span>

                                    {/* Active / Executing pulse dot */}
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
                                                    isExecuting ? "bg-emerald-400" : agent.dotColor
                                                )}
                                            />
                                        </span>
                                    )}
                                </motion.button>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="bg-[#1a1a1a] text-white border border-white/10 px-3 py-2 font-medium tracking-wide z-[100]">
                                <p className="text-white text-xs">
                                    <span className="font-bold">{agent.fullName}</span>
                                    <span className="opacity-70 ml-1.5">
                                        {isExecuting
                                            ? "(Executing workflow...)"
                                            : isActive
                                                ? "(Active • Click to remove)"
                                                : "(Click or drag to seat)"}
                                    </span>
                                </p>
                            </TooltipContent>
                        </Tooltip>
                    );
                })}
            </TooltipProvider>
        </div>
    );
}
