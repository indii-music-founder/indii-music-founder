import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { User } from 'firebase/auth';

vi.unmock('@/core/store');

vi.mock('@/hooks/useBoardroomContextHandshake', () => ({
    publishBoardroomContextUpdate: vi.fn(),
}));

import {
    resetStoreForAccountBoundary,
    sanitizePersistedAppState,
    selectSafePersistedAppState,
    useStore,
} from '@/core/store';
import { OrganizationService } from '@/services/OrganizationService';

describe('account-bound root store', () => {
    let previousState: ReturnType<typeof useStore.getState>;

    beforeEach(() => {
        previousState = useStore.getState();
    });

    afterEach(() => {
        useStore.setState(previousState, true);
    });

    it('persists only account-neutral presentation preferences', () => {
        const persisted = selectSafePersistedAppState({
            ...useStore.getState(),
            isSidebarOpen: false,
            currentModule: 'marketing',
            conversationMode: 'boardroom',
            creativePrompt: 'private draft',
            notes: [{ id: 'private-note' }],
        } as ReturnType<typeof useStore.getState>);

        expect(persisted).toEqual({
            isSidebarOpen: false,
            currentModule: 'marketing',
            conversationMode: 'boardroom',
        });
        expect(sanitizePersistedAppState({
            ...persisted,
            userProfile: { id: 'user-a' },
            notes: [{ id: 'private-note' }],
            creativePrompt: 'private draft',
        })).toEqual(persisted);
    });

    it('rejects stale or fabricated module IDs from shared browser persistence', () => {
        expect(sanitizePersistedAppState({
            currentModule: 'video',
            isSidebarOpen: true,
            conversationMode: 'direct',
        })).toEqual({
            isSidebarOpen: true,
            conversationMode: 'direct',
        });
    });

    it('atomically replaces private slices while preserving the new identity and UI preferences', () => {
        const abortController = new AbortController();
        const resolveApproval = vi.fn();
        const unsubscribe = vi.fn();
        useStore.getState().registerSubscription('account-a-listener', unsubscribe);
        useStore.setState({
            notes: [{
                id: 'note-a',
                title: 'User A',
                content: 'private',
                attachments: [],
                tags: [],
                createdAt: Date.now(),
                updatedAt: Date.now(),
            }],
            creativePrompt: 'User A private draft',
            commandBarInput: 'User A private prompt',
            referencedAssets: [{ id: 'asset-a', type: 'file', name: 'private.wav', value: 'private-storage-url' }],
            isSidebarOpen: false,
            currentModule: 'marketing',
            conversationMode: 'boardroom',
            agentAbortController: abortController,
            pendingApproval: {
                id: 'approval-a',
                content: 'private action',
                type: 'tool',
                timestamp: Date.now(),
                resolve: resolveApproval,
            },
        } as Partial<ReturnType<typeof useStore.getState>>);
        const userB = { uid: 'user-b' } as User;

        resetStoreForAccountBoundary(userB);

        const state = useStore.getState();
        expect(state.user).toBe(userB);
        expect(state.notes).toEqual([]);
        expect(state.creativePrompt).toBe('');
        expect(state.commandBarInput).toBe('');
        expect(state.referencedAssets).toEqual([]);
        expect(state.isSidebarOpen).toBe(false);
        expect(state.currentModule).toBe('marketing');
        expect(state.conversationMode).toBe('boardroom');
        expect(abortController.signal.aborted).toBe(true);
        expect(resolveApproval).toHaveBeenCalledWith(false);
        expect(unsubscribe).toHaveBeenCalledOnce();
        expect(state.activeSubscriptions).toEqual({});
    });

    it('gives OrganizationService the live Zustand state instead of its construction snapshot', () => {
        useStore.setState({
            currentOrganizationId: 'org-live',
            organizations: [{ id: 'org-live' }],
        } as Partial<ReturnType<typeof useStore.getState>>);

        expect(OrganizationService.getCurrentOrgId()).toBe('org-live');
    });
});
