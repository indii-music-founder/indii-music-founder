import { describe, expect, it, vi } from 'vitest';
import { createStore } from 'zustand';
import { SessionPersistenceConflict } from '@/services/agent/SessionPersistenceConflict';
import { buildAgentSessionState, type AgentSessionSlice } from './agentSessionSlice';

describe('new session persistence ordering', () => {
    it('waits for creation and the first message before deleting the conversation', async () => {
        let finish!: () => void;
        const service = {
            createSession: vi.fn(() => new Promise<string>(resolve => { finish = () => resolve('created'); })),
            appendMessage: vi.fn().mockResolvedValue(undefined),
            deleteSession: vi.fn().mockResolvedValue(undefined),
            subscribeToMessages: vi.fn(() => () => {}),
        };
        const store = createStore<AgentSessionSlice>()((set, get) => buildAgentSessionState(set, get, async () => service));
        const id = store.getState().createSession('New', ['indii']);
        store.getState().addAgentMessage({ id: 'first', role: 'user', text: 'Hi', timestamp: 1 });
        store.getState().deleteSession(id);
        await vi.waitFor(() => expect(service.createSession).toHaveBeenCalledTimes(1));
        expect(service.appendMessage).not.toHaveBeenCalled();
        expect(service.deleteSession).not.toHaveBeenCalled();
        finish();
        await vi.waitFor(() => expect(service.deleteSession).toHaveBeenCalledWith(id));
        expect(service.appendMessage).toHaveBeenCalledWith(id, expect.objectContaining({ id: 'first' }));
        expect(service.appendMessage.mock.invocationCallOrder[0]).toBeLessThan(service.deleteSession.mock.invocationCallOrder[0]!);
    });

    it('does not automatically resubmit an append invalidated by a conversation clear', async () => {
        const service = {
            createSession: vi.fn().mockResolvedValue('created'),
            appendMessage: vi.fn().mockRejectedValue(new SessionPersistenceConflict('Conversation was cleared')),
            deleteSession: vi.fn().mockResolvedValue(undefined),
            subscribeToMessages: vi.fn(() => () => {}),
        };
        const store = createStore<AgentSessionSlice>()((set, get) => buildAgentSessionState(set, get, async () => service));
        const id = store.getState().createSession('New', ['indii']);
        store.getState().addAgentMessage({ id: 'stale-append', role: 'user', text: 'Keep locally', timestamp: 1 });
        await vi.waitFor(() => expect(store.getState().sessions[id]?.messages[0]?.saveStatus).toBe('failed'));
        expect(service.appendMessage).toHaveBeenCalledTimes(1);
        expect(store.getState().sessions[id]?.messages[0]?.text).toBe('Keep locally');
    });

    it('keeps the first message visible and marks it unsaved when creation fails', async () => {
        const service = {
            createSession: vi.fn().mockRejectedValue(new Error('offline')),
            appendMessage: vi.fn().mockResolvedValue(undefined),
            deleteSession: vi.fn().mockResolvedValue(undefined),
            subscribeToMessages: vi.fn(() => () => {}),
        };
        const store = createStore<AgentSessionSlice>()((set, get) => buildAgentSessionState(set, get, async () => service));
        const id = store.getState().createSession('New', ['indii']);
        store.getState().addAgentMessage({ id: 'unsaved-first', role: 'user', text: 'Keep this', timestamp: 1 });
        await vi.waitFor(() => expect(store.getState().sessions[id]?.messages).toEqual([
            expect.objectContaining({ id: 'unsaved-first', text: 'Keep this', saveStatus: 'failed' }),
        ]), { timeout: 4500 });
        expect(service.createSession).toHaveBeenCalledTimes(1);
        expect(service.appendMessage).not.toHaveBeenCalled();
    });
});
