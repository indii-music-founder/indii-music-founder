import { create } from 'zustand';

import { AppSlice, createAppSlice } from './slices/appSlice';
export type { AppSlice } from './slices/appSlice';
export { createAppSlice };
import { ProfileSlice, createProfileSlice } from './slices/profileSlice';
import { AgentSlice, createAgentSlice } from './slices/agent';
import { CreativeSlice, createCreativeSlice } from './slices/creative';
export type { CanvasImage, ShotItem } from './slices/creative';
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
    RegistrationSlice { }


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
            };

            // Phase 3.6: Bridge store state to OrganizationService for synchronous access
            OrganizationService.setStore({ getState: () => store });

            return store;
        },
        {
            name: 'indiios-app-storage',
            storage: createJSONStorage(() => SecureZustandStorage),
            partialize: (state) => ({
                isSidebarOpen: state.isSidebarOpen,
                // Add currentModule if we want to remember the last tab
                currentModule: state.currentModule,
                isBoardroomMode: state.isBoardroomMode,
            }),
        }
    )
);

// Expose store for testing purposes
if (typeof window !== 'undefined') {
    if (import.meta.env.DEV) {
        window.useStore = useStore;
    }
}
