import { vi, describe, it, expect, beforeEach } from 'vitest';
import { createStore } from 'zustand';
import { createAgentSlice, AgentSlice } from './agentSlice';
import { agentRegistry } from '@/services/agent/registry';

// Mock agentRegistry
vi.mock('@/services/agent/registry', () => ({
    agentRegistry: {
        getAll: vi.fn()
    }
}));

describe('AgentSlice - Available Agents', () => {
    // Correctly type the store creator
    let useStore: ReturnType<typeof createStore<AgentSlice>>;

    beforeEach(() => {
        vi.clearAllMocks();
        // createStore returns the store hook/api, we can cast if needed or use inferred types
        useStore = createStore<AgentSlice>((...a) => createAgentSlice(...a));
    });

    it('should load agents from registry successfully', async () => {
        const mockAgents = [
            { id: 'marketing', name: 'Marketing', description: 'Desc', color: 'red', category: 'manager' },
            { id: 'legal', name: 'Legal', description: 'Desc', color: 'blue', category: 'specialist' }
        ];

        // Mock return value
        vi.mocked(agentRegistry.getAll).mockReturnValue(mockAgents as any);

        const store = useStore.getState();

        expect(store.availableAgents).toEqual([]);
        expect(store.isLoadingAgents).toBe(false);

        const promise = store.loadAgents();

        expect(useStore.getState().agentsError).toBeNull();

        await promise;

        expect(agentRegistry.getAll).toHaveBeenCalled();
        expect(useStore.getState().availableAgents).toEqual(mockAgents);
        expect(useStore.getState().isLoadingAgents).toBe(false);
    });

    it('should handle errors when loading agents', async () => {
        vi.mocked(agentRegistry.getAll).mockImplementation(() => {
            throw new Error('Registry failed');
        });

        const store = useStore.getState();
        await store.loadAgents();

        expect(useStore.getState().availableAgents).toEqual([]);
        expect(useStore.getState().isLoadingAgents).toBe(false);
        expect(useStore.getState().agentsError).toBe('Registry failed');
    });

    it('should filter out invalid agents based on schema', async () => {
         const mockAgents = [
            { id: 'marketing', name: 'Marketing', description: 'Desc', color: 'red', category: 'manager' },
            { id: 'invalid', name: 'Invalid' } // Missing fields
        ];

        vi.mocked(agentRegistry.getAll).mockReturnValue(mockAgents as any);

        const store = useStore.getState();
        await store.loadAgents();

        expect(useStore.getState().availableAgents).toHaveLength(1);
        expect(useStore.getState().availableAgents[0].id).toBe('marketing');
    });
});
