import React, { memo } from 'react';
import { useStore } from '@/core/store';
import { useShallow } from 'zustand/react/shallow';
import { motion, AnimatePresence } from 'motion';
import { PromptArea } from './command-bar/PromptArea';

function CommandBar() {
    const { isCommandBarDetached, isAgentOpen } = useStore(
        useShallow(state => ({
            isCommandBarDetached: state.isCommandBarDetached,
            isAgentOpen: state.isAgentOpen
        }))
    );

    // In docked mode, if the chat overlay is open, we hide this standalone bar 
    // because it's rendered inside ChatOverlay.
    if (!isCommandBarDetached && isAgentOpen) return null;

    // We show the bar if it's detached OR if the chat window is closed.
    const shouldShow = isCommandBarDetached || !isAgentOpen;

    return (
        <AnimatePresence>
            {shouldShow && (
                <motion.div
                    key="standalone-command-bar"
                    initial={{ opacity: 0, y: 40, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 40, scale: 0.95 }}
                    drag={isCommandBarDetached}
                    dragMomentum={false}
                    className="fixed bottom-8 left-1/2 -translate-x-1/2 w-full max-w-2xl px-6 md:px-0 z-[500] pointer-events-none flex items-center justify-center"
                >
                    <div className="w-full pointer-events-auto">
                        <PromptArea />
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}

export default memo(CommandBar);
