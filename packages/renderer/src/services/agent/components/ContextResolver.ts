import { buildDistributorContext, getDistributorPromptContext } from '@/services/onboarding/DistributorContext';

import { AgentContext, ProjectHandle, DistributorInfo } from '@/services/agent/types';
import { OrganizationService } from '@/services/OrganizationService';
import { importWithRetry } from '@/utils/dynamicImport';

export class ContextResolver {
    async resolveContext(meetingRoomId?: string | null): Promise<AgentContext> {
        const { useStore } = await importWithRetry(() => import('@/core/store'));
        const state = useStore.getState();
        const {
            currentProjectId,
            projects,
            currentOrganizationId,
            userProfile,
            currentModule,
            conversationMode,
            activeAgents,
            activeMeetingRoomId,
            sessions,
        } = state;
        const roomId = meetingRoomId === undefined && currentModule === 'meeting-rooms'
            ? activeMeetingRoomId
            : meetingRoomId;
        const activeMeetingRoom = roomId ? sessions?.[roomId] : undefined;
        if (roomId && (activeMeetingRoom?.namespace !== 'meeting-room' || activeMeetingRoom.isArchived)) {
            throw new Error('Meeting Room is no longer available.');
        }
        const isMeetingRoomActive = Boolean(activeMeetingRoom && activeMeetingRoom.namespace === 'meeting-room');
        const effectiveProjectId = isMeetingRoomActive
            ? activeMeetingRoom?.projectId
            : currentProjectId;
        const currentProject = projects?.find(p => p.id === effectiveProjectId);
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
            projectId: effectiveProjectId,
            orgId: OrganizationService.getCurrentOrgId() ?? (currentOrganizationId === 'org-default' ? 'personal' : currentOrganizationId),
            projectHandle,
            assetReferences: conversationMode === 'direct'
                ? state.uploadedImages?.map((asset, index) => ({
                    id: asset.id,
                    alias: `upload-${index}`,
                    url: asset.storageUri || asset.url,
                }))
                : undefined,
            userProfile,
            brandKit,
            activeModule: isMeetingRoomActive ? 'meeting-rooms' : currentModule,
            chatHistory: isMeetingRoomActive ? activeMeetingRoom?.messages ?? [] : state.agentHistory ?? [],
            conversationMode: isMeetingRoomActive
                ? 'meeting-room'
                : (conversationMode === 'orchestrated' ? undefined : conversationMode),
            seatedAgents: isMeetingRoomActive ? (activeMeetingRoom?.participants ?? []) : activeAgents,
            ...(isMeetingRoomActive && activeMeetingRoom ? {
                meetingRoomSessionId: activeMeetingRoom.id,
                meetingRoomTitle: activeMeetingRoom.title,
                meetingRoomBrief: activeMeetingRoom.meetingRoom?.missionBrief,
            } : {}),
            distributor,
            whiskState: state.whiskState
        };
    }
}
