import { create } from 'zustand';
import { AppSlice, createAppSlice } from './store/slices/appSlice';
import { AuthSlice, createAuthSlice } from './store/slices/authSlice';
import { AgentSlice, createAgentSlice } from './store/slices/agentSlice';
import { CreativeSlice, createCreativeSlice } from './store/slices/creativeSlice';
import { WorkflowSlice, createWorkflowSlice } from './store/slices/workflowSlice';

// Re-export types for backward compatibility
export type { AgentMessage } from './store/slices/agentSlice';
export type { Organization } from './store/slices/authSlice';
export type { HistoryItem, CanvasImage, SavedPrompt } from './store/slices/creativeSlice';

// Combined State Type
type AppState = AppSlice & AuthSlice & AgentSlice & CreativeSlice & WorkflowSlice;

export const useStore = create<AppState>((...a) => ({
    ...createAppSlice(...a),
    ...createAuthSlice(...a),
    ...createAgentSlice(...a),
    ...createCreativeSlice(...a),
    ...createWorkflowSlice(...a),
}));

// Expose store for debugging/automation
if (typeof window !== 'undefined') {
    (window as any).useStore = useStore;
}
