import React from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from '@/core/store';
import { useShallow } from 'zustand/react/shallow';
import ParticipantSelector from './components/ParticipantSelector';
import { BoardroomTable } from './components/BoardroomTable';
import { BoardroomConversationPanel } from './components/BoardroomConversationPanel';
import { useMobile } from '@/hooks/useMobile';

import { ArrowLeft, Users, Layers } from 'lucide-react';
import { LivingPlansTracker } from './components/LivingPlansTracker';

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
 *
 */
export function BoardroomModule() {
    const { conversationMode, boardroomMessages, activeAgents, setConversationMode } = useStore(
        useShallow(state => ({
            conversationMode: state.conversationMode,
            boardroomMessages: state.boardroomMessages,
            activeAgents: state.activeAgents,
            setConversationMode: state.setConversationMode
        }))
    );
    const isBoardroomMode = conversationMode === 'boardroom';

    const { isAnyPhone } = useMobile();

    const activeCount = activeAgents?.length || 0;
    const [isTrackerOpen, setIsTrackerOpen] = React.useState(false);

    if (!isBoardroomMode) return null;

    if (typeof document === 'undefined') return null;

    return createPortal(
        <AnimatePresence>
            <motion.div
                key="boardroom-canvas"
                data-testid="boardroom-module"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                className="fixed inset-0 z-[99999] bg-bg-dark flex flex-col"
            >
                {/* Top Bar */}
                <div className="flex items-center gap-3 px-5 py-3 border-b border-white/5 shrink-0">
                    <button
                        onClick={() => setConversationMode('direct')}
                        className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 hover:bg-white/10 text-white/70 hover:text-white transition-all border border-white/10"
                        title="Exit Boardroom"
                        aria-label="Back to Studio"
                    >
                        <ArrowLeft size={16} />
                        <span className="text-xs font-bold uppercase tracking-wider">Back to Studio</span>
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
                    <div className="flex-1" />
                    <button 
                        onClick={() => setIsTrackerOpen(true)}
                        className="flex items-center gap-2 px-4 py-2 rounded-full bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 hover:text-cyan-300 transition-all border border-cyan-500/20 mr-2"
                        title="View Active Plans"
                        aria-label="Living Plans"
                    >
                        <Layers size={16} />
                        <span className="text-xs font-bold uppercase tracking-wider hidden sm:inline">Living Plans</span>
                    </button>
                </div>

                {/* Split-Panel Content */}
                <div className="flex-1 flex min-h-0 overflow-hidden">
                    {/* Left: Orbital Visualization — hidden on mobile */}
                    {!isAnyPhone && (
                        <motion.div
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.1, type: 'spring', damping: 25, stiffness: 200 }}
                            className="relative w-[55%] shrink-0 flex items-center justify-center p-6"
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
                        className={`flex flex-col min-h-0 ${isAnyPhone ? 'flex-1' : 'flex-1 border-l border-white/5'} bg-white/1`}
                    >
                        <BoardroomConversationPanel messages={boardroomMessages} />
                    </motion.div>
                </div>

                <LivingPlansTracker isOpen={isTrackerOpen} onClose={() => setIsTrackerOpen(false)} />
            </motion.div>
        </AnimatePresence>,
        document.body
    );
}
