import { vi, describe, it, expect, beforeEach } from 'vitest';
import { createStore, StoreApi } from 'zustand';
import { buildAgentOrchestrationState, AgentOrchestrationSlice } from '../agentOrchestrationSlice';
import { onSnapshot, doc } from 'firebase/firestore';
import { auth } from '@/services/firebase';

// Mock Firebase services
vi.mock('firebase/firestore', () => ({
    doc: vi.fn((_db, ...paths) => ({ path: paths.join('/') })),
    onSnapshot: vi.fn((ref, callback) => {
        // Return a cleanup function
        return vi.fn();
    }),
    db: {}
}));

vi.mock('@/services/firebase', () => ({
    db: {},
    auth: {
        currentUser: { uid: 'test-user-id' }
    }
}));

describe('AgentOrchestrationSlice', () => {
    let useStore: StoreApi<AgentOrchestrationSlice>;

    beforeEach(() => {
        vi.clearAllMocks();
        useStore = createStore<AgentOrchestrationSlice>(buildAgentOrchestrationState);
    });

    it('should initialize with default state', () => {
        const state = useStore.getState();
        expect(state.activeGraphs).toEqual({});
        expect(state.activeGraphExecution).toBeNull();
        expect(state.activeGraphDefinition).toBeNull();
    });

    it('should update activeGraphDefinition via setActiveGraphDefinition', () => {
        const mockGraph = { id: 'graph-1', name: 'Test Graph', nodes: [], edges: [] } as any;
        useStore.getState().setActiveGraphDefinition(mockGraph);
        expect(useStore.getState().activeGraphDefinition).toEqual(mockGraph);
    });

    it('should update activeGraphExecution via setActiveGraphExecution', () => {
        const mockExecution = { executionId: 'exec-1', status: 'running' } as any;
        useStore.getState().setActiveGraphExecution(mockExecution);
        expect(useStore.getState().activeGraphExecution).toEqual(mockExecution);
    });

    it('should start listening to graph execution and update state on snapshot', async () => {
        const executionId = 'exec-123';
        const mockExecutionData = {
            executionId,
            status: 'running',
            nodes: {
                'node-1': { id: 'node-1', status: 'completed', result: 'hello' }
            },
            updatedAt: Date.now()
        };

        // Capture the snapshot callback
        let snapshotCallback: any;
        vi.mocked(onSnapshot).mockImplementation((_ref, cb: any) => {
            snapshotCallback = cb;
            return vi.fn(); // Unsubscribe mock
        });

        const store = useStore.getState();
        await store.startListeningToGraphExecution(executionId);

        // Verify doc path construction
        expect(doc).toHaveBeenCalledWith(expect.anything(), 'users', 'test-user-id', 'graphExecutions', executionId);
        expect(onSnapshot).toHaveBeenCalled();

        // Trigger snapshot update
        snapshotCallback({
            exists: () => true,
            data: () => mockExecutionData
        });

        expect(useStore.getState().activeGraphExecution).toEqual(mockExecutionData);
    });

    it('should stop listening and clear state when stopListeningToGraphExecution is called', async () => {
        const unsubscribe = vi.fn();
        vi.mocked(onSnapshot).mockReturnValue(unsubscribe);

        const store = useStore.getState();
        await store.startListeningToGraphExecution('exec-1');
        
        // Initial state set
        store.setActiveGraphExecution({ executionId: 'exec-1' } as any);
        expect(useStore.getState().activeGraphExecution).not.toBeNull();

        store.stopListeningToGraphExecution();

        expect(unsubscribe).toHaveBeenCalled();
        expect(useStore.getState().activeGraphExecution).toBeNull();
    });

    it('should handle missing document in snapshot', async () => {
        let snapshotCallback: any;
        vi.mocked(onSnapshot).mockImplementation((_ref, cb: any) => {
            snapshotCallback = cb;
            return vi.fn();
        });

        const store = useStore.getState();
        await store.startListeningToGraphExecution('exec-missing');

        // Set some initial data
        store.setActiveGraphExecution({ id: 'exists' } as any);

        // Trigger snapshot for non-existent doc
        snapshotCallback({
            exists: () => false
        });

        expect(useStore.getState().activeGraphExecution).toBeNull();
    });
});
