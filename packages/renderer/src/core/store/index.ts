import { create } from 'zustand';

import { AppSlice, createAppSlice } from './slices/appSlice';
export type { AppSlice } from './slices/appSlice';
export { createAppSlice };
import { ProfileSlice, createProfileSlice } from './slices/profileSlice';
import { AgentSlice, createAgentSlice } from './slices/agent';
import { CreativeSlice, createCreativeSlice } from './slices/creative';
export type { CanvasImage, ShotItem, DesignVersion } from './slices/creative';
export type { HistoryItem } from '@/core/types/history';
import { WorkflowSlice, createWorkflowSlice } from './slices/workflowSlice';
import { AuthSlice, createAuthSlice } from './slices/authSlice';
import { FinanceSlice, createFinanceSlice } from './slices/financeSlice';
import { DistributionSlice, createDistributionSlice } from './slices/distributionSlice';
import { FileSystemSlice, createFileSystemSlice } from './slices/fileSystemSlice';
import { AudioIntelligenceSlice, createAudioIntelligenceSlice } from './slices/audioIntelligenceSlice';
import { SubscriptionSlice, createSubscriptionSlice } from './slices/subscriptionSlice';
import { SidecarSlice, createSidecarSlice } from './slices/sidecarSlice';
import { SyncSlice, createSyncSlice } from './slices/syncSlice';
import { AudioGenerationSlice, createAudioGenerationSlice } from './slices/audioGenerationSlice';
import { UploadQueueSlice, createUploadQueueSlice } from './slices/uploadQueueSlice';
import { AudioPlayerSlice, createAudioPlayerSlice } from './slices/audioPlayerSlice';
import { BackgroundJobsSlice, createBackgroundJobsSlice } from './slices/backgroundJobsSlice';
import { MemoryAgentSlice, createMemoryAgentSlice } from './slices/memoryAgentSlice';
import { MarketplaceSlice, createMarketplaceSlice } from './slices/marketplaceSlice';
import { EmailSlice, createEmailSlice } from './slices/emailSlice';
import { AnalyticsSlice, createAnalyticsSlice } from './slices/analyticsSlice';
import { AgentFeedbackSlice, createAgentFeedbackSlice } from './slices/agentFeedbackSlice';
import { BoardroomSlice, ReferencedAsset, createBoardroomSlice } from './slices/boardroomSlice';
import { RegistrationSlice, createRegistrationSlice } from './slices/registrationSlice';
import { AgentPlanSlice, createAgentPlanSlice } from './slices/agentPlanSlice';
import { AgentCanvasSlice, createAgentCanvasSlice } from './slices/agentCanvasSlice';
import { AgentMemoryState, createAgentMemorySlice } from './slices/agentMemorySlice';
import { HandoffSlice, createHandoffSlice } from './slices/handoffSlice';
import { CRMSlice, createCRMSlice } from './slices/crmSlice';
import { MapSlice, createMapSlice } from './slices/mapSlice';
import { NotesSlice, Note, createNotesSlice } from './slices/notesSlice';
import { AgentSwarmSlice, createAgentSwarmSlice } from './slices/agentSwarmSlice';
export type { AgentActionLog, CampaignMetrics } from './slices/agentSwarmSlice';
import { AgentSwarmSlice, createAgentSwarmSlice } from './slices/createAgentSwarmSlice';
export type { AgentSwarmSlice, AgentActionLog, CampaignMetrics } from './slices/createAgentSwarmSlice';
import { useLivingPlanSlice } from './slices/livingPlanSlice';
import type { LivingPlan } from '@/services/agent/LivingPlanService';
import type { WorkspaceSnapshot } from '@/services/sync/WorkspaceSyncService';
import type { ModuleId } from '@/core/constants';
import type { ConversationMode } from '@/core/store/slices/agent/agentUISlice';

export type { AgentMessage, AgentThought } from './slices/agent';


export interface StoreState extends
    AppSlice,
    ProfileSlice,
    AgentSlice,
    CreativeSlice,
    WorkflowSlice,
    AuthSlice,
    FinanceSlice,
    DistributionSlice,
    FileSystemSlice,
    AudioIntelligenceSlice,
    SubscriptionSlice,
    SidecarSlice,
    SyncSlice,
    AudioGenerationSlice,
    UploadQueueSlice,
    AudioPlayerSlice,
    BackgroundJobsSlice,
    MemoryAgentSlice,
    MarketplaceSlice,
    EmailSlice,
    AnalyticsSlice,
    BoardroomSlice,
    AgentFeedbackSlice,
    RegistrationSlice,
    AgentPlanSlice,
    AgentCanvasSlice,
    AgentMemoryState,
    HandoffSlice,
    CRMSlice,
    MapSlice,
    NotesSlice,
    AgentSwarmSlice { }


import { OrganizationService } from '@/services/OrganizationService';

import { persist, createJSONStorage } from 'zustand/middleware';
import { SecureZustandStorage } from './adapters/SecureZustandStorage';

export const useStore = create<StoreState>()(
    persist(
        (...a) => {
            const store = {
                ...createAppSlice(...a),
                ...createProfileSlice(...a),
                ...createAgentSlice(...a),
                ...createCreativeSlice(...a),
                ...createWorkflowSlice(...a),
                ...createAuthSlice(...a),
                ...createFinanceSlice(...a),
                ...createDistributionSlice(...a),
                ...createFileSystemSlice(...a),
                ...createAudioIntelligenceSlice(...a),
                ...createSubscriptionSlice(...a),
                ...createSidecarSlice(...a),
                ...createSyncSlice(...a),
                ...createAudioGenerationSlice(...a),
                ...createUploadQueueSlice(...a),
                ...createAudioPlayerSlice(...a),
                ...createBackgroundJobsSlice(...a),
                ...createMemoryAgentSlice(...a),
                ...createMarketplaceSlice(...a),
                ...createEmailSlice(...a),
                ...createAnalyticsSlice(...a),
                ...createAgentFeedbackSlice(...a),
                ...createBoardroomSlice(...a),
                ...createRegistrationSlice(...a),
                ...createAgentPlanSlice(...a),
                ...createAgentCanvasSlice(...a),
                ...createAgentMemorySlice(...a),
                ...createHandoffSlice(...a),
                ...createCRMSlice(...a),
                ...createMapSlice(...a),
                ...createNotesSlice(...a),
                ...createAgentSwarmSlice(...a),
            };

            // Phase 3.6: Bridge store state to OrganizationService for synchronous access
            OrganizationService.setStore({ getState: () => store });

            return store;
        },
        {
            name: 'indii-app-storage',
            storage: createJSONStorage(() => SecureZustandStorage),
            partialize: (state) => ({
                isSidebarOpen: state.isSidebarOpen,
                // Add currentModule if we want to remember the last tab
                currentModule: state.currentModule,
                conversationMode: state.conversationMode,
                userProfile: state.userProfile,
                // ISSUE-007: Persist boardroom chat history to survive HMR/soft reloads in dev
                boardroomMessages: state.agentHistory,
                notes: state.notes,
                selectedNoteId: state.selectedNoteId,
                // ISSUE-006: Session persistence for draft prompts
                ...(state.isSessionPersistent ? { creativePrompt: state.creativePrompt } : {})
                // failedVariationBatch is deliberately NOT persisted: it carries raw
                // base64 image data that can exceed the localStorage quota and break
                // persistence of everything else. Store residency (in-memory) is what
                // keeps it alive across canvas unmounts.
            }),
        }
    )
);

// Centralized event-driven context publisher to synchronize boardroom referenced assets
useStore.subscribe((state, prevState) => {
    if (state.generatedHistory === prevState.generatedHistory && 
        state.distribution?.releases === prevState.distribution?.releases) {
        return;
    }

    // Dynamic import to break circular dependency cycle
    import('@/hooks/useBoardroomContextHandshake').then(({ publishBoardroomContextUpdate }) => {
        publishBoardroomContextUpdate(state);
    }).catch(err => {
        console.error('Failed to import publishBoardroomContextUpdate dynamically', err);
    });
});

// Expose store for testing/dev debugging purposes
if (typeof window !== 'undefined' && import.meta.env.DEV) {
    window.useStore = useStore;
}

// ---------------------------------------------------------------------------
// Workspace Sync: Snapshot Selector & Applier
// ---------------------------------------------------------------------------

/**
 * Extract workspace snapshot from the root store + living plan slice.
 * Pure selector; does not mutate state.
 */
export function getWorkspaceSnapshot(state: StoreState): WorkspaceSnapshot {
    const planState = useLivingPlanSlice.getState();

    return {
        schemaVersion: 1,
        activeAgents: state.activeAgents || ['generalist'],
        referencedAssets: state.referencedAssets || [],
        selectedPlan: planState.selectedPlan || null,
        selectedPlanId: planState.selectedPlanId || null,
        currentModule: state.currentModule || ('dashboard' as ModuleId),
        conversationMode: state.conversationMode || ('direct' as ConversationMode),
        notes: state.notes || [],
        selectedNoteId: state.selectedNoteId || null,
        creativePrompt: state.creativePrompt || '',
    };
}

/**
 * Apply a workspace snapshot to the root store + living plan slice.
 * Merges fields, guarding against missing keys (forward compatibility with older schemaVersion).
 */
export function applyWorkspaceSnapshot(snapshot: Partial<WorkspaceSnapshot>): void {
    const rootUpdates: Partial<StoreState> = {};

    // Merge into root store
    if (snapshot.activeAgents !== undefined) {
        rootUpdates.activeAgents = snapshot.activeAgents;
    }
    if (snapshot.referencedAssets !== undefined) {
        rootUpdates.referencedAssets = snapshot.referencedAssets;
    }
    if (snapshot.currentModule !== undefined) {
        rootUpdates.currentModule = snapshot.currentModule;
    }
    if (snapshot.conversationMode !== undefined) {
        rootUpdates.conversationMode = snapshot.conversationMode;
    }
    if (snapshot.notes !== undefined) {
        rootUpdates.notes = snapshot.notes;
    }
    if (snapshot.selectedNoteId !== undefined) {
        rootUpdates.selectedNoteId = snapshot.selectedNoteId;
    }
    if (snapshot.creativePrompt !== undefined) {
        rootUpdates.creativePrompt = snapshot.creativePrompt;
    }

    if (Object.keys(rootUpdates).length > 0) {
        useStore.setState(rootUpdates);
    }

    // Restore plan from separate store
    const planState = useLivingPlanSlice.getState();
    if (snapshot.selectedPlan !== undefined) {
        planState.setSelectedPlan(snapshot.selectedPlan);
    } else if (snapshot.selectedPlanId !== undefined) {
        planState.setSelectedPlanId(snapshot.selectedPlanId);
    }
}
