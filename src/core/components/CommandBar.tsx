import React, { memo } from 'react';
import { useStore } from '@/core/store';
import { motion, AnimatePresence } from 'framer-motion';
import { PromptArea } from './command-bar/PromptArea';

function CommandBar() {
    const { isCommandBarDetached } = useStore();

    // If not detached, we don't render it here (it will be inside ChatOverlay)
    if (!isCommandBarDetached) return null;

    return (
        <AnimatePresence>
            {isCommandBarDetached && (
                <motion.div
                    initial={{ opacity: 0, y: 20, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 20, scale: 0.95 }}
                    drag
                    dragMomentum={false}
                    className="fixed bottom-0 left-0 p-6 md:p-8 z-[300] pointer-events-none flex items-end"
                >
                    <div className="w-full max-w-2xl pointer-events-auto">
                        <PromptArea />
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}

export default memo(CommandBar);
