import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from '@/core/store';
import { useShallow } from 'zustand/react/shallow';
import ParticipantSelector from './components/ParticipantSelector';
import { BoardroomTable } from './components/BoardroomTable';

/**
 * BoardroomModule — The virtual multi-agent boardroom.
 *
 * Displays a full-screen glassmorphic oval table where specialist agents
 * sit around the perimeter. Users can drag agents onto the table to activate
 * them and then issue a brief for collaborative discussion.
 *
 * Architecture:
 * - BoardroomTable   → Glassmorphic oval with core glow
 *   - BoardroomEmptyState → "Awaiting your brief..." placeholder
 *   - MessageFeed         → Scrollable agent response list
 * - ParticipantSelector   → Draggable agent icons around the perimeter
 */
export function BoardroomModule() {
    const { isBoardroomMode, boardroomMessages } = useStore(
        useShallow(state => ({
            isBoardroomMode: state.isBoardroomMode,
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
                    <BoardroomTable messages={boardroomMessages} />
                    <ParticipantSelector />
                </div>
            </motion.div>
        </AnimatePresence>
    );
}
