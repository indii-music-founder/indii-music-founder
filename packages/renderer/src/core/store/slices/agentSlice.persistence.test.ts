import { vi, describe, it, expect, beforeEach } from 'vitest';
import { createStore } from 'zustand';
import type { AgentMessage, ConversationSession } from './agent';

// Mock must be defined before imports that use it
const { mockUpdateSession, mockAppendMessage, mockUpdateMessage, mockClearMessages, mockSubscribeToMessages, messageSubscribers, mockSubscribeToSessions, sessionSubscribers, mockCreateSession, mockDeleteSession, mockGetSessionsForUser } = vi.hoisted(() => ({
    mockUpdateSession: vi.fn().mockResolvedValue(undefined),
    mockAppendMessage: vi.fn().mockResolvedValue(undefined),
    mockUpdateMessage: vi.fn().mockResolvedValue(undefined),
    mockClearMessages: vi.fn().mockResolvedValue(undefined),
    messageSubscribers: [] as Array<(messages: AgentMessage[]) => void>,
    mockSubscribeToMessages: vi.fn((_id: string, onUpdate: (messages: AgentMessage[]) => void) => {
        messageSubscribers.push(onUpdate);
        return () => {};
    }),
    sessionSubscribers: [] as Array<(sessions: ConversationSession[]) => void>,
    mockSubscribeToSessions: vi.fn((onUpdate: (sessions: ConversationSession[]) => void) => {
        sessionSubscribers.push(onUpdate);
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
        subscribeToSessions: mockSubscribeToSessions,
        subscribeToMessages: mockSubscribeToMessages,
        getSessionsForUser: mockGetSessionsForUser,
        createSession: mockCreateSession,
        deleteSession: mockDeleteSession
    }
}));

vi.mock('@/core/context/ToastContext', () => ({ toast: { error: vi.fn() } }));

import { createAgentSlice, AgentSlice } from './agent';
import { sessionService } from '@/services/agent/SessionService';

describe('AgentSlice Persistence (The Amnesia Check)', () => {
    let useStore: any;

    beforeEach(async () => {
        vi.clearAllMocks();
        mockAppendMessage.mockResolvedValue(undefined);
        mockUpdateMessage.mockResolvedValue(undefined);
        mockDeleteSession.mockResolvedValue(undefined);
        messageSubscribers.length = 0;
        sessionSubscribers.length = 0;
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

    it('does not recreate an implicit session when only message append needs a retry', async () => {
        useStore.setState({ activeSessionId: null, sessions: {}, agentHistory: [] });
        mockAppendMessage.mockRejectedValueOnce(new Error('temporary append failure'));
        useStore.getState().addAgentMessage({ id: 'implicit-retry', role: 'user', text: 'Hello', timestamp: 1 });
        await vi.waitFor(() => expect(mockAppendMessage).toHaveBeenCalledTimes(2), { timeout: 2500 });
        expect(mockCreateSession).toHaveBeenCalledTimes(1);
    });

    it('does not switch message subscriptions back when a backgrounded conversation finishes saving', async () => {
        const originalId = useStore.getState().activeSessionId;
        let finish!: (value: string) => void;
        mockCreateSession.mockReturnValueOnce(new Promise<string>(resolve => { finish = resolve; }));
        const newId = useStore.getState().createSession('New conversation', ['indii']);
        await vi.waitFor(() => expect(mockCreateSession).toHaveBeenCalledTimes(1));
        useStore.getState().setActiveSession(originalId);
        await vi.waitFor(() => expect(mockSubscribeToMessages).toHaveBeenCalledWith(originalId, expect.any(Function), expect.any(Function)));
        mockSubscribeToMessages.mockClear();
        finish(newId);
        await new Promise(resolve => setTimeout(resolve, 50));
        expect(mockSubscribeToMessages).not.toHaveBeenCalledWith(newId, expect.any(Function), expect.any(Function));
    });

    it('ignores a queued snapshot from a conversation after switching away', async () => {
        const firstId = useStore.getState().activeSessionId;
        useStore.getState().setActiveSession(firstId);
        await vi.waitFor(() => expect(messageSubscribers.length).toBeGreaterThan(0));
        const staleSnapshot = messageSubscribers.at(-1)!;
        const nextId = 'other-session';
        useStore.setState((state: AgentSlice) => ({ sessions: {
            ...state.sessions,
            [nextId]: { id: nextId, title: 'Other', createdAt: 1, updatedAt: 1, messages: [], participants: ['indii'] },
        } }));
        useStore.getState().setActiveSession(nextId);
        staleSnapshot([{ id: 'stale', role: 'user', text: 'Old callback', timestamp: 1 }]);
        expect(useStore.getState().sessions[firstId].messages).not.toContainEqual(expect.objectContaining({ id: 'stale' }));
        expect(useStore.getState().agentHistory).toEqual([]);
    });

    it('marks an optimistic message unsaved after append retries fail', async () => {
        mockAppendMessage.mockRejectedValue(new Error('storage unavailable'));
        const store = useStore.getState();
        const sessionId = store.activeSessionId;
        store.addAgentMessage({ id: 'failed-append', role: 'user', text: 'Keep this text', timestamp: Date.now() });

        await vi.waitFor(() => {
            expect(mockAppendMessage).toHaveBeenCalledTimes(3);
            expect(useStore.getState().sessions[sessionId].messages[0].saveStatus).toBe('failed');
        }, { timeout: 5000 });
        expect(useStore.getState().agentHistory[0].text).toBe('Keep this text');
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

    it('marks a failed update unsaved without replacing a newer message value', async () => {
        const store = useStore.getState();
        const sessionId = store.activeSessionId;
        store.addAgentMessage({ id: 'update-failure', role: 'model', text: 'Initial', timestamp: Date.now() });
        await vi.waitFor(() => expect(mockAppendMessage).toHaveBeenCalled());
        mockUpdateMessage.mockRejectedValueOnce(new Error('offline'))
            .mockRejectedValueOnce(new Error('offline'))
            .mockRejectedValueOnce(new Error('offline'));

        store.updateAgentMessage('update-failure', { text: 'First edit', isStreaming: true });
        await vi.waitFor(() => expect(mockUpdateMessage).toHaveBeenCalledTimes(1));
        store.updateAgentMessage('update-failure', { text: 'Latest edit' });
        await vi.waitFor(() => expect(mockUpdateMessage).toHaveBeenCalledTimes(4), { timeout: 5000 });
        expect(useStore.getState().sessions[sessionId].messages[0]).toMatchObject({
            text: 'Latest edit', saveStatus: undefined,
        });
    });

    it('shows the failed save state when the latest update exhausts retries', async () => {
        const store = useStore.getState();
        const sessionId = store.activeSessionId;
        store.addAgentMessage({ id: 'latest-failure', role: 'model', text: 'Initial', timestamp: Date.now() });
        await vi.waitFor(() => expect(mockAppendMessage).toHaveBeenCalled());
        mockUpdateMessage.mockRejectedValue(new Error('offline'));

        store.updateAgentMessage('latest-failure', { text: 'Unsaved edit' });
        await vi.waitFor(() => expect(useStore.getState().sessions[sessionId].messages[0].saveStatus)
            .toBe('failed'), { timeout: 5000 });
        expect(useStore.getState().agentHistory[0].text).toBe('Unsaved edit');
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

    it('coalesces streaming text and persists the final update after a slow token write', async () => {
        const store = useStore.getState();
        const sessionId = store.activeSessionId;
        store.addAgentMessage({ id: 'stream-order', role: 'model', text: '', timestamp: Date.now() });
        await vi.waitFor(() => expect(mockAppendMessage).toHaveBeenCalledWith(sessionId, expect.objectContaining({ id: 'stream-order' })));

        let releaseFirst: (() => void) | undefined;
        mockUpdateMessage.mockImplementationOnce(() => new Promise<void>(resolve => { releaseFirst = resolve; }));
        store.updateAgentMessage('stream-order', { text: 'A' });
        await vi.waitFor(() => expect(mockUpdateMessage).toHaveBeenCalledTimes(1));
        store.updateAgentMessage('stream-order', { text: 'AB' });
        store.updateAgentMessage('stream-order', { text: 'ABC' });
        store.updateAgentMessage('stream-order', { isStreaming: false });
        expect(mockUpdateMessage).toHaveBeenCalledTimes(1);

        releaseFirst?.();
        await vi.waitFor(() => expect(mockUpdateMessage).toHaveBeenCalledTimes(3));
        expect(mockUpdateMessage.mock.calls).toEqual([
            [sessionId, 'stream-order', { text: 'A' }],
            [sessionId, 'stream-order', { text: 'ABC' }],
            [sessionId, 'stream-order', { isStreaming: false }],
        ]);
    });

    it('keeps text on each side of a metadata update in call order', async () => {
        const store = useStore.getState();
        const sessionId = store.activeSessionId;
        store.addAgentMessage({ id: 'metadata-boundary', role: 'model', text: '', timestamp: Date.now() });
        await vi.waitFor(() => expect(mockAppendMessage).toHaveBeenCalledWith(sessionId, expect.objectContaining({ id: 'metadata-boundary' })));

        store.updateAgentMessage('metadata-boundary', { text: 'before' });
        store.updateAgentMessage('metadata-boundary', { metadata: { source: 'agent' } });
        store.updateAgentMessage('metadata-boundary', { text: 'after' });

        await vi.waitFor(() => expect(mockUpdateMessage).toHaveBeenCalledTimes(3));
        expect(mockUpdateMessage.mock.calls).toEqual([
            [sessionId, 'metadata-boundary', { text: 'before' }],
            [sessionId, 'metadata-boundary', { metadata: { source: 'agent' } }],
            [sessionId, 'metadata-boundary', { text: 'after' }],
        ]);
    });

    it('keeps a conversation visible when deletion fails and allows a retry', async () => {
        const sessionId = useStore.getState().activeSessionId;
        mockDeleteSession.mockRejectedValueOnce(new Error('offline'));
        useStore.getState().deleteSession(sessionId);
        await vi.waitFor(() => expect(mockDeleteSession).toHaveBeenCalledTimes(1));
        await vi.waitFor(() => expect(useStore.getState().sessions[sessionId]).toBeDefined());
        // Let the rejection handler release the in-flight lock before retrying.
        await new Promise(resolve => setTimeout(resolve, 0));
        useStore.getState().deleteSession(sessionId);
        await vi.waitFor(() => expect(useStore.getState().sessions[sessionId]).toBeUndefined());
        expect(mockDeleteSession).toHaveBeenCalledTimes(2);
    });

    it('keeps a conversation visible while deletion is pending and deduplicates requests', async () => {
        const sessionId = useStore.getState().activeSessionId;
        let finish!: () => void;
        mockDeleteSession.mockReturnValueOnce(new Promise<void>(resolve => { finish = resolve; }));
        useStore.getState().deleteSession(sessionId);
        useStore.getState().deleteSession(sessionId);
        await vi.waitFor(() => expect(mockDeleteSession).toHaveBeenCalledTimes(1));
        expect(useStore.getState().sessions[sessionId]).toBeDefined();
        finish();
        await vi.waitFor(() => expect(useStore.getState().sessions[sessionId]).toBeUndefined());
    });

    it('subscribes to the next conversation after deleting the active one', async () => {
        const firstId = useStore.getState().activeSessionId;
        const nextId = 'remaining-session';
        useStore.setState((state: AgentSlice) => ({ sessions: {
            ...state.sessions,
            [nextId]: { id: nextId, title: 'Remaining', createdAt: 1, updatedAt: 1, messages: [], participants: ['indii'] },
        } }));
        useStore.getState().deleteSession(firstId);
        await vi.waitFor(() => expect(useStore.getState().activeSessionId).toBe(nextId));
        await vi.waitFor(() => expect(mockSubscribeToMessages).toHaveBeenCalledWith(nextId, expect.any(Function), expect.any(Function)));
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

    it('does not persist a late update to a message cleared from the session', async () => {
        const store = useStore.getState();
        store.addAgentMessage({ id: 'cleared-stream', role: 'model', text: 'old', timestamp: Date.now() });
        await vi.waitFor(() => expect(mockAppendMessage).toHaveBeenCalled());
        store.clearAgentHistory();
        store.updateAgentMessage('cleared-stream', { text: 'late token' });
        await vi.waitFor(() => expect(mockClearMessages).toHaveBeenCalled());
        expect(mockUpdateMessage).not.toHaveBeenCalled();
    });

    it('waits for earlier appends before clearing history', async () => {
        const store = useStore.getState();
        const sessionId = store.activeSessionId;
        let finishAppend!: () => void;
        mockAppendMessage.mockImplementationOnce(() => new Promise<void>(resolve => {
            finishAppend = resolve;
        }));

        store.addAgentMessage({ id: 'before-clear', role: 'user', text: 'Old', timestamp: Date.now() });
        await vi.waitFor(() => expect(mockAppendMessage).toHaveBeenCalledTimes(1));
        store.clearAgentHistory();
        expect(mockClearMessages).not.toHaveBeenCalled();

        finishAppend();
        await vi.waitFor(() => expect(mockClearMessages).toHaveBeenCalledWith(sessionId));
    });

    it('waits for an in-flight clear before appending a new message', async () => {
        const store = useStore.getState();
        const sessionId = store.activeSessionId;
        let finishClear!: () => void;
        mockClearMessages.mockImplementationOnce(() => new Promise<void>(resolve => {
            finishClear = resolve;
        }));

        store.clearAgentHistory();
        await vi.waitFor(() => expect(mockClearMessages).toHaveBeenCalledWith(sessionId));
        store.addAgentMessage({ id: 'after-clear', role: 'user', text: 'New', timestamp: Date.now() });
        expect(useStore.getState().sessions[sessionId].messages.map((message: AgentMessage) => message.id))
            .toEqual(['after-clear']);
        expect(mockAppendMessage).not.toHaveBeenCalled();

        finishClear();
        await vi.waitFor(() => expect(mockAppendMessage).toHaveBeenCalledWith(
            sessionId,
            expect.objectContaining({ id: 'after-clear' }),
        ));
    });

    it('keeps messages from concurrent surfaces when the append-only stream updates', async () => {
        const sessionId = useStore.getState().activeSessionId!;
        const previousSubscriptions = messageSubscribers.length;
        useStore.getState().setActiveSession(sessionId);
        await vi.waitFor(() => expect(messageSubscribers.length).toBeGreaterThan(previousSubscriptions));
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

    it('keeps displayed subcollection messages and response metadata during a session-list refresh', async () => {
        const store = useStore.getState();
        const sessionId = store.activeSessionId!;
        const displayedResponse: AgentMessage = {
            id: 'response-live',
            role: 'model',
            text: 'Displayed Evolas response',
            timestamp: 20,
            metadata: {
                personaResponse: {
                    personaId: 'manager',
                    responseId: 'response-live',
                    isControlGroup: false,
                    effectiveFaderValues: {
                        warmth: 50,
                        directness: 50,
                        detail: 50,
                        formality: 50,
                        reasoningTransparency: 50,
                    },
                    measurementStatus: 'pending',
                },
            },
        };
        useStore.setState((state: AgentSlice) => ({
            sessions: {
                ...state.sessions,
                [sessionId]: {
                    ...state.sessions[sessionId]!,
                    messages: [displayedResponse],
                },
            },
            agentHistory: [displayedResponse],
        }));

        await store.loadSessions();
        expect(sessionSubscribers).toHaveLength(1);

        sessionSubscribers[0]!([{
            id: sessionId,
            title: 'Test Session',
            createdAt: 1,
            updatedAt: 21,
            messages: [],
            participants: ['agent-1'],
            messageStorage: 'subcollection',
        }]);

        expect(useStore.getState().agentHistory).toEqual([
            expect.objectContaining({
                id: 'response-live',
                text: 'Displayed Evolas response',
                metadata: {
                    personaResponse: expect.objectContaining({
                        responseId: 'response-live',
                        measurementStatus: 'pending',
                    }),
                },
            }),
        ]);
    });

    it('does not rewrite stale inline history for a migrated conversation', async () => {
        const store = useStore.getState();
        await store.loadSessions();
        sessionSubscribers[0]!([{
            id: store.activeSessionId!, title: 'Migrated', createdAt: 1, updatedAt: 2,
            participants: ['agent-1'], messageStorage: 'subcollection',
            messages: [{ id: 'stale-inline', role: 'model', text: 'Old', timestamp: 1, isStreaming: true }],
        }]);
        await Promise.resolve();
        expect(mockUpdateSession).not.toHaveBeenCalled();
    });

    it('recovers and persists a streaming child message left by a previous page runtime', async () => {
        const store = useStore.getState();
        const sessionId = store.activeSessionId!;

        await store.loadSessions();
        expect(messageSubscribers).toHaveLength(1);

        const interruptedSnapshot: AgentMessage[] = [{
            id: 'interrupted-response',
            role: 'model',
            text: 'Partial response',
            timestamp: 1,
            isStreaming: true,
        }];
        messageSubscribers[0]!(interruptedSnapshot);
        messageSubscribers[0]!(interruptedSnapshot);

        expect(useStore.getState().agentHistory).toEqual([
            expect.objectContaining({
                id: 'interrupted-response',
                isStreaming: false,
                text: 'Partial response\n\n*(Generation interrupted by page reload)*',
            }),
        ]);
        await vi.waitFor(() => expect(mockUpdateMessage).toHaveBeenCalledWith(
            sessionId,
            'interrupted-response',
            {
                text: 'Partial response\n\n*(Generation interrupted by page reload)*',
                isStreaming: false,
            }
        ));
        expect(mockUpdateMessage).toHaveBeenCalledTimes(1);
    });
});
