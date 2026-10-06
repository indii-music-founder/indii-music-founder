import React from 'react';
import { motion } from 'motion/react';
import { BoardroomStarterCards } from './BoardroomStarterCards';

/**
 * BoardroomEmptyState — Displayed when no boardroom messages exist.
 * Shows a centered indigo status badge with instruction and executive starter cards.
 */
export function BoardroomEmptyState() {
    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="my-auto mx-auto flex flex-col items-center gap-4 max-w-xl text-center px-4"
        >
            <div className="flex flex-col items-center gap-1">
                <span className="text-xs font-bold uppercase tracking-wider text-indigo-400">Boardroom Active</span>
                <h1 className="text-xl font-medium text-white/90">Your Executive Music Team is Assembled</h1>
                <p className="text-xs text-white/50 max-w-md">
                    Select department heads or pick an executive brief below to launch immediate operations.
                </p>
            </div>

            <BoardroomStarterCards />
        </motion.div>
    );
}
