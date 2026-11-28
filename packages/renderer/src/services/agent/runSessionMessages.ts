import type { AgentMessage } from '@/core/store';
import type { ConversationSession } from '@/core/store/slices/agent/agentSessionSlice';
import { importWithRetry } from '@/utils/dynamicImport';
import { logger } from '@/utils/logger';

/**
 * Append a run message to the session the run started in. The model
 * message is appended after awaits during which the user can switch
 * sessions, so the explicit-session append is what keeps a run's
 * conversation intact. Falls back to the active-session append (which
 * creates a session if none exists) only when the run had no session.
 */
export function appendRunMessage(
    store: { getState(): Pick<ReturnType<typeof import('@/core/store').useStore.getState>, 'addMessageToSession' | 'addAgentMessage'> },
    msg: AgentMessage,
    runSessionId: string | null,
): void {
    const state = store.getState();
    if (runSessionId && typeof state.addMessageToSession === 'function') {
        state.addMessageToSession(runSessionId, msg);
    } else {
        state.addAgentMessage(msg);
    }
}

/** Looks up a message in the run's pinned session first so mid-run session switches never drop thoughts or updates (ISSUE-1669). */
export function findRunMessage(
    store: Pick<typeof import('@/core/store').useStore, 'getState'>,
    messageId: string,
    runSessionId: string | null,
): AgentMessage | undefined {
    const state = store.getState();
    if (runSessionId) {
        const sessionMessages = state.sessions?.[runSessionId]?.messages;
        const foundInSession = sessionMessages?.find(m => m.id === messageId);
        if (foundInSession) return foundInSession;
    }
    return state.agentHistory?.find(m => m.id === messageId);
}

export function indexRunMessage(text: string, room?: ConversationSession): void {
    void importWithRetry(() => import('@/services/agent/memory/AlwaysOnMemoryEngine'))
        .then(({ alwaysOnMemoryEngine }) => alwaysOnMemoryEngine.ingest(text, 'user_input', 'context', room && {
            sessionId: room.id,
            projectId: room.projectId,
            memoryScope: room.meetingRoom?.isolateMemory === false ? 'global' : 'room',
        }))
        .catch(err => logger.warn('[AgentService] Failed to index user message:', err));
}
