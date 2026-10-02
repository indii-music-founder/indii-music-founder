import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    currentUser: { uid: 'test-user' } as { uid: string } | null,
    callable: vi.fn(),
    list: vi.fn(),
    get: vi.fn(),
}));

vi.mock('@/services/firebase', () => ({ auth: { get currentUser() { return mocks.currentUser; } }, functions: {} }));
vi.mock('firebase/functions', () => ({ httpsCallable: vi.fn(() => mocks.callable) }));
vi.mock('@/utils/logger', () => ({ logger: { info: vi.fn() } }));
vi.mock('../FirestoreService', () => ({
    FirestoreService: class {
        list = mocks.list;
        get = mocks.get;
    },
}));

import { workflowStateService } from './WorkflowStateService';

describe('WorkflowStateService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.currentUser = { uid: 'test-user' };
    });

    it('creates executions through the authenticated callable and returns persisted state', async () => {
        mocks.callable.mockResolvedValue({ data: { executionId: 'exec-1', status: 'PLANNED' } });
        mocks.get.mockResolvedValue({
            id: 'exec-1', workflowId: 'CAMPAIGN_LAUNCH', userId: 'test-user', status: 'PLANNED',
            steps: { draft: { stepId: 'draft', agentId: 'social', prompt: 'Draft', status: 'PLANNED', idempotencyKey: 'server-key' } },
            edges: [], createdAt: 1, updatedAt: 1,
        });

        const result = await workflowStateService.createExecution('test-user', 'CAMPAIGN_LAUNCH', [
            { id: 'draft', agentId: 'social', prompt: 'Draft', priority: 'LOW' },
        ], [], undefined, 'canonical-artist');

        expect(result.id).toBe('exec-1');
        expect(mocks.callable).toHaveBeenCalledWith(expect.objectContaining({ workflowId: 'CAMPAIGN_LAUNCH', artistEntityId: 'canonical-artist' }));
    });

    it('refuses to start work for a different signed-in user', async () => {
        await expect(workflowStateService.createExecution('other-user', 'CAMPAIGN_LAUNCH', [], [])).rejects.toThrow('workflow owner');
        expect(mocks.callable).not.toHaveBeenCalled();
    });

    it('routes cancellation and resume through bounded backend actions', async () => {
        mocks.callable.mockResolvedValue({ data: { executionId: 'exec-1', status: 'CANCELLED' } });
        await workflowStateService.cancelExecution('test-user', 'exec-1');
        expect(mocks.callable).toHaveBeenCalledWith({ executionId: 'exec-1', action: 'cancel' });
        await workflowStateService.resumeExecution('test-user', 'exec-1');
        expect(mocks.callable).toHaveBeenLastCalledWith({ executionId: 'exec-1', action: 'resume' });
    });

    it('keeps workflow predictions unavailable for another user or non-canonical context', async () => {
        expect(await workflowStateService.getNextWorkflowPrediction('other-user', 'canonical-artist')).toBeNull();
        expect(await workflowStateService.getNextWorkflowPrediction('test-user', 'isrc:USAAA1234567')).toBeNull();
        expect(mocks.list).not.toHaveBeenCalled();
    });
});
