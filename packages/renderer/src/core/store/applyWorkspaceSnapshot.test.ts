import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.unmock('@/core/store');

vi.mock('@/services/OrganizationService', () => ({
    OrganizationService: {
        setStore: vi.fn(),
    },
}));

vi.mock('@/hooks/useBoardroomContextHandshake', () => ({
    publishBoardroomContextUpdate: vi.fn(),
}));

describe('applyWorkspaceSnapshot', () => {
    beforeEach(() => {
        vi.resetModules();
    });

    it('updates the store through zustand and notifies subscribers', async () => {
        const { useStore, applyWorkspaceSnapshot } = await import('@/core/store');
        const { useLivingPlanSlice: useLivingPlanStore } = await import('@/core/store/slices/livingPlanSlice');

        useStore.setState({
            currentModule: 'dashboard',
            creativePrompt: '',
            selectedNoteId: null,
        }, false);
        useLivingPlanStore.setState({
            selectedPlan: null,
            selectedPlanId: null,
            plans: new Map(),
            isLoading: false,
            error: null,
        });

        const subscriber = vi.fn();
        const unsubscribe = useStore.subscribe(subscriber);

        applyWorkspaceSnapshot({
            currentModule: 'creative',
            creativePrompt: 'remixed',
            selectedNoteId: 'note-1',
            selectedPlanId: 'plan-1',
        });

        expect(subscriber).toHaveBeenCalled();
        expect(useStore.getState().currentModule).toBe('creative');
        expect(useStore.getState().creativePrompt).toBe('remixed');
        expect(useStore.getState().selectedNoteId).toBe('note-1');
        expect(useLivingPlanStore.getState().selectedPlanId).toBe('plan-1');

        unsubscribe();
    });

    it('ignores invalid module and conversation values from cloud snapshots', async () => {
        const { useStore, applyWorkspaceSnapshot } = await import('@/core/store');
        useStore.setState({ currentModule: 'dashboard', conversationMode: 'direct' }, false);

        applyWorkspaceSnapshot({
            currentModule: 'removed-module',
            conversationMode: 'fabricated-mode',
        } as never);

        expect(useStore.getState().currentModule).toBe('dashboard');
        expect(useStore.getState().conversationMode).toBe('direct');
    });

    it('restores the explicit automatic routing mode from a workspace snapshot', async () => {
        const { useStore, applyWorkspaceSnapshot } = await import('@/core/store');
        useStore.setState({ conversationMode: 'direct' }, false);

        applyWorkspaceSnapshot({ conversationMode: 'orchestrated' });

        expect(useStore.getState().conversationMode).toBe('orchestrated');
    });
});
