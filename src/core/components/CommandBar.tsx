import React, { memo } from 'react';
import { useStore } from '@/core/store';
import { useShallow } from 'zustand/react/shallow';
import { motion, AnimatePresence } from 'motion/react';
import { PromptArea } from './command-bar/PromptArea';
import { cn } from '@/lib/utils';

function CommandBar() {
    const { isCommandBarDetached, isCommandBarCollapsed, setCommandBarCollapsed, isAgentOpen, currentModule } = useStore(
        useShallow(state => ({
            isCommandBarDetached: state.isCommandBarDetached,
            isCommandBarCollapsed: state.isCommandBarCollapsed,
            setCommandBarCollapsed: state.setCommandBarCollapsed,
            isAgentOpen: state.isAgentOpen,
            currentModule: state.currentModule,
        }))
    );

    // HQ page (agent module) has its own inline PromptArea — hide this global one
    // Also hide if RightPanel (isAgentOpen) is showing its own unified prompt
    if (currentModule === 'agent' || isAgentOpen) return null;

    // We show the standalone bar always now since ChatOverlay is removed.
    const shouldShow = true;

    return (
        <AnimatePresence>
            {shouldShow && (
                <motion.div
                    key="standalone-command-bar"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{
                        opacity: 1,
                        scale: 1,
                        width: isCommandBarCollapsed ? (isCommandBarDetached ? 48 : 64) : '100%',
                        maxWidth: isCommandBarCollapsed ? 48 : 672,
                        x: isCommandBarDetached ? undefined : "-50%", // Don't animate x when detached to let drag control it
                        y: isCommandBarDetached ? undefined : 0
                    }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    drag={isCommandBarDetached}
                    dragMomentum={false}
                    className={cn(
                        "fixed z-[500] flex items-center justify-center",
                        isCommandBarDetached
                            ? "cursor-move top-[80%] left-[50%] w-auto" // w-auto when detached so it shrinks properly
                            : "bottom-8 left-1/2"
                    )}
                >
                    <div className={cn(
                        "pointer-events-auto transition-all duration-300",
                        isCommandBarCollapsed ? "w-16 h-16 flex items-center justify-center" : "w-full"
                    )}>
                        {isCommandBarCollapsed ? (
                            <motion.button
                                whileHover={{ scale: 1.1 }}
                                whileTap={{ scale: 0.9 }}
                                onClick={() => setCommandBarCollapsed(false)}
                                className="w-12 h-12 rounded-full bg-purple-600 shadow-[0_0_20px_rgba(168,85,247,0.5)] flex items-center justify-center border border-purple-400/50 cursor-pointer"
                            >
                                <div className="w-3 h-3 rounded-full bg-green-400 animate-pulse" />
                            </motion.button>
                        ) : (
                            <PromptArea />
                        )}
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}

export default memo(CommandBar);
