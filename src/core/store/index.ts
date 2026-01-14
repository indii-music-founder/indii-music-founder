import { create } from 'zustand';

import { AppSlice, createAppSlice } from './slices/appSlice';
import { ProfileSlice, createProfileSlice } from './slices/profileSlice';
import { AgentSlice, createAgentSlice } from './slices/agentSlice';
import { CreativeSlice, createCreativeSlice } from './slices/creativeSlice';
export type { HistoryItem } from '@/core/types/history';
import { WorkflowSlice, createWorkflowSlice } from './slices/workflowSlice';
// import { DashboardSlice, createDashboardSlice } from './slices/dashboardSlice';
import { AuthSlice, createAuthSlice } from './slices/authSlice';
// import { OnboardingSlice, createOnboardingSlice } from './slices/onboardingSlice';
// import { MusicSlice, createMusicSlice } from './slices/musicSlice';
import { FinanceSlice, createFinanceSlice } from './slices/financeSlice';
// import { LicensingSlice, createLicensingSlice } from './slices/licensingSlice';
// import { ShowroomSlice, createShowroomSlice } from './slices/showroomSlice';
import { DistributionSlice, createDistributionSlice } from './slices/distributionSlice';
import { FileSystemSlice, createFileSystemSlice } from './slices/fileSystemSlice';
import { AudioIntelligenceSlice, createAudioIntelligenceSlice } from './slices/audioIntelligenceSlice';

export type { AgentMessage, AgentThought } from './slices/agentSlice';
export type { AppSlice } from './slices/appSlice';
export type { CanvasImage, ShotItem } from './slices/creativeSlice';

export interface StoreState extends
    AppSlice,
    ProfileSlice,
    AgentSlice,
    CreativeSlice,
    WorkflowSlice,
    // DashboardSlice,
    AuthSlice,
    // OnboardingSlice,
    // MusicSlice,
    FinanceSlice,
    // LicensingSlice,
    // ShowroomSlice,
    DistributionSlice,
    FileSystemSlice,
    AudioIntelligenceSlice { }

export const useStore = create<StoreState>()((...a) => ({
    ...createAppSlice(...a),
    ...createProfileSlice(...a),
    ...createAgentSlice(...a),
    ...createCreativeSlice(...a),
    ...createWorkflowSlice(...a),
    // ...createDashboardSlice(...a),
    ...createAuthSlice(...a),
    // ...createOnboardingSlice(...a),
    // ...createMusicSlice(...a),
    ...createFinanceSlice(...a),
    // ...createLicensingSlice(...a),
    // ...createShowroomSlice(...a),
    ...createDistributionSlice(...a),
    ...createFileSystemSlice(...a),
    ...createAudioIntelligenceSlice(...a),
}));

// Expose store for debugging/automation
// Expose store for debugging/automation
if (typeof window !== 'undefined' && (import.meta.env.DEV || (window as any).__TEST_MODE__)) {
    const win = window as unknown as Window & { useStore: typeof useStore };
    win.useStore = useStore;
}
