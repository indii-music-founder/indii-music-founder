import { create } from 'zustand';

import { AppSlice, createAppSlice } from './slices/appSlice';
import { ProfileSlice, createProfileSlice } from './slices/profileSlice';
import { AgentSlice, createAgentSlice } from './slices/agentSlice';
import { CreativeSlice, createCreativeSlice } from './slices/creativeSlice';
export type { HistoryItem } from '@/core/types/history';
import { WorkflowSlice, createWorkflowSlice } from './slices/workflowSlice';
import { AuthSlice, createAuthSlice } from './slices/authSlice';
import { FinanceSlice, createFinanceSlice } from './slices/financeSlice';
import { DistributionSlice, createDistributionSlice } from './slices/distributionSlice';
import { FileSystemSlice, createFileSystemSlice } from './slices/fileSystemSlice';
import { AudioIntelligenceSlice, createAudioIntelligenceSlice } from './slices/audioIntelligenceSlice';
import { SubscriptionSlice, createSubscriptionSlice } from './slices/subscriptionSlice';

export type { AgentMessage, AgentThought } from './slices/agentSlice';
export type { AppSlice } from './slices/appSlice';
export type { CanvasImage, ShotItem } from './slices/creativeSlice';

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
    SubscriptionSlice { }

export const useStore = create<StoreState>()((...a) => ({
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
}));

// Expose store for testing purposes
if (typeof window !== 'undefined') {
    if (import.meta.env.DEV) {
        (window as any).useStore = useStore;
    }
}
