import { vi, describe, it, expect, beforeEach } from 'vitest';
import { createStore } from 'zustand';

// Mock must be defined before imports that use it
const { mockUpdateSession, mockCreateSession, mockDeleteSession, mockGetSessionsForUser } = vi.hoisted(() => ({
    mockUpdateSession: vi.fn().mockResolvedValue(undefined),
    mockGetSessionsForUser: vi.fn().mockResolvedValue([]),
    mockCreateSession: vi.fn().mockResolvedValue('new-session-id'),
    mockDeleteSession: vi.fn().mockResolvedValue(undefined)
}));

vi.mock('@/services/agent/SessionService', () => ({
    sessionService: {
        updateSession: mockUpdateSession,
        getSessionsForUser: mockGetSessionsForUser,
        createSession: mockCreateSession,
        deleteSession: mockDeleteSession
    }
}));

import { createAgentSlice, AgentSlice } from './agent';
import type { AgentMessage } from './agent';
import { sessionService } from '@/services/agent/SessionService';

describe('AgentSlice Persistence (The Amnesia Check)', () => {
    let useStore: any;

    beforeEach(async () => {
        vi.clearAllMocks();
        // Create a fresh store for each test
        useStore = createStore<AgentSlice>((...a) => createAgentSlice(...a));

        // Setup initial active session state for the store
        const store = useStore.getState();
        store.createSession('Test Session', ['agent-1']);

        // Wait for potential async persistence in setup
        await new Promise(resolve => setTimeout(resolve, 100));
        vi.clearAllMocks();
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
        await new Promise(resolve => setTimeout(resolve, 200));

        // Expectation: The message should be persisted to storage
        expect(sessionService.updateSession).toHaveBeenCalledWith(
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
        await new Promise(resolve => setTimeout(resolve, 100));

        (sessionService.updateSession as any).mockClear(); // Clear the call from addAgentMessage

        // Action: Update the message
        store.updateAgentMessage('msg-1', { text: 'New text' });

        // Wait for async
        await new Promise(resolve => setTimeout(resolve, 100));

        // Expectation: The update should be persisted
        expect(sessionService.updateSession).toHaveBeenCalledWith(
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
        await new Promise(resolve => setTimeout(resolve, 100));

        (sessionService.updateSession as any).mockClear();

        // Action: Clear history
        store.clearAgentHistory();

        // Wait for async
        await new Promise(resolve => setTimeout(resolve, 100));

        // Expectation: The empty message list should be persisted
        expect(sessionService.updateSession).toHaveBeenCalledWith(
            sessionId,
            expect.objectContaining({ messages: [] })
        );
    });
});
