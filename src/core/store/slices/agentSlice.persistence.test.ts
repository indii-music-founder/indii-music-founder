
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createStore } from 'zustand';
import { createAgentSlice, AgentSlice, AgentMessage } from './agentSlice';

// Mock SessionService dynamic import
const mockUpdateSession = vi.fn().mockResolvedValue(undefined); // Must return a Promise!
const mockSessionService = {
    sessionService: {
        updateSession: mockUpdateSession,
        getSessionsForUser: vi.fn().mockResolvedValue([]),
        createSession: vi.fn().mockResolvedValue('new-session-id')
    }
};

vi.mock('@/services/agent/SessionService', () => mockSessionService);

describe('AgentSlice Persistence (The Amnesia Check)', () => {
    let useStore: any;

    beforeEach(() => {
        vi.clearAllMocks();
        // Create a fresh store for each test
        useStore = createStore<AgentSlice>((...a) => createAgentSlice(...a));

        // Setup initial active session state for the store
        const store = useStore.getState();
        store.createSession('Test Session', ['agent-1']);
    });

    it('should persist new messages to SessionService', async () => {
        const store = useStore.getState();
        const sessionId = store.activeSessionId;
        expect(sessionId).toBeTruthy();

        const newMessage: AgentMessage = {
            id: 'msg-1',
            role: 'user',
            text: 'Hello, Keeper!',
            timestamp: Date.now()
        };

        // Action: Add a message
        store.addAgentMessage(newMessage);

        // Wait for async import and promise resolution
        await new Promise(resolve => setTimeout(resolve, 20));

        // Expectation: The message should be persisted to storage
        expect(mockUpdateSession).toHaveBeenCalledWith(
            sessionId,
            expect.objectContaining({
                messages: expect.arrayContaining([
                    expect.objectContaining({ id: 'msg-1', text: 'Hello, Keeper!' })
                ])
            })
        );
    });

    it('should persist updated messages to SessionService', async () => {
        const store = useStore.getState();
        const sessionId = store.activeSessionId;

        // Seed a message
        const msg: AgentMessage = { id: 'msg-1', role: 'model', text: 'Old text', timestamp: Date.now() };
        store.addAgentMessage(msg);

        // Wait for the side effect of seeding to finish!
        await new Promise(resolve => setTimeout(resolve, 20));

        mockUpdateSession.mockClear(); // Clear the call from addAgentMessage

        // Action: Update the message
        store.updateAgentMessage('msg-1', { text: 'New text' });

        // Wait for async
        await new Promise(resolve => setTimeout(resolve, 20));

        // Expectation: The update should be persisted
        expect(mockUpdateSession).toHaveBeenCalledWith(
            sessionId,
            expect.objectContaining({
                messages: expect.arrayContaining([
                    expect.objectContaining({ id: 'msg-1', text: 'New text' })
                ])
            })
        );
    });

    it('should persist cleared history to SessionService', async () => {
        const store = useStore.getState();
        const sessionId = store.activeSessionId;

        store.addAgentMessage({ id: 'msg-1', role: 'user', text: 'Hi', timestamp: Date.now() });
        // Wait for the side effect of seeding to finish!
        await new Promise(resolve => setTimeout(resolve, 20));

        mockUpdateSession.mockClear();

        // Action: Clear history
        store.clearAgentHistory();

        // Wait for async
        await new Promise(resolve => setTimeout(resolve, 20));

        // Expectation: The empty message list should be persisted
        expect(mockUpdateSession).toHaveBeenCalledWith(
            sessionId,
            expect.objectContaining({ messages: [] })
        );
    });
});
