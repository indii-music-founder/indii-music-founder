import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createStore } from 'zustand';
import { createAgentSlice, AgentSlice, AgentMessage } from '@/core/store/slices/agentSlice';

// Mock SessionService to verify persistence
const mockUpdateSession = vi.fn().mockResolvedValue(undefined);
vi.mock('@/services/agent/SessionService', () => ({
    sessionService: {
        updateSession: (...args: any[]) => mockUpdateSession(...args),
        getSessionsForUser: vi.fn().mockResolvedValue([])
    }
}));

describe('📚 Keeper: Context Integrity & Persistence', () => {
    let useStore: any;

    beforeEach(() => {
        vi.clearAllMocks();
        // Create a fresh store for each test to ensure isolation
        useStore = createStore<AgentSlice>((...a) => createAgentSlice(...a));
    });

    it('should persist messages and update context when adding a message', async () => {
        // 1. Create Session
        useStore.getState().createSession('Chat A', ['agent-1']);
        const sessionId = useStore.getState().activeSessionId; // Fetch fresh ID

        const msg: AgentMessage = { id: '1', role: 'user', text: 'Hello, persistence!', timestamp: Date.now() };

        // 2. Add Message
        useStore.getState().addAgentMessage(msg);

        // Wait for async persistence (dynamic import)
        await new Promise(resolve => setTimeout(resolve, 50));

        // Assert: Context Update
        expect(useStore.getState().agentHistory).toContainEqual(msg);

        // Assert: Persistence Call (The "File System" check via Service)
        expect(mockUpdateSession).toHaveBeenCalledWith(
            sessionId,
            expect.objectContaining({
                messages: expect.arrayContaining([expect.objectContaining({ text: 'Hello, persistence!' })])
            })
        );
    });

    it('should NOT leak context between sessions (The Amnesia Check)', async () => {
        const store = useStore.getState();

        // 1. Setup Chat A
        const sessionA = store.createSession('Chat A');
        store.addAgentMessage({ id: 'a1', role: 'user', text: 'Secret A', timestamp: Date.now() });
        await new Promise(resolve => setTimeout(resolve, 50));

        // 2. Setup Chat B (Switching happens automatically on create)
        const sessionB = store.createSession('Chat B');
        store.addAgentMessage({ id: 'b1', role: 'user', text: 'Secret B', timestamp: Date.now() });
        await new Promise(resolve => setTimeout(resolve, 50));

        // Assert: Active Session is B, Context should only have B
        const historyB = useStore.getState().agentHistory;
        expect(historyB).toHaveLength(1);
        expect(historyB[0].text).toBe('Secret B');
        expect(historyB.find((m: AgentMessage) => m.text === 'Secret A')).toBeUndefined();

        // 3. Switch back to Chat A
        store.setActiveSession(sessionA);

        // Assert: Context should only have A
        const historyA = useStore.getState().agentHistory;
        expect(historyA).toHaveLength(1);
        expect(historyA[0].text).toBe('Secret A');
        expect(historyA.find((m: AgentMessage) => m.text === 'Secret B')).toBeUndefined();
    });

    it('should scrub context when history is cleared (Privacy Scrub)', async () => {
        // 1. Setup Session
        useStore.getState().createSession('Chat Scrub');
        const sessionId = useStore.getState().activeSessionId;

        // 2. Add Message
        useStore.getState().addAgentMessage({ id: 's1', role: 'user', text: 'Forget me', timestamp: Date.now() });
        await new Promise(resolve => setTimeout(resolve, 50));
        mockUpdateSession.mockClear();

        // 3. Action: Clear History
        useStore.getState().clearAgentHistory();
        await new Promise(resolve => setTimeout(resolve, 50));

        // Assert: Context Cleared
        expect(useStore.getState().agentHistory).toHaveLength(0);

        // Assert: Persistence Cleared
        expect(mockUpdateSession).toHaveBeenCalledWith(
            sessionId,
            expect.objectContaining({ messages: [] })
        );
    });
});
