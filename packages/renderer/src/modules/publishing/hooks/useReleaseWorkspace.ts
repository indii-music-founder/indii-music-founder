import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useStore } from '@/core/store';
import { resolveReleaseWorkspace, type ReleaseWorkspace } from '@/services/distribution/releaseWorkspace';

/** The current user's release workspace (personal or a loaded organization); null when it cannot be proven. */
export function useReleaseWorkspace(): ReleaseWorkspace | null {
    const { currentOrganizationId, organizations, userId } = useStore(useShallow(state => ({
        currentOrganizationId: state.currentOrganizationId,
        organizations: state.organizations,
        userId: state.userProfile?.id,
    })));
    return useMemo(
        () => resolveReleaseWorkspace({ currentOrganizationId, organizations, userId }),
        [currentOrganizationId, organizations, userId],
    );
}
