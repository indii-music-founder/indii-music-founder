import { create } from 'zustand';
import { AppSlice, createAppSlice } from './store/slices/appSlice';
import { ProfileSlice, createProfileSlice } from './store/slices/profileSlice';
import { AgentSlice, createAgentSlice } from './store/slices/agentSlice';
import { CreativeSlice, createCreativeSlice } from './store/slices/creativeSlice';
import { WorkflowSlice, createWorkflowSlice } from './store/slices/workflowSlice';
import { DistributionSlice, createDistributionSlice } from './store/slices/distributionSlice';

import { FinanceSlice, createFinanceSlice } from './store/slices/financeSlice';

// Re-export types for backward compatibility
export type { AppSlice } from './store/slices/appSlice';
export type { AgentMessage } from './store/slices/agentSlice';
export type { Organization } from './store/slices/profileSlice';
export type { HistoryItem, CanvasImage, SavedPrompt } from './store/slices/creativeSlice';
export type { DistributionSlice } from './store/slices/distributionSlice';
export type { FinanceSlice } from './store/slices/financeSlice';

// Combined State Type
type AppState = AppSlice & ProfileSlice & AgentSlice & CreativeSlice & WorkflowSlice & DistributionSlice & FinanceSlice;

export const useStore = create<AppState>((...a) => ({
    ...createAppSlice(...a),
    ...createProfileSlice(...a),
    ...createAgentSlice(...a),
    ...createCreativeSlice(...a),
    ...createWorkflowSlice(...a),
    ...createDistributionSlice(...a),
    ...createFinanceSlice(...a),
}));

declare global {
    interface Window {
        useStore: typeof useStore;
    }
}

// Expose store for debugging/automation
if (typeof window !== 'undefined') {
    console.log('[Store] Attaching useStore to window');
    window.useStore = useStore;
}
