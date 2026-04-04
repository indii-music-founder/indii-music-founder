import React, { memo } from 'react';
import { useStore } from '@/core/store';
import { useShallow } from 'zustand/react/shallow';
import { motion, AnimatePresence } from 'motion/react';
import { PromptArea } from './command-bar/PromptArea';
import { cn } from '@/lib/utils';
import { getDepartmentCssVar } from '@/core/theme/moduleColors';

/**
 * Compute Framer Motion position values for left/center/right docking.
 * - 'left'   → 32px from the left edge
 * - 'center' → centered via 50% + translateX(-50%)
 * - 'right'  → 32px from the right edge (computed from viewport width)
 */
const getPositionStyle = (
    position: 'left' | 'center' | 'right',
    isCollapsed: boolean
) => {
    const barWidth = isCollapsed ? 48 : 672;

    switch (position) {
        case 'left':
            return { left: 32, right: 'auto' as const, x: 0 };
        case 'right':
            // Position from the right — use CSS `right` via className, but for Framer 
            // Motion animation we need `left` in pixels. We'll use a calc approach.
            return { left: `calc(100vw - ${barWidth + 32}px)`, right: 'auto' as const, x: 0 };
        case 'center':
        default:
            return { left: '50%', right: 'auto' as const, x: '-50%' };
    }
};

function CommandBar() {
    const {
        isCommandBarDetached,
        isCommandBarCollapsed,
        setCommandBarCollapsed,
        isAgentOpen,
        currentModule,
        commandBarPosition
    } = useStore(
        useShallow(state => ({
            isCommandBarDetached: state.isCommandBarDetached,
            isCommandBarCollapsed: state.isCommandBarCollapsed,
            setCommandBarCollapsed: state.setCommandBarCollapsed,
            isAgentOpen: state.isAgentOpen,
            currentModule: state.currentModule,
            commandBarPosition: state.commandBarPosition,
        }))
    );

    // Hide the floating command bar globally for now as requested.
    // It has been replaced by the Right Panel's unified prompt area.
    return null;

    const shouldShow = true;
    const posStyle = getPositionStyle(commandBarPosition, isCommandBarCollapsed);

    // Module-aware orb color: use CSS variable from the department color system
    const orbColor = getDepartmentCssVar(currentModule);

    // Transition variants for different states
    const variants = {
        docked: {
            opacity: 1,
            scale: 1,
            bottom: '2rem',
            top: 'auto',
            left: posStyle.left,
            x: posStyle.x,
            y: 0,
            width: isCommandBarCollapsed ? 48 : 672,
        },
        detached: {
            opacity: 1,
            scale: 1,
            width: isCommandBarCollapsed ? 48 : 672,
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
                    transition={{
                        left: { type: 'spring', stiffness: 300, damping: 30 },
                        x: { type: 'spring', stiffness: 300, damping: 30 },
                        width: { type: 'spring', stiffness: 300, damping: 30 },
                        maxWidth: { type: 'spring', stiffness: 300, damping: 30 },
                        default: { duration: 0.2 }
                    }}
                    drag={isCommandBarDetached}
                    dragMomentum={false}
                    dragElastic={0.1}
                    dragConstraints={{ left: -500, right: 500, top: -500, bottom: 500 }}
                    className={cn(
                        "fixed z-[500] flex items-center justify-center",
                        isCommandBarDetached ? "cursor-move top-[80%] left-1/2" : "bottom-8"
                    )}
                >
                    <div className={cn(
                        "pointer-events-auto transition-all duration-300",
                        isCommandBarCollapsed
                            ? "w-12 h-12 flex items-center justify-center"
                            : "w-full max-w-[calc(100vw-4rem)]"
                    )}>
                        {isCommandBarCollapsed ? (
                            <motion.button
                                whileHover={{ scale: 1.1 }}
                                whileTap={{ scale: 0.9 }}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setCommandBarCollapsed(false);
                                }}
                                className="w-12 h-12 rounded-full flex items-center justify-center border cursor-pointer"
                                style={{
                                    backgroundColor: `color-mix(in srgb, ${orbColor} 70%, black)`,
                                    borderColor: `color-mix(in srgb, ${orbColor} 50%, transparent)`,
                                    boxShadow: `0 0 20px color-mix(in srgb, ${orbColor} 50%, transparent)`,
                                }}
                                aria-label="Expand Chat"
                            >
                                <div
                                    className="w-3 h-3 rounded-full animate-pulse"
                                    style={{ backgroundColor: `color-mix(in srgb, ${orbColor} 80%, white)` }}
                                />
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
