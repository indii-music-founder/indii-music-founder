import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from '@/core/store';
import { useShallow } from 'zustand/react/shallow';
import ParticipantSelector from './components/ParticipantSelector';
import { ChatMessage } from '@/core/components/chat/ChatMessage';

export function BoardroomModule() {
    const { isBoardroomMode, activeAgents, boardroomMessages } = useStore(
        useShallow(state => ({
            isBoardroomMode: state.isBoardroomMode,
            activeAgents: state.activeAgents,
            boardroomMessages: state.boardroomMessages
        }))
    );

    if (!isBoardroomMode) return null;

    return (
        <AnimatePresence>
            <motion.div
                key="boardroom-canvas"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20, scale: 0.95 }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                className="fixed inset-0 z-40 bg-[#0d1117] flex flex-col items-center justify-center p-8 pt-16 pb-32"
            >
                {/* The Virtual Boardroom Table (Glowing Oval) */}
                <div className="relative w-full max-w-4xl h-[70vh]">

                    {/* Glassmorphic Oval Table */}
                    <div className="absolute inset-8 rounded-[100%] border border-white/10 bg-white/[0.02] backdrop-blur-3xl shadow-[0_0_80px_rgba(99,102,241,0.1)] flex items-center justify-center overflow-hidden">

                        {/* Table Core Glow */}
                        <div className="absolute w-1/2 h-1/2 rounded-[100%] bg-indigo-500/20 blur-[100px] pointer-events-none" />

                        {/* Inner Dialog Area (Agent Responses) */}
                        <div className="relative z-10 w-full h-full p-8 md:p-16 flex flex-col gap-6 overflow-y-auto custom-scrollbar">

                            {boardroomMessages.length === 0 ? (
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    transition={{ delay: 0.4 }}
                                    className="my-auto mx-auto flex flex-col items-center gap-2 max-w-lg text-center"
                                >
                                    <span className="text-xs font-bold uppercase tracking-wider text-indigo-400">Boardroom Active</span>
                                    <h1 className="text-2xl font-light text-white/80">Awaiting your brief...</h1>
                                    <p className="text-sm text-white/40">Select participants to join the discussion.</p>
                                </motion.div>
                            ) : (
                                <div className="flex flex-col gap-4 max-w-4xl mx-auto w-full pb-32">
                                    {boardroomMessages.map((msg) => (
                                        <ChatMessage key={msg.id} msg={msg} />
                                    ))}
                                </div>
                            )}

                        </div>
                    </div>

                    {/* Agent Desks around the perimeter */}
                    <ParticipantSelector />
                </div>
            </motion.div>
        </AnimatePresence >
    );
}
