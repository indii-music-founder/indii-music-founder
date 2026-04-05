import { useState, useEffect, useCallback } from 'react';

/**
 * Item 290: Contextual First-Run Tooltips
 *
 * Lightweight first-run tooltip system using localStorage.
 * Shows contextual hints to new users, each dismissed permanently.
 *
 * Usage:
 *   const { shouldShow, dismiss } = useFirstRunTip('command-bar');
 *
 *   return (
 *     <>
 *       <CommandBar />
 *       {shouldShow && (
 *         <FirstRunTooltip
 *           message="Press ⌘K to open the Command Bar"
 *           onDismiss={dismiss}
 *         />
 *       )}
 *     </>
 *   );
 */

const STORAGE_KEY = 'indiiOS_first_run_tips';

interface TipState {
    [tipId: string]: boolean; // true = dismissed
}

function loadTipState(): TipState {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : {};
    } catch {
        return {};
    }
}

function saveTipState(state: TipState): void {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
        // Ignore storage errors
    }
}

/**
 * Hook to manage a single first-run tooltip
 */
export function useFirstRunTip(tipId: string) {
    const [shouldShow, setShouldShow] = useState(false);

    useEffect(() => {
        const state = loadTipState();
        if (!state[tipId]) {
            // Small delay so it doesn't flash on mount
            const timer = setTimeout(() => setShouldShow(true), 1000);
            return () => clearTimeout(timer);
        }
    }, [tipId]);

    const dismiss = useCallback(() => {
        setShouldShow(false);
        const state = loadTipState();
        state[tipId] = true;
        saveTipState(state);
    }, [tipId]);

    return { shouldShow, dismiss };
}

/**
 * Reset all tips (useful for testing or "replay tour" feature)
 */
export function resetAllTips(): void {
    localStorage.removeItem(STORAGE_KEY);
}

/** Predefined tips for key features */
export const TIPS = {
    COMMAND_BAR: 'command-bar',
    MODULE_SWITCHER: 'module-switcher',
    AI_CHAT: 'ai-chat',
    CREATIVE_STUDIO: 'creative-studio',
    DISTRIBUTION: 'distribution',
    VIDEO_STUDIO: 'video-studio',
} as const;

/**
 * Lightweight tooltip component for first-run hints
 */
interface FirstRunTooltipProps {
    message: string;
    onDismiss: () => void;
    position?: 'top' | 'bottom' | 'left' | 'right';
    className?: string;
}

export function FirstRunTooltip({
    message,
    onDismiss,
    position = 'bottom',
    className = '',
}: FirstRunTooltipProps) {
    const positionClasses: Record<string, string> = {
        top: 'bottom-full mb-2',
        bottom: 'top-full mt-2',
        left: 'right-full mr-2',
        right: 'left-full ml-2',
    };

    return (
        <div
            className={`absolute z-50 ${positionClasses[position]} ${className}`}
            role="tooltip"
        >
            <div className="bg-gradient-to-r from-purple-600 to-blue-600 text-white text-xs px-4 py-2.5 rounded-xl shadow-lg shadow-purple-900/30 max-w-xs animate-in fade-in slide-in-from-bottom-2 duration-300">
                <p className="leading-relaxed">{message}</p>
                <button
                    onClick={onDismiss}
                    className="mt-1.5 text-[10px] font-bold text-white/70 hover:text-white uppercase tracking-wider transition-colors"
                    aria-label="Dismiss tip"
                >
                    Got it
                </button>
            </div>
        </div>
    );
}
