/**
 * Agent Slice — Barrel Export
 *
 * Decomposes the original monolithic agentSlice.ts (553L) into 3 sub-modules:
 *
 * - agentUISlice: Agent window, command bar, mode, approval, panel view, chat channel
 * - agentSessionSlice: Sessions, messages, participants, Firestore persistence
 * - agentTaskSlice: Batching, canvas items, agent loading, queue persistence
 *
 * Each sub-module exports its interface + factory function.
 * This barrel composes them into a single StateCreator for the root store.
 * Consumer imports from `@/core/store` remain unchanged.
 */

import { StateCreator } from 'zustand';

// Sub-module imports
import { AgentUISlice, buildAgentUIState } from './agentUISlice';
import { AgentSessionSlice, buildAgentSessionState } from './agentSessionSlice';
import { AgentTaskSlice, buildAgentTaskState } from './agentTaskSlice';
import { AgentOrchestrationSlice, buildAgentOrchestrationState } from './agentOrchestrationSlice';

// Combined interface for the root store
export interface AgentSlice extends AgentUISlice, AgentSessionSlice, AgentTaskSlice, AgentOrchestrationSlice { }

// Type re-exports for backward compatibility
export type { AgentMode, ApprovalRequest } from './agentUISlice';
export type { AgentMessage, AgentThought, ConversationSession } from './agentSessionSlice';

/**
 * Composed StateCreator that merges all 3 agent sub-slices.
 * This is the single entry point consumed by the root store.
 */
export const createAgentSlice: StateCreator<AgentSlice> = (set, get) => {
    // Each builder receives the full set/get so cross-slice reads work
    // (e.g., setActiveSession sets rightPanelView from UI slice)
    const uiState = buildAgentUIState(set, get);
    const sessionState = buildAgentSessionState(set, get);
    const taskState = buildAgentTaskState(set, get);
    const orchestrationState = buildAgentOrchestrationState(set, get);

    // Override setActiveSession to also set rightPanelView (cross-slice concern)
    const originalSetActiveSession = sessionState.setActiveSession;
    sessionState.setActiveSession = (sessionId: string) => {
        originalSetActiveSession(sessionId);
        // Cross-slice: switch right panel back to messages view
        set({ rightPanelView: 'messages' });
    };

    // Override setConversationMode to coordinate Session switching
    const originalSetConversationMode = uiState.setConversationMode;
    uiState.setConversationMode = (mode) => {
        const state = get() as any;
        const projectId = state.currentProjectId;

        if (mode === 'boardroom') {
            // Entering Boardroom: save current session if it's direct/department
            const currentActive = state.activeSessionId;
            const isCurrentlyBoardroom = currentActive ? state.sessions[currentActive]?.namespace === 'boardroom' : false;
            
            if (currentActive && !isCurrentlyBoardroom) {
                set({ lastDirectSessionId: currentActive });
            }

            // Find existing boardroom session for this project
            const boardroomSession = Object.values(state.sessions).find(
                (s: any) => s.namespace === 'boardroom' && s.projectId === projectId
            );

            if (boardroomSession) {
                sessionState.setActiveSession((boardroomSession as any).id);
            } else {
                // Create a new boardroom session
                const newId = sessionState.createSession('Boardroom', ['indii'], 'boardroom', projectId);
                sessionState.setActiveSession(newId);
            }
        } else {
            // Leaving Boardroom: Restore last active direct session
            let targetSessionId = state.lastDirectSessionId;
            
            // Validate the target session still exists and belongs to this project (treating missing as wildcard)
            const targetSession = targetSessionId ? state.sessions[targetSessionId] : null;
            const isMatch = targetSession && (!targetSession.projectId || targetSession.projectId === projectId);
            
            if (!targetSessionId || !targetSession || !isMatch) {
                 const fallback = Object.values(state.sessions).find(
                     (s: any) => !s.namespace && (!s.projectId || s.projectId === projectId)
                 );
                 targetSessionId = fallback ? (fallback as any).id : null;
            }

            if (targetSessionId) {
                sessionState.setActiveSession(targetSessionId);
            } else {
                const newId = sessionState.createSession('New Conversation', undefined, undefined, projectId);
                sessionState.setActiveSession(newId);
            }
        }

        originalSetConversationMode(mode);
    };

    // Override loadSessions to also trigger resumeQueueFromFirestore (cross-slice concern)
    const originalLoadSessions = sessionState.loadSessions;
    sessionState.loadSessions = async () => {
        // Item 407: Resume any in-flight tasks that survived an app restart
        taskState.resumeQueueFromFirestore();
        return originalLoadSessions();
    };

    return {
        ...uiState,
        ...sessionState,
        ...taskState,
        ...orchestrationState,
    };
};
