import React from 'react';
import { motion, PanInfo } from 'framer-motion';
import { useStore } from '@/core/store';
import { useShallow } from 'zustand/react/shallow';
import { Briefcase, Target, Scale, DollarSign, Palette, Film, Share2, Library } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { AnimatePresence } from 'framer-motion';
import { DEPARTMENTS } from '@/services/agent/departments';

const AVAILABLE_AGENTS = [
    { id: 'marketing', name: 'Marketing Dept.', icon: Target, color: 'text-rose-400', glow: 'shadow-[0_0_25px_rgba(244,63,94,0.6)]', bg: 'bg-rose-500/20' },
    { id: 'finance', name: 'Finance Dept.', icon: DollarSign, color: 'text-emerald-400', glow: 'shadow-[0_0_25px_rgba(52,211,153,0.6)]', bg: 'bg-emerald-500/20' },
    { id: 'legal', name: 'Legal Dept.', icon: Scale, color: 'text-amber-400', glow: 'shadow-[0_0_25px_rgba(251,191,36,0.6)]', bg: 'bg-amber-500/20' },
    { id: 'brand', name: 'Brand Manager', icon: Briefcase, color: 'text-fuchsia-400', glow: 'shadow-[0_0_25px_rgba(192,132,252,0.6)]', bg: 'bg-fuchsia-500/20' },
    { id: 'creative', name: 'Creative Director', icon: Palette, color: 'text-purple-400', glow: 'shadow-[0_0_25px_rgba(168,85,247,0.6)]', bg: 'bg-purple-500/20' },
    { id: 'video', name: 'Video Producer', icon: Film, color: 'text-sky-400', glow: 'shadow-[0_0_25px_rgba(56,189,248,0.6)]', bg: 'bg-sky-500/20' },
    { id: 'social', name: 'Social Media', icon: Share2, color: 'text-blue-400', glow: 'shadow-[0_0_25px_rgba(96,165,250,0.6)]', bg: 'bg-blue-500/20' },
    { id: 'publishing', name: 'Publishing', icon: Library, color: 'text-orange-400', glow: 'shadow-[0_0_25px_rgba(251,146,60,0.6)]', bg: 'bg-orange-500/20' }
];

export default function ParticipantSelector() {
    const { activeAgents, toggleAgent, activeGraphExecution } = useStore(
        useShallow(state => ({
            activeAgents: state.activeAgents,
            toggleAgent: state.toggleAgent,
            activeGraphExecution: state.activeGraphExecution
        }))
    );

    const [focusedHead, setFocusedHead] = React.useState<string | null>(null);

    const executingAgentIds = React.useMemo(() => {
        if (!activeGraphExecution || !activeGraphExecution.nodeStates) return [];
        
        const executingIds: string[] = [];
        const graphNodes = activeGraphExecution.graph?.nodes || [];
        
        Object.entries(activeGraphExecution.nodeStates).forEach(([nodeId, state]) => {
            if (state.status === 'executing') {
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
        <div className="absolute inset-0 pointer-events-none">
            <TooltipProvider delayDuration={50}>
                {AVAILABLE_AGENTS.map((agent, index) => {
                    const isActive = activeAgents.includes(agent.id);
                    const isExecuting = isAgentExecuting(agent.id);
                    const total = AVAILABLE_AGENTS.length;
                    const angle = (index / total) * Math.PI * 2;

                    // Active agents sit closer to the center of the table
                    const radiusX = isActive ? 35 : 48;
                    const radiusY = isActive ? 25 : 38;

                    const left = 50 + radiusX * Math.cos(angle);
                    const top = 50 + radiusY * Math.sin(angle);

                    return (
                        // @ts-expect-error - React.Fragment accepts key but this TS version's types are strict
                        <React.Fragment key={agent.id}>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                <motion.button
                                    onClick={() => {
                                        if (isActive) {
                                            setFocusedHead(prev => prev === agent.id ? null : agent.id);
                                        } else {
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
                                        "absolute w-14 h-14 -ml-7 -mt-7 rounded-full flex items-center justify-center border transition-all duration-500 pointer-events-auto cursor-grab active:cursor-grabbing",
                                        isExecuting
                                            ? "animate-pulse border-emerald-400/80 shadow-[0_0_35px_rgba(52,211,153,0.8)] scale-105 bg-emerald-500/20 z-20"
                                            : isActive
                                                ? `${agent.bg} border-white/30 ${agent.glow} z-20`
                                                : "bg-[#161b22] border-white/5 opacity-40 hover:opacity-100 hover:scale-105 z-10"
                                    )}
                                    whileHover={{ scale: isExecuting ? 1.05 : isActive ? 1.05 : 1.15 }}
                                    whileTap={{ scale: 0.95 }}
                                >
                                    <agent.icon size={22} className={cn(
                                        "transition-all duration-500",
                                        isExecuting
                                            ? "text-emerald-400"
                                            : isActive
                                                ? agent.color
                                                : "text-gray-500"
                                    )} />

                                    {/* Active "speaking" or "listening" ripple indicator */}
                                    {isActive && !isExecuting && (
                                        <div className={cn("absolute inset-0 rounded-full animate-ping opacity-30 pointer-events-none", agent.bg)} />
                                    )}
                                    
                                    {/* Swarm Executing double ripple / ping effects */}
                                    {isExecuting && (
                                        <>
                                            <div className="absolute inset-0 rounded-full animate-ping opacity-50 border border-emerald-400/60 pointer-events-none scale-110" />
                                            <div className="absolute inset-0 rounded-full animate-ping opacity-25 border border-emerald-400/40 pointer-events-none scale-125 [animation-delay:0.3s]" />
                                        </>
                                    )}

                                    {/* Glassmorphic Text Label Underneath */}
                                    <span className={cn(
                                        "absolute top-full mt-2.5 left-1/2 -translate-x-1/2 whitespace-nowrap text-[9px] font-semibold tracking-wider uppercase bg-black/60 backdrop-blur-md px-2 py-0.5 rounded border pointer-events-none transition-all duration-500 shadow-lg",
                                        isExecuting
                                            ? "text-emerald-400 border-emerald-400/30 font-extrabold shadow-[0_0_10px_rgba(52,211,153,0.15)]"
                                            : isActive
                                                ? "text-white border-white/10 font-bold"
                                                : "text-white/30 border-white/5 opacity-60"
                                    )}>
                                        {agent.name.replace(' Dept.', '').replace(' Manager', '').replace(' Producer', '').replace(' Director', '')}
                                    </span>
                                </motion.button>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="bg-[#1a1a1a] text-white border border-white/10 px-3 py-2 font-medium tracking-wide z-[100]">
                                <p className="text-white text-xs">
                                    <span className="font-bold">{agent.name}</span>
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
                            const radiusX = 18;
                            const radiusY = 12;
                            const left = 50 + radiusX * Math.cos(angle);
                            const top = 50 + radiusY * Math.sin(angle);
                            
                            const headConfig = AVAILABLE_AGENTS.find(a => a.id === focusedHead);
                            const isWorkerExecuting = executingAgentIds.includes(workerId);

                            return (
                                <motion.div
                                    key={workerId}
                                    initial={{ opacity: 0, scale: 0.5, left: '50%', top: '50%' }}
                                    animate={{ opacity: 1, scale: 1, left: `${left}%`, top: `${top}%` }}
                                    exit={{ opacity: 0, scale: 0.5, left: '50%', top: '50%' }}
                                    transition={{ type: 'spring', stiffness: 200, damping: 25 }}
                                    className={cn(
                                        "absolute w-12 h-12 -ml-6 -mt-6 rounded-full flex flex-col items-center justify-center border transition-all duration-500 z-30 pointer-events-auto",
                                        isWorkerExecuting
                                            ? "border-emerald-400/80 shadow-[0_0_25px_rgba(52,211,153,0.8)] scale-105 animate-pulse bg-emerald-500/20"
                                            : cn(headConfig?.bg || "bg-indigo-500/20", "border-white/20 shadow-[0_0_15px_rgba(255,255,255,0.1)] backdrop-blur-md")
                                    )}
                                    title={workerId}
                                >
                                    <span className={cn(
                                        "text-[9px] font-bold uppercase tracking-widest",
                                        isWorkerExecuting ? "text-emerald-400" : headConfig?.color || "text-white/70"
                                    )}>
                                        Worker
                                    </span>
                                    <span className="text-[10px] text-white/90 truncate max-w-[40px]">
                                        {workerId.split('.')[1]}
                                    </span>
                                    
                                    {/* Executing sub-worker double ripple / ping effects */}
                                    {isWorkerExecuting && (
                                        <>
                                            <div className="absolute inset-0 rounded-full animate-ping opacity-50 border border-emerald-400/60 pointer-events-none scale-110" />
                                            <div className="absolute inset-0 rounded-full animate-ping opacity-25 border border-emerald-400/40 pointer-events-none scale-125 [animation-delay:0.3s]" />
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
