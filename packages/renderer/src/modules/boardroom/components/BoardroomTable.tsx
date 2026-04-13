import React from 'react';
import { motion } from 'framer-motion';
import type { AgentMessage } from '@/core/store/slices/agent/agentSessionSlice';
import { Sparkles, Users } from 'lucide-react';

interface BoardroomTableProps {
    messages: AgentMessage[];
    activeCount: number;
}

/**
 * BoardroomTable — Pure visual ornament: the glassmorphic oval with core glow.
 *
 * No longer renders messages inside the oval (that caused the clipping bug).
 * Instead, it shows a status indicator and active agent count.
 * Messages are now rendered in the adjacent BoardroomConversationPanel.
 */
export function BoardroomTable({ messages, activeCount }: BoardroomTableProps) {
    const hasActivity = messages.length > 0;

    return (
        <div className="absolute inset-8 rounded-[100%] border border-white/10 bg-white/[0.02] backdrop-blur-3xl shadow-[0_0_80px_rgba(99,102,241,0.1)] flex items-center justify-center overflow-hidden">
            {/* Table Core Glow — pulses when active */}
            <motion.div
                animate={hasActivity
                    ? { scale: [1, 1.15, 1], opacity: [0.15, 0.25, 0.15] }
                    : { scale: 1, opacity: 0.12 }
                }
                transition={hasActivity
                    ? { repeat: Infinity, duration: 3, ease: 'easeInOut' }
                    : { duration: 0.5 }
                }
                className="absolute w-1/2 h-1/2 rounded-[100%] bg-indigo-500/20 blur-[100px] pointer-events-none"
            />

            {/* Status Center */}
            <div className="relative z-10 flex flex-col items-center justify-center gap-3 text-center">
                <div className="w-14 h-14 rounded-2xl bg-white/[0.04] border border-white/10 flex items-center justify-center">
                    <Sparkles size={22} className="text-indigo-400/60" />
                </div>

                {activeCount > 0 ? (
                    <>
                        <p className="text-sm font-medium text-white/40">
                            {activeCount} Agent{activeCount !== 1 ? 's' : ''} Seated
                        </p>
                        <div className="flex items-center gap-1.5 text-[10px] text-white/20">
                            <Users size={10} />
                            <span>{messages.length} exchange{messages.length !== 1 ? 's' : ''}</span>
                        </div>
                    </>
                ) : (
                    <p className="text-sm text-white/30 max-w-[200px]">
                        Drag agents to the table to begin
                    </p>
                )}
            </div>
        </div>
    );
}
