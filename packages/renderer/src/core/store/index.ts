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
import { BoardroomSlice, createBoardroomSlice } from './slices/boardroomSlice';
import { RegistrationSlice, createRegistrationSlice } from './slices/registrationSlice';
import { AgentPlanSlice, createAgentPlanSlice } from './slices/agentPlanSlice';
import { AgentCanvasSlice, createAgentCanvasSlice } from './slices/agentCanvasSlice';
import { AgentMemoryState, createAgentMemorySlice } from './slices/agentMemorySlice';
import { HandoffSlice, createHandoffSlice } from './slices/handoffSlice';
import { CRMSlice, createCRMSlice } from './slices/crmSlice';
import { MapSlice, createMapSlice } from './slices/mapSlice';
import { NotesSlice, createNotesSlice } from './slices/notesSlice';
import { useLivingPlanSlice } from './slices/livingPlanSlice';
import type { WorkspaceSnapshot } from '@/services/sync/WorkspaceSyncService';

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
    NotesSlice { }


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
                boardroomMessages: state.boardroomMessages,
                notes: state.notes,
                selectedNoteId: state.selectedNoteId,
                // ISSUE-006: Session persistence for draft prompts
                ...(state.isSessionPersistent ? { creativePrompt: state.creativePrompt } : {})
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

// Expose store for testing purposes
if (typeof window !== 'undefined') {
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
        boardroomMessages: (state as any).boardroomMessages || [],
        activeAgents: (state as any).activeAgents || ['generalist'],
        referencedAssets: (state as any).referencedAssets || [],
        selectedPlan: planState.selectedPlan || null,
        selectedPlanId: planState.selectedPlanId || null,
        currentModule: (state as any).currentModule || 'dashboard',
        conversationMode: (state as any).conversationMode || 'normal',
        notes: (state as any).notes || [],
        selectedNoteId: (state as any).selectedNoteId || null,
        creativePrompt: (state as any).creativePrompt || '',
    };
}

/**
 * Apply a workspace snapshot to the root store + living plan slice.
 * Uses useStore.setState() to properly notify React subscribers and middleware.
 * Merges only the fields present in the snapshot (forward compatibility with older schemaVersion).
 *
 * ISSUE-654: Previously mutated getState() directly, bypassing Zustand notifications.
 */
export function applyWorkspaceSnapshot(snapshot: Partial<WorkspaceSnapshot>): void {
    // Build a patch object containing only the keys present in the snapshot
    const patch: Record<string, unknown> = {};

    if (snapshot.boardroomMessages !== undefined) {
        patch.boardroomMessages = snapshot.boardroomMessages;
    }
    if (snapshot.activeAgents !== undefined) {
        patch.activeAgents = snapshot.activeAgents;
    }
    if (snapshot.referencedAssets !== undefined) {
        patch.referencedAssets = snapshot.referencedAssets;
    }
    if (snapshot.currentModule !== undefined) {
        patch.currentModule = snapshot.currentModule;
    }
    if (snapshot.conversationMode !== undefined) {
        patch.conversationMode = snapshot.conversationMode;
    }
    if (snapshot.notes !== undefined) {
        patch.notes = snapshot.notes;
    }
    if (snapshot.selectedNoteId !== undefined) {
        patch.selectedNoteId = snapshot.selectedNoteId;
    }
    if (snapshot.creativePrompt !== undefined) {
        patch.creativePrompt = snapshot.creativePrompt;
    }

    // Apply the patch via Zustand's setState so all React subscribers + persist
    // middleware are notified (false = merge, not replace).
    if (Object.keys(patch).length > 0) {
        useStore.setState(patch as Partial<StoreState>, false);
    }

    // Restore plan from separate store via its own slice setters
    const planState = useLivingPlanSlice.getState();
    if (snapshot.selectedPlan !== undefined) {
        planState.setSelectedPlan(snapshot.selectedPlan as any);
    } else if (snapshot.selectedPlanId !== undefined) {
        planState.setSelectedPlanId(snapshot.selectedPlanId);
    }
}
