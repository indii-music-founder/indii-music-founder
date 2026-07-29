import { useCallback, useLayoutEffect, useState, type RefCallback } from 'react';

export type WorkspaceMode = 'focused' | 'standard' | 'wide';

/**
 * Thresholds are the workspace's OWN width, not the viewport's.
 *
 * `focused` is set from the widest thing a room header has to fit: a room with a
 * four-tab strip needs ~670px of centre column, so a persistent 256px rail only
 * pays for itself above ~930px. Below that the rail becomes a drawer and the
 * centre gets the whole box. The previous 840 left Legal/Distribution with a
 * 520px centre and clipped their tab strips (ISSUE-1267).
 */
export const WORKSPACE_BREAKPOINTS = {
    focused: 960,
    wide: 1360,
} as const;

export function getWorkspaceMode(width: number): WorkspaceMode {
    if (width < WORKSPACE_BREAKPOINTS.focused) return 'focused';
    if (width < WORKSPACE_BREAKPOINTS.wide) return 'standard';
    return 'wide';
}

/**
 * Measures a module's actual available width. Viewport breakpoints are not
 * sufficient once the global navigation and chat panel have consumed space.
 */
export function useWorkspaceLayout() {
    const [element, setElement] = useState<HTMLDivElement | null>(null);
    const [width, setWidth] = useState<number>(WORKSPACE_BREAKPOINTS.wide);

    const ref = useCallback<RefCallback<HTMLDivElement>>((node) => {
        setElement(node);
    }, []);

    useLayoutEffect(() => {
        if (!element || typeof ResizeObserver === 'undefined') return;

        const observer = new ResizeObserver(([entry]) => {
            const nextWidth = Math.round(entry?.contentRect.width ?? 0);
            if (nextWidth > 0) setWidth(nextWidth);
        });
        observer.observe(element);
        return () => observer.disconnect();
    }, [element]);

    return { ref, width, mode: getWorkspaceMode(width) };
}
