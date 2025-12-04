import { useStore } from '@/core/store';

export interface AgentContext {
    currentProjectId?: string;
    currentOrganizationId?: string;
    currentProject?: any;
    userProfile?: any;
    brandKit?: any;
    currentModule?: string;
}

export class ContextResolver {
    async resolveContext(): Promise<AgentContext> {
        const state = useStore.getState();
        const { currentProjectId, projects, currentOrganizationId, userProfile, currentModule } = state;
        const currentProject = projects.find(p => p.id === currentProjectId);
        const brandKit = userProfile?.brandKit;

        return {
            currentProjectId,
            currentOrganizationId,
            currentProject,
            userProfile,
            brandKit,
            currentModule
        };
    }
}
