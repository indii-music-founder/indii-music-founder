import { create } from 'zustand';

import { AppSlice, createAppSlice } from '@/core/store/slices/appSlice';
export type { AppSlice } from '@/core/store/slices/appSlice';
export { createAppSlice };
import { ProfileSlice, clearProfileSubscriptionForAccountBoundary, createProfileSlice } from '@/core/store/slices/profileSlice';
import { AgentSlice, createAgentSlice } from '@/core/store/slices/agent';
import { CreativeSlice, createCreativeSlice } from '@/core/store/slices/creative';
export type { CanvasImage, ShotItem, DesignVersion } from '@/core/store/slices/creative';
export type { HistoryItem } from '@/core/types/history';
import { WorkflowSlice, createWorkflowSlice } from '@/core/store/slices/workflowSlice';
import { AuthSlice, createAuthSlice } from '@/core/store/slices/authSlice';
import { FinanceSlice, createFinanceSlice } from '@/core/store/slices/financeSlice';
import { DistributionSlice, createDistributionSlice } from '@/core/store/slices/distributionSlice';
import { FileSystemSlice, createFileSystemSlice } from '@/core/store/slices/fileSystemSlice';
import { createCanvasEditorSlice, CanvasEditorSlice } from '@/core/store/slices/creative/canvasEditorSlice';
import { AudioIntelligenceSlice, createAudioIntelligenceSlice } from '@/core/store/slices/audioIntelligenceSlice';
import { SubscriptionSlice, createSubscriptionSlice } from '@/core/store/slices/subscriptionSlice';
import { SidecarSlice, createSidecarSlice } from '@/core/store/slices/sidecarSlice';
import { SyncSlice, createSyncSlice } from '@/core/store/slices/syncSlice';
import { AudioGenerationSlice, createAudioGenerationSlice } from '@/core/store/slices/audioGenerationSlice';
import { UploadQueueSlice, createUploadQueueSlice } from '@/core/store/slices/uploadQueueSlice';
import { AudioPlayerSlice, createAudioPlayerSlice } from '@/core/store/slices/audioPlayerSlice';
import { BackgroundJobsSlice, createBackgroundJobsSlice } from '@/core/store/slices/backgroundJobsSlice';
import { MemoryAgentSlice, createMemoryAgentSlice } from '@/core/store/slices/memoryAgentSlice';
import { MarketplaceSlice, createMarketplaceSlice } from '@/core/store/slices/marketplaceSlice';
import { EmailSlice, createEmailSlice } from '@/core/store/slices/emailSlice';
import { AnalyticsSlice, createAnalyticsSlice } from '@/core/store/slices/analyticsSlice';
import { AgentFeedbackSlice, createAgentFeedbackSlice } from '@/core/store/slices/agentFeedbackSlice';
import { BoardroomSlice, ReferencedAsset, createBoardroomSlice, deduplicateBoardroomReferences } from '@/core/store/slices/boardroomSlice';
import { RegistrationSlice, createRegistrationSlice } from '@/core/store/slices/registrationSlice';
import { AgentPlanSlice, createAgentPlanSlice } from '@/core/store/slices/agentPlanSlice';
import { AgentCanvasSlice, createAgentCanvasSlice } from '@/core/store/slices/agentCanvasSlice';
import { AgentMemoryState, createAgentMemorySlice } from '@/core/store/slices/agentMemorySlice';
import { HandoffSlice, createHandoffSlice } from '@/core/store/slices/handoffSlice';
import { CRMSlice, createCRMSlice } from '@/core/store/slices/crmSlice';
import { MapSlice, createMapSlice } from '@/core/store/slices/mapSlice';
import { NotesSlice, Note, createNotesSlice } from '@/core/store/slices/notesSlice';
import { AgentSwarmSlice, createAgentSwarmSlice } from '@/core/store/slices/agentSwarmSlice';
export type { AgentSwarmSlice, AgentActionLog, CampaignMetrics } from '@/core/store/slices/agentSwarmSlice';
import { createProjectCanvasSlice, type ProjectCanvasSlice } from '@/modules/project-canvas/store/projectCanvasSlice';
export type { ProjectCanvasSlice };
import { useLivingPlanSlice } from '@/core/store/slices/livingPlanSlice';
import type { LivingPlan } from '@/services/agent/LivingPlanService';
import type { WorkspaceSnapshot } from '@/services/sync/WorkspaceSyncService';
import { isValidModule, type ModuleId } from '@/core/constants';
import {
    isConversationMode,
    type ConversationMode,
    type LiveConversationPhase,
    type AgentUISlice,
} from '@/core/store/slices/agent/agentUISlice';
export {
    isConversationMode,
    type ConversationMode,
    type LiveConversationPhase,
    type AgentUISlice,
};

export type { AgentMessage, AgentThought } from '@/core/store/slices/agent';


export type { StoreState } from '@/core/store/types';
import { logger } from '@/utils/logger';
import type { StoreState } from '@/core/store/types';

type SafePersistedAppState = Pick<
    StoreState,
    'isSidebarOpen' | 'currentModule' | 'conversationMode'
>;

/**
 * Browser persistence is shared by every Firebase account using this browser
 * profile. Keep it limited to account-neutral presentation preferences. User
 * profiles, notes, conversations, referenced assets, and creative drafts are
 * authoritative in account-scoped storage and must never hydrate globally.
 */
export function selectSafePersistedAppState(state: StoreState): SafePersistedAppState {
    return {
        isSidebarOpen: state.isSidebarOpen,
        currentModule: state.currentModule,
        conversationMode: state.conversationMode,
    };
}

export function sanitizePersistedAppState(value: unknown): Partial<SafePersistedAppState> {
    if (!value || typeof value !== 'object') return {};
    const candidate = value as Partial<SafePersistedAppState>;
    const safe: Partial<SafePersistedAppState> = {};
    if (typeof candidate.isSidebarOpen === 'boolean') safe.isSidebarOpen = candidate.isSidebarOpen;
    if (typeof candidate.currentModule === 'string' && isValidModule(candidate.currentModule)) {
        safe.currentModule = candidate.currentModule;
    }
    if (isConversationMode(candidate.conversationMode)) {
        safe.conversationMode = candidate.conversationMode;
    }
    return safe;
}


import { OrganizationService } from '@/services/OrganizationService';

import { persist, createJSONStorage } from 'zustand/middleware';
import { SecureZustandStorage } from '@/core/store/adapters/SecureZustandStorage';

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
                ...createCanvasEditorSlice(...a),
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
                ...createProjectCanvasSlice(...a),
            };

            return store;
        },
        {
            name: 'indii-app-storage',
            storage: createJSONStorage(() => SecureZustandStorage),
            version: 2,
            partialize: selectSafePersistedAppState,
            migrate: (persistedState) => sanitizePersistedAppState(persistedState),
            merge: (persistedState, currentState) => ({
                ...currentState,
                ...sanitizePersistedAppState(persistedState),
            }),
        }
    )
);

// Bridge the live Zustand store, not the construction-time object snapshot.
// Organization scope changes must be visible to every subsequent query.
OrganizationService.setStore(useStore);

/**
 * Atomically remove account-owned in-memory state before a new identity is
 * allowed to render. Replacing from Zustand's initial state also covers new
 * slices added later, avoiding a fragile hand-maintained list of private data.
 */
export function resetStoreForAccountBoundary(user: StoreState['user']): void {
    const current = useStore.getState();
    const initial = useStore.getInitialState();
    current.agentAbortController?.abort('Authenticated account changed');
    current.pendingApproval?.resolve(false);
    clearProfileSubscriptionForAccountBoundary();
    current.clearAllSubscriptions();
    useStore.setState({
        ...initial,
        user,
        authLoading: current.authLoading,
        authError: current.authError,
        isSignUpMode: current.isSignUpMode,
        passwordResetSent: current.passwordResetSent,
        isSidebarOpen: current.isSidebarOpen,
        currentModule: current.currentModule,
        conversationMode: current.conversationMode,
    }, true);

    useLivingPlanSlice.setState(useLivingPlanSlice.getInitialState(), true);
}

/**
 * Clear artist/studio-owned working state before loading a different workspace.
 * The Firebase identity and organization membership remain intact; only private
 * draft material is replaced with the store's clean initial state.
 */
export function resetStoreForWorkspaceBoundary(): void {
    const current = useStore.getState();
    const initial = useStore.getInitialState();
    current.agentAbortController?.abort('Artist workspace changed');
    current.pendingApproval?.resolve(false);
    current.clearAllSubscriptions();
    useStore.setState({
        ...initial,
        user: current.user,
        authLoading: current.authLoading,
        authError: current.authError,
        isSignUpMode: current.isSignUpMode,
        passwordResetSent: current.passwordResetSent,
        currentOrganizationId: current.currentOrganizationId,
        organizations: current.organizations,
        userProfile: current.userProfile,
        isSidebarOpen: current.isSidebarOpen,
    }, true);
    useLivingPlanSlice.setState(useLivingPlanSlice.getInitialState(), true);
}

// Centralized event-driven context publisher to synchronize boardroom referenced assets
useStore.subscribe((state, prevState) => {
    if (state.conversationMode !== 'boardroom') return;
    if (state.conversationMode === prevState.conversationMode &&
        state.generatedHistory === prevState.generatedHistory &&
        state.distribution?.releases === prevState.distribution?.releases) {
        return;
    }

    // Resolve the publisher before reading the workspace again.
    import('@/hooks/useBoardroomContextHandshake').then(({ publishBoardroomContextUpdate }) => {
        publishBoardroomContextUpdate(useStore.getState());
    }).catch(err => {
        logger.error('Failed to import publishBoardroomContextUpdate dynamically', err);
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
    if (Array.isArray(snapshot.referencedAssets)) {
        rootUpdates.referencedAssets = deduplicateBoardroomReferences(snapshot.referencedAssets);
    }
    if (snapshot.currentModule !== undefined && isValidModule(snapshot.currentModule)) {
        rootUpdates.currentModule = snapshot.currentModule;
    }
    if (isConversationMode(snapshot.conversationMode)) {
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
