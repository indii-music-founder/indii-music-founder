import React from 'react';
import { useStore } from '@/core/store';
import { useShallow } from 'zustand/react/shallow';
import { PanelRight } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

export interface AgentCanvasToggleProps {
    /** Visual style variant */
    variant?: 'header' | 'sidebar' | 'compact';
    /** Custom class names */
    className?: string;
    /** Hide text label even in non-compact mode */
    iconOnly?: boolean;
}

/**
 * AgentCanvasToggle
 *
 * Persistent, accessible toggle button for the Agent Canvas drawer (A2UI).
 * Displays an active badge with document count when `canvasPanels.length > 0`.
 * Clicking toggles the AgentCanvasPanel drawer open/closed.
 */
export const AgentCanvasToggle: React.FC<AgentCanvasToggleProps> = ({
    variant = 'header',
    className,
    iconOnly = false,
}) => {
    const storeState = useStore(
        useShallow((state) => ({
            isCanvasOpen: state?.isCanvasOpen ?? false,
            canvasPanels: state?.canvasPanels ?? [],
            toggleCanvas: state?.toggleCanvas ?? (() => {}),
        }))
    );

    const isCanvasOpen = Boolean(storeState?.isCanvasOpen);
    const canvasPanels = Array.isArray(storeState?.canvasPanels) ? storeState.canvasPanels : [];
    const toggleCanvas = typeof storeState?.toggleCanvas === 'function' ? storeState.toggleCanvas : () => {};

    const panelCount = canvasPanels.length;
    const hasPanels = panelCount > 0;

    const ariaLabel = hasPanels
        ? `Agent Canvas (${panelCount} document${panelCount === 1 ? '' : 's'})`
        : 'Agent Canvas';

    const tooltipText = hasPanels
        ? `Agent Canvas (${panelCount} active document${panelCount === 1 ? '' : 's'})`
        : 'Agent Canvas (pushed specifications & artifacts)';

    const buttonContent = (
        <button
            onClick={toggleCanvas}
            data-testid="agent-canvas-toggle-btn"
            aria-label={ariaLabel}
            aria-expanded={isCanvasOpen}
            className={cn(
                "relative flex items-center transition-all duration-200 outline-none select-none cursor-pointer",
                variant === 'header' && [
                    "h-8 px-2.5 rounded-lg border text-xs font-medium gap-1.5",
                    isCanvasOpen
                        ? "bg-blue-500/15 border-blue-500/40 text-blue-300 shadow-[0_0_12px_rgba(59,130,246,0.25)]"
                        : hasPanels
                            ? "bg-white/5 border-blue-500/30 text-blue-300 hover:bg-blue-500/10 hover:border-blue-500/50 shadow-[0_0_8px_rgba(59,130,246,0.15)]"
                            : "bg-white/5 border-white/10 text-gray-400 hover:text-white hover:bg-white/10"
                ],
                variant === 'sidebar' && [
                    "w-full px-3 py-2 rounded-lg border text-xs font-medium gap-2 justify-between",
                    isCanvasOpen
                        ? "bg-blue-500/20 border-blue-500/50 text-blue-200 shadow-[0_0_12px_rgba(59,130,246,0.25)]"
                        : hasPanels
                            ? "bg-blue-500/10 border-blue-500/30 text-blue-300 hover:bg-blue-500/20 hover:border-blue-500/50"
                            : "bg-black/20 border-white/5 text-gray-400 hover:text-gray-200 hover:bg-white/5"
                ],
                variant === 'compact' && [
                    "p-2 rounded-lg border text-xs gap-1",
                    isCanvasOpen
                        ? "bg-blue-500/20 border-blue-500/50 text-blue-300"
                        : hasPanels
                            ? "bg-white/5 border-blue-500/30 text-blue-400 hover:bg-blue-500/10"
                            : "bg-transparent border-transparent text-gray-400 hover:text-white hover:bg-white/5"
                ],
                className
            )}
        >
            <div className="relative flex items-center justify-center shrink-0">
                <PanelRight size={variant === 'compact' ? 16 : 14} className={cn(
                    "transition-transform",
                    isCanvasOpen ? "text-blue-400" : hasPanels ? "text-blue-400" : "text-gray-400"
                )} />
                {hasPanels && (
                    <span
                        data-testid="agent-canvas-pulse-dot"
                        className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-blue-500 animate-pulse ring-2 ring-zinc-950"
                    />
                )}
            </div>

            {(!iconOnly && variant !== 'compact') && (
                <span className="truncate font-medium">Agent Canvas</span>
            )}

            {hasPanels && (
                <span
                    data-testid="agent-canvas-badge"
                    className={cn(
                        "ml-auto px-1.5 py-0.2 rounded-full font-mono font-bold text-[10px] leading-tight shrink-0 transition-colors",
                        isCanvasOpen
                            ? "bg-blue-500 text-white shadow-sm"
                            : "bg-blue-500/30 text-blue-300 border border-blue-500/40"
                    )}
                >
                    {panelCount}
                </span>
            )}
        </button>
    );

    return (
        <TooltipProvider delayDuration={200}>
            <Tooltip>
                <TooltipTrigger asChild>
                    {buttonContent}
                </TooltipTrigger>
                <TooltipContent side={variant === 'sidebar' ? 'right' : 'bottom'} className="bg-zinc-900 border-zinc-800 text-white text-xs">
                    {tooltipText}
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );
};

export default AgentCanvasToggle;
