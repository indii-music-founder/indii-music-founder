import { useCallback, useLayoutEffect, useState, type RefCallback } from 'react';

export type WorkspaceMode = 'focused' | 'standard' | 'wide';

export const WORKSPACE_BREAKPOINTS = {
    focused: 840,
    wide: 1200,
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
