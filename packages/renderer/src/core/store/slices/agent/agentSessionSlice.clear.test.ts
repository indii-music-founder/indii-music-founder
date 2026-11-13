import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createStore } from 'zustand';
import { SessionPersistenceConflict } from '@/services/agent/SessionPersistenceConflict';
import { buildAgentSessionState, type AgentSessionSlice } from './agentSessionSlice';

const mocks = vi.hoisted(() => ({ clearMessages: vi.fn(), error: vi.fn() }));
vi.mock('@/services/agent/SessionService', () => ({ sessionService: { clearMessages: mocks.clearMessages } }));
vi.mock('@/core/context/ToastContext', () => ({ toast: { error: mocks.error } }));

// Structural queue checks; no live conversation is cleared.
describe('conversation clear retry identity', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.clearMessages.mockReset().mockResolvedValue(undefined);
    });
    function sessionStore(id: string) {
        const store = createStore<AgentSessionSlice>()((set, get) => buildAgentSessionState(set, get));
        store.setState({ activeSessionId: id, sessions: { [id]: {
            id, title: 'Existing conversation', participants: ['indii'], createdAt: 1, updatedAt: 1, messages: [],
        } } });
        return store;
    }
    it('reuses one operation object and ID on an automatic persistence retry', async () => {
        mocks.clearMessages.mockRejectedValueOnce(new Error('acknowledgement lost'));
        const store = sessionStore('clear-retry-identity');
        store.getState().clearAgentHistory();
        await vi.waitFor(() => expect(mocks.clearMessages).toHaveBeenCalledTimes(2), { timeout: 2000 });
        const first = mocks.clearMessages.mock.calls[0];
        const second = mocks.clearMessages.mock.calls[1];
        expect(first?.[0]).toBe('clear-retry-identity');
        expect(first?.[1]).toMatchObject({ id: expect.any(String) });
        expect(second?.[1]).toBe(first?.[1]);
        expect(mocks.error).not.toHaveBeenCalled();
    });
    it('does not retry a clear superseded by another device', async () => {
        mocks.clearMessages.mockRejectedValueOnce(new SessionPersistenceConflict('Clear superseded'));
        const store = sessionStore('clear-retry-conflict');
        store.getState().clearAgentHistory();
        await vi.waitFor(() => expect(mocks.error).toHaveBeenCalledWith(expect.stringMatching(/could not be cleared/i)));
        expect(mocks.clearMessages).toHaveBeenCalledTimes(1);
    });
});
