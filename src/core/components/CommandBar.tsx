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

    const shouldShow = true;

    // Transition variants for different states
    const variants = {
        docked: {
            opacity: 1,
            scale: 1,
            left: '50%',
            bottom: '2rem',
            top: 'auto',
            x: '-50%',
            y: 0,
            width: isCommandBarCollapsed ? 64 : '100%',
            maxWidth: isCommandBarCollapsed ? 48 : 672,
        },
        detached: {
            opacity: 1,
            scale: 1,
            // Only set position if we're not currently dragging or if it's the first time detaching
            // But usually we just want it to stay where it is.
            // Using a simple check to see if we should reset it
            width: isCommandBarCollapsed ? 48 : '100%',
            maxWidth: isCommandBarCollapsed ? 48 : 672,
        }
    };

    return (
        <AnimatePresence>
            {shouldShow && (
                <motion.div
                    key="standalone-command-bar"
                    initial={isCommandBarDetached ? false : { opacity: 0, scale: 0.95, y: 20 }}
                    variants={variants}
                    animate={isCommandBarDetached ? "detached" : "docked"}
                    exit={{ opacity: 0, scale: 0.95, y: 20 }}
                    drag={isCommandBarDetached}
                    dragMomentum={false}
                    dragElastic={0.1}
                    dragConstraints={{ left: -500, right: 500, top: -500, bottom: 500 }} // Relative to initial position
                    className={cn(
                        "fixed z-[500] flex items-center justify-center",
                        isCommandBarDetached ? "cursor-move top-[80%] left-1/2" : "bottom-8 left-1/2"
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
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setCommandBarCollapsed(false);
                                }}
                                className="w-12 h-12 rounded-full bg-purple-600 shadow-[0_0_20px_rgba(168,85,247,0.5)] flex items-center justify-center border border-purple-400/50 cursor-pointer"
                                aria-label="Expand Chat"
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
