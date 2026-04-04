import React from 'react';
import { motion } from 'framer-motion';
import { useStore } from '@/core/store';
import { useShallow } from 'zustand/react/shallow';
import { Briefcase, Target, Scale, DollarSign, Palette, Film, Share2, Library, Shield } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

const AVAILABLE_AGENTS = [
    { id: 'marketing', name: 'Marketing Dept.', icon: Target, color: 'text-rose-400', glow: 'shadow-[0_0_15px_rgba(244,63,94,0.6)]', bg: 'bg-rose-500/20' },
    { id: 'finance', name: 'Finance Dept.', icon: DollarSign, color: 'text-emerald-400', glow: 'shadow-[0_0_15px_rgba(52,211,153,0.6)]', bg: 'bg-emerald-500/20' },
    { id: 'legal', name: 'Legal Dept.', icon: Scale, color: 'text-amber-400', glow: 'shadow-[0_0_15px_rgba(251,191,36,0.6)]', bg: 'bg-amber-500/20' },
    { id: 'brand', name: 'Brand Manager', icon: Briefcase, color: 'text-fuchsia-400', glow: 'shadow-[0_0_15px_rgba(192,132,252,0.6)]', bg: 'bg-fuchsia-500/20' },
    { id: 'creative', name: 'Creative Director', icon: Palette, color: 'text-purple-400', glow: 'shadow-[0_0_15px_rgba(168,85,247,0.6)]', bg: 'bg-purple-500/20' },
    { id: 'video', name: 'Video Producer', icon: Film, color: 'text-sky-400', glow: 'shadow-[0_0_15px_rgba(56,189,248,0.6)]', bg: 'bg-sky-500/20' },
    { id: 'social', name: 'Social Media', icon: Share2, color: 'text-blue-400', glow: 'shadow-[0_0_15px_rgba(96,165,250,0.6)]', bg: 'bg-blue-500/20' },
    { id: 'publishing', name: 'Publishing', icon: Library, color: 'text-orange-400', glow: 'shadow-[0_0_15px_rgba(251,146,60,0.6)]', bg: 'bg-orange-500/20' }
];

export default function ParticipantSelector() {
    const { activeAgents, toggleAgent } = useStore(
        useShallow(state => ({
            activeAgents: state.activeAgents,
            toggleAgent: state.toggleAgent
        }))
    );

    return (
        <div className="absolute inset-0 pointer-events-none">
            {AVAILABLE_AGENTS.map((agent, index) => {
                const isActive = activeAgents.includes(agent.id);
                // Math to place them around an oval
                // Oval bounds roughly: center is (50%, 50%), radiusX is 40% to 50%, radiusY is 30% to 40%
                const total = AVAILABLE_AGENTS.length;
                // Offset the starting angle so the first agent is at the top or distributed nicely
                const angle = (index / total) * Math.PI * 2;

                // Elliptical distribution
                const radiusX = 48; // roughly the radius in % Width
                const radiusY = 38; // roughly the radius in % Height

                const left = 50 + radiusX * Math.cos(angle);
                const top = 50 + radiusY * Math.sin(angle);

                return (
                    <TooltipProvider key={agent.id} delayDuration={50}>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <motion.button
                                    onClick={() => toggleAgent(agent.id)}
                                    className={cn(
                                        "absolute w-12 h-12 -ml-6 -mt-6 rounded-full flex items-center justify-center border transition-all duration-300 pointer-events-auto",
                                        isActive
                                            ? `${agent.bg} border-white/20 ${agent.glow} scale-110 z-20`
                                            : "bg-[#161b22] border-white/5 opacity-50 hover:opacity-100 hover:scale-105 z-10"
                                    )}
                                    style={{ left: `${left}%`, top: `${top}%` }}
                                    whileHover={{ scale: isActive ? 1.15 : 1.1 }}
                                    whileTap={{ scale: 0.95 }}
                                >
                                    <agent.icon size={20} className={cn(
                                        "transition-all duration-300",
                                        isActive ? agent.color : "text-gray-500"
                                    )} />

                                    {/* Active "speaking" or "listening" ripple indicator */}
                                    {isActive && (
                                        <div className={cn("absolute inset-0 rounded-full animate-ping opacity-20 pointer-events-none", agent.bg)} />
                                    )}
                                </motion.button>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="bg-[#1a1a1a] text-white border-white/10 font-medium tracking-wide">
                                {agent.name} {isActive ? "(Listening)" : "(Offline)"}
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                );
            })}
        </div>
    );
}
