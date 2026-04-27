import { useCallback } from 'react';
import { useStore } from '@/core/store';

/**
 * A hook to synchronize project selection across the UI and global application state.
 * This guarantees that components and agents referencing the global store 
 * (like the BaseAgent execution context) will be updated in lockstep with the UI.
 */
export const useProjectSync = () => {
    const setProject = useStore(state => state.setProject);
    const currentProjectId = useStore(state => state.currentProjectId);

    const syncProject = useCallback((projectId: string) => {
        if (projectId !== currentProjectId) {
            setProject(projectId);
            // Future extension: Could potentially emit events or clear specific agent caches here
            // if tighter coupling is needed.
        }
    }, [currentProjectId, setProject]);

    return {
        syncProject,
        currentProjectId
    };
};
