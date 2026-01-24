import { useStore, AgentMessage } from '@/core/store';
import { UserProfile, BrandKit } from '@/modules/workflow/types';
import { buildDistributorContext, getDistributorPromptContext } from '@/services/onboarding/DistributorContext';

import { AgentContext, ProjectHandle, DistributorInfo } from '../types';

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
            projectId: currentProjectId,
            orgId: currentOrganizationId,
            projectHandle,
            userProfile,
            brandKit,
            activeModule: currentModule,
            chatHistory: state.agentHistory || [],
            distributor,
            whiskState: state.whiskState
        };
    }
}
