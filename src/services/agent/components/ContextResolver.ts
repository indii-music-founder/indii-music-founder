import { useStore } from '@/core/store';

export interface ProjectHandle {
    id: string;
    name: string;
    type: string;
}

export interface AgentContext {
    currentProjectId?: string;
    currentOrganizationId?: string;
    projectHandle?: ProjectHandle;
    userProfile?: any;
    brandKit?: any;
    currentModule?: string;
    chatHistory?: any[]; // Agent messages
}

export class ContextResolver {
    async resolveContext(): Promise<AgentContext> {
        const state = useStore.getState();
        const { currentProjectId, projects, currentOrganizationId, userProfile, currentModule } = state;
        const currentProject = projects.find(p => p.id === currentProjectId);
        const brandKit = userProfile?.brandKit;

        let projectHandle: ProjectHandle | undefined;
        if (currentProject) {
            projectHandle = {
                id: currentProject.id,
                name: currentProject.name,
                type: currentProject.type
            };
        }

        return {
            currentProjectId,
            currentOrganizationId,
            projectHandle,
            userProfile,
            brandKit,
            currentModule,
            chatHistory: state.agentHistory || []
        };
    }
}
