import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SavedWorkflow } from '../types';

const { getAllWorkflowsFromStorage, getWorkflowFromStorage, saveWorkflowToStorage, auth } = vi.hoisted(() => ({
    getAllWorkflowsFromStorage: vi.fn(),
    getWorkflowFromStorage: vi.fn(),
    saveWorkflowToStorage: vi.fn(),
    auth: { currentUser: { uid: 'artist-1' } as { uid: string } | null },
}));

vi.mock('@/services/firebase', () => ({ auth }));
vi.mock('@/services/storage/repository', () => ({
    getAllWorkflowsFromStorage,
    getWorkflowFromStorage,
    saveWorkflowToStorage,
}));

import { getUserWorkflows, loadWorkflow, saveWorkflow } from './workflowPersistence';

const workflow: SavedWorkflow = {
    id: 'workflow-1',
    name: 'Release campaign',
    description: 'A real saved workflow',
    nodes: [],
    edges: [],
    viewport: { x: 0, y: 0, zoom: 1 },
    createdAt: '2026-08-13T00:00:00.000Z',
    updatedAt: '2026-08-13T00:00:00.000Z',
};

describe('workflow persistence repository alignment', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        auth.currentUser = { uid: 'artist-1' };
    });

    it('lists workflows from the same repository used by the editor', async () => {
        getAllWorkflowsFromStorage.mockResolvedValue([workflow]);
        await expect(getUserWorkflows('artist-1')).resolves.toEqual([workflow]);
        expect(getAllWorkflowsFromStorage).toHaveBeenCalledOnce();
    });

    it('saves and reloads through the shared repository', async () => {
        saveWorkflowToStorage.mockResolvedValue(undefined);
        getWorkflowFromStorage.mockResolvedValue(workflow);

        await expect(saveWorkflow(workflow, 'artist-1')).resolves.toBe('workflow-1');
        expect(saveWorkflowToStorage).toHaveBeenCalledWith(expect.objectContaining({ id: 'workflow-1' }));
        await expect(loadWorkflow('workflow-1')).resolves.toEqual(workflow);
    });

    it('rejects cross-account workflow listing', async () => {
        await expect(getUserWorkflows('different-user')).rejects.toThrow('current authenticated user');
        expect(getAllWorkflowsFromStorage).not.toHaveBeenCalled();
    });
});
