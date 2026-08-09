import { vi, describe, it, expect, beforeEach } from 'vitest';
import { createStore } from 'zustand';

// Mock must be defined before imports that use it
const { mockUpdateSession, mockAppendMessage, mockUpdateMessage, mockClearMessages, mockSubscribeToMessages, messageSubscribers, mockCreateSession, mockDeleteSession, mockGetSessionsForUser } = vi.hoisted(() => ({
    mockUpdateSession: vi.fn().mockResolvedValue(undefined),
    mockAppendMessage: vi.fn().mockResolvedValue(undefined),
    mockUpdateMessage: vi.fn().mockResolvedValue(undefined),
    mockClearMessages: vi.fn().mockResolvedValue(undefined),
    messageSubscribers: [] as Array<(messages: AgentMessage[]) => void>,
    mockSubscribeToMessages: vi.fn((_id: string, onUpdate: (messages: AgentMessage[]) => void) => {
        messageSubscribers.push(onUpdate);
        return () => {};
    }),
    mockGetSessionsForUser: vi.fn().mockResolvedValue([]),
    mockCreateSession: vi.fn().mockResolvedValue('new-session-id'),
    mockDeleteSession: vi.fn().mockResolvedValue(undefined)
}));

vi.mock('@/services/agent/SessionService', () => ({
    sessionService: {
        updateSession: mockUpdateSession,
        appendMessage: mockAppendMessage,
        updateMessage: mockUpdateMessage,
        clearMessages: mockClearMessages,
        subscribeToMessages: mockSubscribeToMessages,
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
        messageSubscribers.length = 0;
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
        expect(sessionService.appendMessage).toHaveBeenCalledWith(
            sessionId,
            expect.objectContaining({ id: 'msg-1', text: 'Hello, Keeper!' })
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

        (sessionService.updateMessage as any).mockClear(); // Clear the call from addAgentMessage

        // Action: Update the message
        store.updateAgentMessage('msg-1', { text: 'New text' });

        // Wait for async
        await new Promise(resolve => setTimeout(resolve, 100));

        // Expectation: The update should be persisted
        expect(sessionService.updateMessage).toHaveBeenCalledWith(
            sessionId,
            'msg-1',
            expect.objectContaining({ text: 'New text' })
        );
    });

    it('persists response metadata only after append and in measurement order', async () => {
        const store = useStore.getState();
        const sessionId = store.activeSessionId;
        let resolveAppend: (() => void) | undefined;
        mockAppendMessage.mockImplementationOnce(() => new Promise<void>(resolve => {
            resolveAppend = resolve;
        }));

        store.addAgentMessage({
            id: 'persona-response',
            role: 'model',
            text: '',
            timestamp: Date.now(),
        });
        store.updateAgentMessage('persona-response', {
            text: 'Styled response',
            metadata: { personaResponse: { responseId: 'persona-response', measurementStatus: 'pending' } },
        });
        store.updateAgentMessage('persona-response', {
            metadata: { personaResponse: { responseId: 'persona-response', measurementStatus: 'recorded' } },
        });

        await vi.waitFor(() => expect(mockAppendMessage).toHaveBeenCalledTimes(1));
        expect(mockUpdateMessage).not.toHaveBeenCalled();

        resolveAppend?.();
        await vi.waitFor(() => expect(mockUpdateMessage).toHaveBeenCalledTimes(2));
        expect(mockUpdateMessage.mock.calls).toEqual([
            [sessionId, 'persona-response', expect.objectContaining({
                metadata: { personaResponse: expect.objectContaining({ measurementStatus: 'pending' }) },
            })],
            [sessionId, 'persona-response', expect.objectContaining({
                metadata: { personaResponse: expect.objectContaining({ measurementStatus: 'recorded' }) },
            })],
        ]);
    });

    it('should persist cleared history to SessionService', async () => {
        const store = useStore.getState();
        const sessionId = store.activeSessionId;

        store.addAgentMessage({ id: 'msg-1', role: 'user', text: 'Hi', timestamp: Date.now() });
        // Wait for the side effect of seeding to finish!
        await new Promise(resolve => setTimeout(resolve, 100));

        (sessionService.clearMessages as any).mockClear();

        // Action: Clear history
        store.clearAgentHistory();

        // Wait for async
        await new Promise(resolve => setTimeout(resolve, 100));

        // Expectation: The empty message list should be persisted
        expect(sessionService.clearMessages).toHaveBeenCalledWith(sessionId);
    });

    it('keeps messages from concurrent surfaces when the append-only stream updates', async () => {
        const sessionId = useStore.getState().activeSessionId!;
        useStore.getState().setActiveSession(sessionId);
        await vi.waitFor(() => expect(messageSubscribers.length).toBeGreaterThan(0));
        const receive = messageSubscribers.at(-1)!;

        receive([
            { id: 'desktop-1', role: 'user', text: 'Desktop fact', timestamp: 10 },
            { id: 'phone-1', role: 'user', text: 'Phone fact', timestamp: 11 },
        ]);

        const session = useStore.getState().sessions[sessionId];
        expect(session.messages.map(message => message.id)).toEqual(['desktop-1', 'phone-1']);
        expect(useStore.getState().agentHistory.map(message => message.id)).toEqual(['desktop-1', 'phone-1']);
    });

    it('keeps optimistic first messages until the synchronized stream confirms them', async () => {
        useStore = createStore<AgentSlice>((...a) => createAgentSlice(...a));

        useStore.getState().addAgentMessage({
            id: 'workflow-user',
            role: 'user',
            text: '/analyze-brand',
            timestamp: 10,
        });
        useStore.getState().addAgentMessage({
            id: 'workflow-intake',
            role: 'model',
            text: 'What artist, project, or release should I audit?',
            timestamp: 11,
        });

        await vi.waitFor(() => expect(messageSubscribers.length).toBeGreaterThan(0));
        const receive = messageSubscribers.at(-1)!;

        receive([]);
        expect(useStore.getState().agentHistory.map(message => message.id)).toEqual([
            'workflow-user',
            'workflow-intake',
        ]);

        receive([
            { id: 'workflow-user', role: 'user', text: '/analyze-brand', timestamp: 10 },
            { id: 'workflow-intake', role: 'model', text: 'What artist, project, or release should I audit?', timestamp: 11 },
        ]);
        expect(useStore.getState().agentHistory.map(message => message.id)).toEqual([
            'workflow-user',
            'workflow-intake',
        ]);
    });
});
