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
