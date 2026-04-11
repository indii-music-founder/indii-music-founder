import React from 'react';
import { motion, PanInfo } from 'framer-motion';
import { useStore } from '@/core/store';
import { useShallow } from 'zustand/react/shallow';
import { Briefcase, Target, Scale, DollarSign, Palette, Film, Share2, Library } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

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
    const { activeAgents, toggleAgent } = useStore(
        useShallow(state => ({
            activeAgents: state.activeAgents,
            toggleAgent: state.toggleAgent
        }))
    );

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
            {AVAILABLE_AGENTS.map((agent, index) => {
                const isActive = activeAgents.includes(agent.id);
                const total = AVAILABLE_AGENTS.length;
                const angle = (index / total) * Math.PI * 2;

                // Active agents sit closer to the center of the table
                const radiusX = isActive ? 35 : 48;
                const radiusY = isActive ? 25 : 38;

                const left = 50 + radiusX * Math.cos(angle);
                const top = 50 + radiusY * Math.sin(angle);

                return (
                    <TooltipProvider key={agent.id} delayDuration={50}>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <motion.button
                                    onClick={() => toggleAgent(agent.id)}
                                    drag
                                    dragSnapToOrigin
                                    onDragEnd={(e, info) => handleDragEnd(e, info, agent.id, isActive)}
                                    initial={{ left: `${left}%`, top: `${top}%` }}
                                    animate={{ left: `${left}%`, top: `${top}%` }}
                                    transition={{ type: 'spring', stiffness: 150, damping: 20 }}
                                    className={cn(
                                        "absolute w-14 h-14 -ml-7 -mt-7 rounded-full flex items-center justify-center border transition-all duration-500 pointer-events-auto cursor-grab active:cursor-grabbing",
                                        isActive
                                            ? `${agent.bg} border-white/30 ${agent.glow} z-20`
                                            : "bg-[#161b22] border-white/5 opacity-40 hover:opacity-100 hover:scale-105 z-10"
                                    )}
                                    whileHover={{ scale: isActive ? 1.05 : 1.15 }}
                                    whileTap={{ scale: 0.95 }}
                                >
                                    <agent.icon size={22} className={cn(
                                        "transition-all duration-500",
                                        isActive ? agent.color : "text-gray-500"
                                    )} />

                                    {/* Active "speaking" or "listening" ripple indicator */}
                                    {isActive && (
                                        <div className={cn("absolute inset-0 rounded-full animate-ping opacity-30 pointer-events-none", agent.bg)} />
                                    )}
                                </motion.button>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="bg-[#1a1a1a] text-white border border-white/10 px-3 py-2 font-medium tracking-wide z-[100]">
                                <p className="text-white text-xs">
                                    <span className="font-bold">{agent.name}</span>
                                    <span className="opacity-70 ml-1">
                                        {isActive ? "(Active)" : "(Drag into table to activate)"}
                                    </span>
                                </p>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                );
            })}
        </div>
    );
}
