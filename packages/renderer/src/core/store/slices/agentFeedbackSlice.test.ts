import { createStore } from 'zustand/vanilla';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createAgentFeedbackSlice, type AgentFeedbackSlice } from './agentFeedbackSlice';
import { alwaysOnMemoryEngine } from '@/services/agent/memory/AlwaysOnMemoryEngine';
import { auth } from '@/services/firebase';

vi.mock('@/services/firebase', () => ({ auth: { currentUser: { uid: 'artist-1' } } }));
vi.mock('@/services/agent/memory/AlwaysOnMemoryEngine', () => ({
    alwaysOnMemoryEngine: { saveFeedback: vi.fn() },
}));

const context = { agentId: 'marketing', actionType: 'campaign_plan', contentSummary: 'Launch idea' };

describe('agent feedback storage', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (auth as { currentUser: { uid: string } | null }).currentUser = { uid: 'artist-1' };
    });

    it('keeps feedback open when memory storage fails', async () => {
        const store = createStore<AgentFeedbackSlice>()(createAgentFeedbackSlice);
        store.getState().openFeedbackWidget(context);
        vi.mocked(alwaysOnMemoryEngine.saveFeedback).mockRejectedValueOnce(new Error('write unavailable'));

        expect(await store.getState().submitFeedback('negative', 'Avoid sponsored posts')).toBe(false);
        expect(store.getState().isFeedbackWidgetOpen).toBe(true);
        expect(store.getState().currentFeedbackContext).toEqual(context);
        expect(store.getState().pendingFeedbackEvents).toHaveLength(0);
    });

    it('records a stored rule for the signed-in artist without claiming global sharing', async () => {
        const store = createStore<AgentFeedbackSlice>()(createAgentFeedbackSlice);
        store.getState().openFeedbackWidget(context);
        vi.mocked(alwaysOnMemoryEngine.saveFeedback).mockResolvedValueOnce('📥 Stored: rule');

        expect(await store.getState().submitFeedback('positive')).toBe(true);
        expect(alwaysOnMemoryEngine.saveFeedback).toHaveBeenCalledWith(
            'artist-1', 'User approved agent action: campaign_plan', 'positive',
        );
        expect(store.getState().isFeedbackWidgetOpen).toBe(false);
        expect(store.getState().pendingFeedbackEvents[0]).toMatchObject({
            userId: 'artist-1', rating: 'positive', isProcessed: true, sharedGlobally: false,
        });
    });

    it('does not save feedback without a signed-in artist', async () => {
        const store = createStore<AgentFeedbackSlice>()(createAgentFeedbackSlice);
        store.getState().openFeedbackWidget(context);
        (auth as { currentUser: { uid: string } | null }).currentUser = null;

        expect(await store.getState().submitFeedback('positive')).toBe(false);
        expect(alwaysOnMemoryEngine.saveFeedback).not.toHaveBeenCalled();
        expect(store.getState().isFeedbackWidgetOpen).toBe(true);
    });
});
