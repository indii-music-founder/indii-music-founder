import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from '@/core/store';
import { useShallow } from 'zustand/react/shallow';
import ParticipantSelector from './components/ParticipantSelector';
import { BoardroomTable } from './components/BoardroomTable';
import { BoardroomConversationPanel } from './components/BoardroomConversationPanel';
import { useMobile } from '@/hooks/useMobile';

import { ArrowLeft, Users } from 'lucide-react';

/**
 * BoardroomModule — The virtual multi-agent boardroom.
 *
 * Split-panel layout:
 * - Left:  Orbital visualization (glassmorphic oval + agent icons)
 * - Right: Persistent, scrollable conversation panel
 *
 * On mobile, the orbital ring collapses and the conversation panel
 * takes full width for a chat-focused experience.
 *
 * Architecture:
 * - BoardroomTable            → Glassmorphic oval with core glow + status
 * - ParticipantSelector       → Draggable agent icons around the perimeter
 * - BoardroomConversationPanel → Full-height scrollable message feed
 */
export function BoardroomModule() {
    const { isBoardroomMode, boardroomMessages, activeAgents, setBoardroomMode } = useStore(
        useShallow(state => ({
            isBoardroomMode: state.isBoardroomMode,
            boardroomMessages: state.boardroomMessages,
            activeAgents: state.activeAgents,
            setBoardroomMode: state.setBoardroomMode
        }))
    );

    const { isAnyPhone } = useMobile();

    if (!isBoardroomMode) return null;

    const activeCount = activeAgents.length;

    return (
        <AnimatePresence>
            <motion.div
                key="boardroom-canvas"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20, scale: 0.95 }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                className="fixed inset-0 z-40 bg-bg-dark flex flex-col"
            >
                {/* Top Bar */}
                <div className="flex items-center gap-3 px-5 py-3 border-b border-white/5 flex-shrink-0">
                    <button
                        onClick={() => setBoardroomMode(false)}
                        className="flex items-center justify-center w-9 h-9 rounded-full bg-white/5 hover:bg-white/10 text-white/70 hover:text-white transition-all border border-white/10"
                        title="Exit Boardroom"
                    >
                        <ArrowLeft size={18} />
                    </button>
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-bold uppercase tracking-wider text-indigo-400">
                            Boardroom HQ
                        </span>
                        {activeCount > 0 && (
                            <span className="flex items-center gap-1 text-[10px] text-white/30 bg-white/5 px-2 py-0.5 rounded-full border border-white/5">
                                <Users size={10} />
                                {activeCount} active
                            </span>
                        )}
                    </div>
                </div>

                {/* Split-Panel Content */}
                <div className="flex-1 flex min-h-0 overflow-hidden">
                    {/* Left: Orbital Visualization — hidden on mobile */}
                    {!isAnyPhone && (
                        <motion.div
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.1, type: 'spring', damping: 25, stiffness: 200 }}
                            className="relative w-[55%] flex-shrink-0 flex items-center justify-center p-6"
                        >
                            <div className="relative w-full h-full max-w-2xl max-h-[70vh]">
                                <BoardroomTable
                                    messages={boardroomMessages}
                                    activeCount={activeCount}
                                />
                                <ParticipantSelector />
                            </div>
                        </motion.div>
                    )}

                    {/* Right: Persistent Conversation Panel */}
                    <motion.div
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.15, type: 'spring', damping: 25, stiffness: 200 }}
                        className={`flex flex-col min-h-0 ${isAnyPhone ? 'flex-1' : 'flex-1 border-l border-white/5'} bg-white/[0.01]`}
                    >
                        <BoardroomConversationPanel messages={boardroomMessages} />
                    </motion.div>
                </div>
            </motion.div>
        </AnimatePresence>
    );
}
