import React from 'react';
import { motion } from 'motion/react';
import type { AgentMessage } from '@/core/store/slices/agent/agentSessionSlice';
import { Sparkles, Users } from 'lucide-react';
import { useStore } from '@/core/store';
import { cn } from '@/lib/utils';

interface BoardroomTableProps {
    messages: AgentMessage[];
    activeCount: number;
    onOpenLivingPlans?: () => void;
}

/**
 * BoardroomTable — The executive nerve center in the middle of the Boardroom table.
 *
 * Features:
 * - indii Conductor (Orchestrator) hub indicator (click to toggle/solo).
 * - Reactive core glow reflecting streaming, thinking, and swarm activity.
 * - Live status count & exchange telemetry.
 * - Clean uncluttered presentation without redundant buttons.
 */
export function BoardroomTable({ messages, activeCount }: BoardroomTableProps) {
    const activeAgents = useStore(state => state.activeAgents) || [];
    const toggleAgent = useStore(state => state.toggleAgent);
    const isStreaming = messages.some(m => m.isStreaming);
    const hasActivity = messages.length > 0;
    const isConductorActive = activeAgents.includes('generalist');
    const seatedSpecialists = activeAgents.filter(id => id !== 'generalist');

    return (
        <div className="absolute inset-8 rounded-[100%] border border-white/10 bg-white/[0.02] backdrop-blur-3xl shadow-[0_0_80px_rgba(99,102,241,0.1)] flex items-center justify-center overflow-hidden">
            {/* Table Core Glow — pulses dynamically based on activity and streaming */}
            <motion.div
                animate={isStreaming
                    ? { scale: [1, 1.25, 1], opacity: [0.25, 0.45, 0.25] }
                    : hasActivity
                        ? { scale: [1, 1.15, 1], opacity: [0.15, 0.25, 0.15] }
                        : { scale: 1, opacity: 0.12 }
                }
                transition={isStreaming
                    ? { repeat: Infinity, duration: 1.5, ease: 'easeInOut' }
                    : hasActivity
                        ? { repeat: Infinity, duration: 3, ease: 'easeInOut' }
                        : { duration: 0.5 }
                }
                className={`absolute w-1/2 h-1/2 rounded-[100%] ${isStreaming ? 'bg-cyan-500/30' : 'bg-indigo-500/20'} blur-[100px] pointer-events-none transition-colors duration-500`}
            />

            {/* Status & Command Center */}
            <div className="relative z-10 flex flex-col items-center justify-center gap-2 text-center px-4 max-w-sm pointer-events-auto">
                {/* Togglable Orchestrator Hub Badge */}
                <button
                    type="button"
                    data-testid="boardroom-orchestrator-badge"
                    onClick={() => toggleAgent('generalist')}
                    className={cn(
                        "flex items-center gap-2 px-3.5 py-1.5 rounded-full border transition-all cursor-pointer shadow-md select-none",
                        isConductorActive
                            ? "bg-emerald-500/15 border-emerald-400/50 shadow-[0_0_20px_rgba(16,185,129,0.3)] hover:bg-emerald-500/25"
                            : "bg-white/5 border-white/10 text-white/40 hover:text-white/80 hover:bg-white/10"
                    )}
                    title={isConductorActive ? "Click to unseat Orchestrator for 1-on-1 specialist mode" : "Click to seat indii Conductor (Orchestrator)"}
                >
                    <span className="relative flex h-2 w-2">
                        {isConductorActive && (
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                        )}
                        <span className={cn("relative inline-flex rounded-full h-2 w-2", isConductorActive ? "bg-emerald-400" : "bg-white/30")} />
                    </span>
                    <Sparkles size={13} className={isConductorActive ? "text-emerald-400" : "text-white/40"} />
                    <span className={cn("text-xs font-bold tracking-wide", isConductorActive ? "text-emerald-200" : "text-white/50")}>
                        indii Conductor • Orchestrator
                    </span>
                    {isConductorActive && (
                        <span className="text-[9px] uppercase font-mono px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-400/30">
                            LEAD
                        </span>
                    )}
                </button>

                <div>
                    <p className="text-sm font-semibold tracking-wide text-white/80">
                        {activeCount} Agent{activeCount !== 1 ? 's' : ''} Seated
                    </p>
                    <div className="flex items-center justify-center gap-2 text-[10px] text-white/40 mt-0.5">
                        <span className="flex items-center gap-1">
                            <Users size={10} />
                            <span>{messages.length} exchange{messages.length !== 1 ? 's' : ''}</span>
                        </span>
                        {isStreaming && (
                            <span className="flex items-center gap-1 text-cyan-400 font-mono">
                                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
                                <span>active swarm</span>
                            </span>
                        )}
                    </div>
                </div>

                {activeCount === 0 && (
                    <p className="text-xs text-white/30 max-w-[200px]">
                        Drag agents to the table to begin
                    </p>
                )}

                {seatedSpecialists.length === 0 && isConductorActive && (
                    <p className="text-xs text-white/35 max-w-[220px]">
                        Click any department pill to seat specialists alongside the Orchestrator
                    </p>
                )}
            </div>
        </div>
    );
}
