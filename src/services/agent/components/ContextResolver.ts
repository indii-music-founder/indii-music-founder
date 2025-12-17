import { useStore } from '@/core/store';
import { buildDistributorContext, getDistributorPromptContext } from '@/services/onboarding/DistributorContext';

export interface ProjectHandle {
    id: string;
    name: string;
    type: string;
}

export interface DistributorInfo {
    name: string | null;
    isConfigured: boolean;
    coverArtSize: { width: number; height: number };
    audioFormat: string[];
    promptContext: string;
}

export interface AgentContext {
    currentProjectId?: string;
    currentOrganizationId?: string;
    projectHandle?: ProjectHandle;
    userProfile?: any;
    brandKit?: any;
    currentModule?: string;
    chatHistory?: any[]; // Agent messages
    distributor?: DistributorInfo; // Distributor requirements context
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

        // Build distributor context if profile exists
        let distributor: DistributorInfo | undefined;
        if (userProfile) {
            const distroContext = buildDistributorContext(userProfile);
            distributor = {
                name: distroContext.distributor?.name || null,
                isConfigured: distroContext.isConfigured,
                coverArtSize: {
                    width: distroContext.image.width,
                    height: distroContext.image.height
                },
                audioFormat: distroContext.audio.format,
                promptContext: getDistributorPromptContext(userProfile)
            };
        }

        return {
            currentProjectId,
            currentOrganizationId,
            projectHandle,
            userProfile,
            brandKit,
            currentModule,
            chatHistory: state.agentHistory || [],
            distributor
        };
    }
}
