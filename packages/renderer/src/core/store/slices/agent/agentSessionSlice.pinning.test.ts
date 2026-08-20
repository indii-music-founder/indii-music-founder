import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { create, type StoreApi, type UseBoundStore } from 'zustand';
import { buildAgentSessionState, AgentSessionSlice } from './agentSessionSlice';

/**
 * Regression: agent runs can outlive a session switch. updateAgentMessage
 * used to resolve the session from the LIVE activeSessionId at write time,
 * so streaming updates — and their Firestore persistence — landed in
 * whichever conversation was active when the write happened. The message→
 * session registry pins every locally-appended message to its originating
 * session.
 */
describe('agentSessionSlice message pinning', () => {
    let store: UseBoundStore<StoreApi<AgentSessionSlice>>;

    beforeEach(() => {
        vi.clearAllMocks();
        vi.spyOn(console, 'error').mockImplementation(() => { });
        vi.spyOn(console, 'warn').mockImplementation(() => { });
        store = create<AgentSessionSlice>()((set, get) => buildAgentSessionState(set, get));
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    const addMsg = (id: string, text: string) =>
        store.getState().addAgentMessage({
            id,
            role: 'user',
            text,
            timestamp: Date.now(),
            source: 'desktop',
        });

    it('pins updates to the message\'s originating session after a session switch', () => {
        addMsg('m1', 'hello');
        const sessionA = store.getState().activeSessionId!;

        // The user switches to another conversation mid-run.
        const sessionB = 'session-b';
        store.setState(state => ({
            activeSessionId: sessionB,
            sessions: {
                ...state.sessions,
                [sessionB]: {
                    id: sessionB,
                    title: 'B',
                    createdAt: 1,
                    updatedAt: 1,
                    messages: [],
                    messageStorage: 'subcollection',
                    participants: ['indii'],
                },
            },
            agentHistory: [],
        }));

        // The run's completion update arrives AFTER the switch.
        store.getState().updateAgentMessage('m1', { text: 'updated answer', isStreaming: false });

        const session = store.getState().sessions[sessionA]!;
        expect(session.messages.find(m => m.id === 'm1')?.text).toBe('updated answer');
        // The rendered conversation is session B — it must not have been
        // replaced by session A's messages.
        expect(store.getState().agentHistory).toEqual([]);
        expect(store.getState().sessions[sessionB]!.messages).toEqual([]);
    });

    it('updates messages appended through addMessageToSession in their own session', () => {
        addMsg('m1', 'creates session');
        const sessionA = store.getState().activeSessionId!;

        store.getState().addMessageToSession(sessionA, {
            id: 'm2',
            role: 'model',
            text: 'streaming…',
            timestamp: Date.now(),
            isStreaming: true,
            agentId: 'finance',
            source: 'desktop',
        });
        store.getState().updateAgentMessage('m2', { text: 'streaming done', isStreaming: false });

        const session = store.getState().sessions[sessionA]!;
        expect(session.messages.find(m => m.id === 'm2')?.text).toBe('streaming done');
    });

    it('falls back to the active session for unregistered messages without crashing', () => {
        store.getState().updateAgentMessage('ghost-message', { text: 'x' });
        addMsg('m2', 'second');
        store.getState().updateAgentMessage('m2', { text: 'y' });
        const s = store.getState().activeSessionId!;
        expect(store.getState().sessions[s]!.messages.find(m => m.id === 'm2')?.text).toBe('y');
    });

    it('purges registry entries when history is cleared', () => {
        addMsg('m1', 'hello');
        const sessionA = store.getState().activeSessionId!;
        store.getState().clearAgentHistory(sessionA);

        // A late update for the cleared message must not resurrect it.
        store.getState().updateAgentMessage('m1', { text: 'late' });
        expect(store.getState().sessions[sessionA]!.messages).toEqual([]);
    });
});
