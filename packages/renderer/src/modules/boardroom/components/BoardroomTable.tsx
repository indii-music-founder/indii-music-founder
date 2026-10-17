import React from 'react';
import { motion } from 'motion/react';
import type { AgentMessage } from '@/core/store/slices/agent/agentSessionSlice';
import { Sparkles, Users, Layers, MessageSquare, RotateCcw, UserPlus } from 'lucide-react';
import { useStore } from '@/core/store';
import { BOARDROOM_PRIMARY_HEAD_IDS } from './ParticipantSelector';

interface BoardroomTableProps {
    messages: AgentMessage[];
    activeCount: number;
    onOpenLivingPlans?: () => void;
}

/**
 * BoardroomTable — The executive nerve center in the middle of the Boardroom table.
 *
 * Features:
 * - Permanent indii Conductor (Orchestrator) hub indicator.
 * - Reactive core glow reflecting streaming, thinking, and swarm activity.
 * - Live status count & exchange telemetry.
 * - Interactive quick-actions:
 *   - "Convene Primary Swarm": Seats the core executive department heads alongside the Conductor.
 *   - "Convene": Focuses the prompt input bar.
 *   - "Plans": Opens the active Living Plans slide-over.
 *   - "Reset": Resets table seating back to indii Conductor only.
 */
export function BoardroomTable({ messages, activeCount, onOpenLivingPlans }: BoardroomTableProps) {
    const activeAgents = useStore(state => state.activeAgents) || [];
    const isStreaming = messages.some(m => m.isStreaming);
    const hasActivity = messages.length > 0;
    const seatedSpecialists = activeAgents.filter(id => id !== 'generalist');

    const handleFocusInput = () => {
        const input = document.querySelector<HTMLInputElement | HTMLTextAreaElement>(
            '[data-testid="main-prompt-input"], textarea, input[type="text"]'
        );
        if (input) {
            input.focus();
        }
    };

    const handleSeatPrimary = () => {
        useStore.setState({
            activeAgents: ['generalist', ...BOARDROOM_PRIMARY_HEAD_IDS],
        });
    };

    const handleClearSeating = () => {
        useStore.setState({
            activeAgents: ['generalist'],
        });
    };

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
            <div className="relative z-10 flex flex-col items-center justify-center gap-2.5 text-center px-4 max-w-sm pointer-events-auto">
                {/* Permanent Orchestrator Hub Badge */}
                <div
                    data-testid="boardroom-orchestrator-badge"
                    className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-400/40 shadow-[0_0_20px_rgba(16,185,129,0.25)]"
                >
                    <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
                    </span>
                    <Sparkles size={12} className="text-emerald-400" />
                    <span className="text-[11px] font-bold tracking-wide text-emerald-200">
                        indii Conductor • Orchestrator
                    </span>
                </div>

                {activeCount > 0 ? (
                    <>
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

                        {seatedSpecialists.length === 0 && (
                            <p className="text-xs text-white/35 max-w-[220px]">
                                Click or drag department pills to seat specialists alongside the Orchestrator
                            </p>
                        )}

                        {/* Quick Actions */}
                        <div className="flex flex-wrap items-center justify-center gap-2 mt-1">
                            {seatedSpecialists.length < BOARDROOM_PRIMARY_HEAD_IDS.length && (
                                <button
                                    type="button"
                                    onClick={handleSeatPrimary}
                                    className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-200 text-[11px] font-semibold border border-indigo-500/40 transition-all hover:scale-105 shadow-md"
                                    title="Seat core executive department heads"
                                >
                                    <UserPlus size={11} />
                                    <span>Convene Primary Swarm</span>
                                </button>
                            )}

                            <button
                                type="button"
                                onClick={handleFocusInput}
                                className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-300 text-[11px] font-medium border border-indigo-500/30 transition-all"
                                title="Start Discussion"
                            >
                                <MessageSquare size={11} />
                                <span>Convene</span>
                            </button>

                            {onOpenLivingPlans && (
                                <button
                                    type="button"
                                    onClick={onOpenLivingPlans}
                                    className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 text-[11px] font-medium border border-cyan-500/30 transition-all"
                                    title="Open Living Plans"
                                >
                                    <Layers size={11} />
                                    <span>Plans</span>
                                </button>
                            )}

                            {seatedSpecialists.length > 0 && (
                                <button
                                    type="button"
                                    onClick={handleClearSeating}
                                    className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/5 hover:bg-white/10 text-white/50 hover:text-white/80 text-[11px] border border-white/10 transition-all"
                                    title="Reset Seating to Orchestrator"
                                >
                                    <RotateCcw size={10} />
                                    <span>Reset</span>
                                </button>
                            )}
                        </div>
                    </>
                ) : (
                    <div className="flex flex-col items-center gap-2">
                        <p className="text-sm text-white/30 max-w-[200px]">
                            Drag agents to the table to begin
                        </p>
                        <button
                            type="button"
                            onClick={handleSeatPrimary}
                            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-200 text-xs font-semibold border border-indigo-500/40 transition-all hover:scale-105 shadow-md"
                        >
                            <UserPlus size={12} />
                            <span>Convene Primary Swarm</span>
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
