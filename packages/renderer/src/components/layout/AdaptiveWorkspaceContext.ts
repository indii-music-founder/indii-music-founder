import { createContext, useContext } from 'react';
import type { WorkspaceMode } from '@/hooks/useWorkspaceLayout';

interface AdaptiveWorkspaceContextValue {
    mode: WorkspaceMode;
    width: number;
}

export const AdaptiveWorkspaceContext = createContext<AdaptiveWorkspaceContextValue | null>(null);

export function useAdaptiveWorkspace() {
    const context = useContext(AdaptiveWorkspaceContext);
    if (!context) {
        throw new Error('useAdaptiveWorkspace must be used inside AdaptiveWorkspace.');
    }
    return context;
}

/**
 * Allows leaf surfaces to retain a safe wide-layout fallback in focused unit
 * tests and isolated previews while still consuming the measured workspace
 * contract in the real application shell.
 */
export function useOptionalAdaptiveWorkspace() {
    return useContext(AdaptiveWorkspaceContext);
}
