import { useState, useEffect, useCallback, useRef } from 'react';

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

const STORAGE_KEY = 'indii_first_run_tips';

interface TipState {
    [tipId: string]: boolean; // true = dismissed
}

function loadTipState(): TipState {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        const parsed: unknown = raw ? JSON.parse(raw) : {};
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
        return Object.fromEntries(Object.entries(parsed).filter(([, value]) => value === true));
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
// eslint-disable-next-line react-refresh/only-export-components
export function useFirstRunTip(tipId: string) {
    const [visibleTipId, setVisibleTipId] = useState<string | null>(null);

    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        const state = loadTipState();
        if (!state[tipId]) {
            // Small delay so it doesn't flash on mount
            timerRef.current = setTimeout(() => setVisibleTipId(tipId), 1000);
            return () => { if (timerRef.current) clearTimeout(timerRef.current); };
        }
    }, [tipId]);

    const dismiss = useCallback(() => {
        if (timerRef.current) clearTimeout(timerRef.current);
        setVisibleTipId(null);
        const state = loadTipState();
        state[tipId] = true;
        saveTipState(state);
    }, [tipId]);

    return { shouldShow: visibleTipId === tipId, dismiss };
}

/**
 * Reset all tips (useful for testing or "replay tour" feature)
 */
// eslint-disable-next-line react-refresh/only-export-components
export function resetAllTips(): void {
    localStorage.removeItem(STORAGE_KEY);
}

/** Predefined tips for key features */
export const TIPS = {
    COMMAND_BAR: 'command-bar',
    MODULE_SWITCHER: 'module-switcher',
    INTELLIGENCE_CHAT: 'intelligence-chat',
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
            <div className="bg-linear-to-r from-green-600 to-blue-600 text-white text-xs px-4 py-2.5 rounded-xl shadow-lg shadow-green-900/30 max-w-xs motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-300">
                <p className="leading-relaxed">{message}</p>
                <button
                    type="button"
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
