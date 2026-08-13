import { auth } from '@/services/firebase';
import {
    getAllWorkflowsFromStorage,
    getWorkflowFromStorage,
    saveWorkflowToStorage,
} from '@/services/storage/repository';
import { SavedWorkflow } from '../types';

const assertCurrentUser = (userId: string) => {
    if (!auth.currentUser || auth.currentUser.uid !== userId) {
        throw new Error('Workflows require the current authenticated user.');
    }
};

export const saveWorkflow = async (
    workflow: Omit<SavedWorkflow, 'id'> & { id?: string },
    userId: string,
): Promise<string> => {
    assertCurrentUser(userId);
    const id = workflow.id || crypto.randomUUID();
    const now = new Date().toISOString();
    const saved: SavedWorkflow = {
        ...workflow,
        id,
        createdAt: workflow.createdAt || now,
        updatedAt: now,
        nodes: structuredClone(workflow.nodes),
        edges: structuredClone(workflow.edges),
    };
    await saveWorkflowToStorage(saved as unknown as Record<string, unknown> & { id: string });
    return id;
};

export const getUserWorkflows = async (userId: string): Promise<SavedWorkflow[]> => {
    assertCurrentUser(userId);
    return await getAllWorkflowsFromStorage() as unknown as SavedWorkflow[];
};

export const loadWorkflow = async (workflowId: string): Promise<SavedWorkflow | null> => {
    const workflow = await getWorkflowFromStorage(workflowId);
    return (workflow as unknown as SavedWorkflow | undefined) ?? null;
};
