import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createStore } from 'zustand';

const { mockUpdateSession, mockGetSessionsForUser } = vi.hoisted(() => ({
    mockUpdateSession: vi.fn().mockResolvedValue(true),
    mockGetSessionsForUser: vi.fn().mockResolvedValue([])
}));

// 2. Mock the service
vi.mock('@/services/agent/SessionService', () => ({
    sessionService: {
        updateSession: mockUpdateSession,
        getSessionsForUser: mockGetSessionsForUser,
        createSession: vi.fn().mockResolvedValue('new-session-id'),
        deleteSession: vi.fn().mockResolvedValue(true),
        subscribeToSessions: vi.fn((_cb: unknown) => () => {})
    }
}));

// Prevent shard-ordering contamination from Firebase mock state leakage.
// agentOrchestrationSlice has a static `import { db, auth } from '@/services/firebase'`
// which is evaluated at module load. If a prior test corrupted the firebase mock, the
// agentOrchestrationSlice's onSnapshot listener setup can throw, causing
// addAgentMessage's dynamic import to fail silently (error swallowed by .catch).
vi.mock('@/services/firebase', () => ({
    db: {},
    auth: { currentUser: null },
    functionsWest1: {},
    storage: {}
}));

// Prevent loadSessions -> registerSubscription from calling the real root store
// (which may not be initialized in this isolated createStore test context).
vi.mock('@/core/store', () => ({
    useStore: {
        getState: vi.fn(() => ({ registerSubscription: vi.fn() }))
    }
}));

import { createAgentSlice, AgentSlice } from './agent';
import type { AgentMessage } from './agent';

describe('📚 Keeper: Persistence', () => {
    let api: any;

    beforeEach(async () => {
        vi.clearAllMocks();

        // Create a minimal Zustand store harness
        api = createStore<AgentSlice>((set, get, api) => {
            return createAgentSlice(set, get, api);
        });

        // Ensure we have a session to work with
        api.getState().createSession('Test Session', ['indii']);
        // Wait for the async persistence of the session creation to settle
        await new Promise(resolve => setTimeout(resolve, 100));
        vi.clearAllMocks();
    });

    it('should persist conversation history to SessionService when adding a message', async () => {
        const newMessage: AgentMessage = {
            id: 'msg-1',
            role: 'user',
            text: 'Hello, Keeper!',
            timestamp: Date.now()
        };

        // Action: Add Message
        api.getState().addAgentMessage(newMessage);

        // Allow async SessionService dynamic import to resolve.
        // Under shard parallelism with 30+ fork workers competing for module transpilation,
        // resolution can exceed 500ms. 1s provides adequate margin.
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Assert: State is updated
        const state = api.getState();
        expect(state.agentHistory).toHaveLength(1);
        expect(state.agentHistory[0].text).toBe('Hello, Keeper!');

        // Assert: Persistence is called — 10s timeout handles worst-case shard CPU pressure
        await vi.waitFor(() => {
            expect(mockUpdateSession).toHaveBeenCalled();
        }, { timeout: 10000, interval: 100 });

        const [sessionId, updatePayload] = mockUpdateSession.mock.calls[0]!;
        expect(sessionId).toBe(state.activeSessionId);
        expect(updatePayload.messages).toHaveLength(1);
        expect(updatePayload.messages[0].text).toBe('Hello, Keeper!');
    });

    it('should persist cleared history to SessionService', async () => {
        // Setup: Add a message first
        api.getState().addAgentMessage({ id: 'msg-1', role: 'user', text: 'To be deleted', timestamp: Date.now() });
        await new Promise(resolve => setTimeout(resolve, 100));
        mockUpdateSession.mockClear();

        // Action: Clear History
        api.getState().clearAgentHistory();
        await new Promise(resolve => setTimeout(resolve, 100));

        // Assert: State is cleared
        const state = api.getState();
        expect(state.agentHistory).toHaveLength(0);

        // Assert: Persistence called with empty array
        await vi.waitFor(() => {
            expect(mockUpdateSession).toHaveBeenCalled();
        }, { timeout: 3000, interval: 100 });

        const [_, updatePayload] = mockUpdateSession.mock.calls[0]!;
        expect(updatePayload.messages).toEqual([]);
    });

    it('should persist message updates (e.g. streaming chunks) to SessionService', async () => {
        // Setup
        api.getState().addAgentMessage({ id: 'msg-1', role: 'model', text: 'Think...', timestamp: Date.now() });
        await new Promise(resolve => setTimeout(resolve, 200));
        mockUpdateSession.mockClear();

        // Action: Update Message
        api.getState().updateAgentMessage('msg-1', { text: 'Thinking complete.' });
        await new Promise(resolve => setTimeout(resolve, 200));

        // Assert: Persistence called
        await vi.waitFor(() => {
            expect(mockUpdateSession).toHaveBeenCalled();
        }, { timeout: 3000, interval: 100 });

        const [_, updatePayload] = mockUpdateSession.mock.calls[0]!;
        expect(updatePayload.messages[0].text).toBe('Thinking complete.');
    });
});
