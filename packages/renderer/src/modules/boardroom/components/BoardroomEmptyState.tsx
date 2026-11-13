import React from 'react';
import { motion } from 'motion/react';

/**
 * BoardroomEmptyState — Displayed when no boardroom messages exist.
 * Shows a centered indigo status badge with the Boardroom command path.
 */
export function BoardroomEmptyState() {
    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="my-auto mx-auto flex flex-col items-center gap-2 max-w-lg text-center"
        >
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-400">Boardroom Active</span>
            <h1 className="text-2xl font-light text-white/80">Awaiting your brief...</h1>
            <p className="text-sm text-white/40">Talk to Indii. Indii will bring in the right managers as needed.</p>
        </motion.div>
    );
}
