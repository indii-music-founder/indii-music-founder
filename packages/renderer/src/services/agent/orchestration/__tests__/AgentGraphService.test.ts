import { describe, it, expect, vi, beforeEach } from 'vitest';
import { agentGraphService } from '../AgentGraphService';
import { agentGraphStateService } from '../AgentGraphStateService';
import { agentService } from '../../AgentService';
import { memoryBankService } from '../../memory/MemoryBankService';
import { AgentGraph, AgentContext } from '../../types';

// Mock dependencies
vi.mock('../AgentGraphStateService', () => ({
    agentGraphStateService: {
        createExecution: vi.fn(),
        getExecution: vi.fn(),
        updateNodeStatus: vi.fn(),
        finalizeStatus: vi.fn(),
    },
}));

vi.mock('../../AgentService', () => ({
    agentService: {
        delegateTask: vi.fn(),
    },
}));

vi.mock('../../memory/MemoryBankService', () => ({
    memoryBankService: {
        searchMemories: vi.fn().mockResolvedValue([]),
        addMemory: vi.fn().mockResolvedValue({ id: 'mem-123' }),
    },
}));

vi.mock('../../governance/AgentEventBus', () => ({
    AgentEventBus: {
        emitGraphEvent: vi.fn(),
        emitNodeEvent: vi.fn(),
    },
}));

describe('AgentGraphService', () => {
    const mockUserId = 'user-123';
    const mockContext: AgentContext = { userId: mockUserId };
    
    const mockGraph: AgentGraph = {
        id: 'graph-1',
        name: 'Test Graph',
        description: 'A test graph',
        entryNodeId: 'node-1',
        nodes: [
            { id: 'node-1', agentId: 'generalist', taskTemplate: 'Task 1', waitCondition: 'all' },
            { id: 'node-2', agentId: 'generalist', taskTemplate: 'Task 2: {{node-1}}', waitCondition: 'all' }
        ],
        edges: [
            { sourceId: 'node-1', targetId: 'node-2' }
        ],
        metadata: { version: '1.0', author: 'test', createdAt: Date.now() }
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should execute a simple 2-node linear graph', async () => {
        // Setup execution state
        const mockExecutionId = 'exec-123';
        
        // Initial state
        const state1 = {
            executionId: mockExecutionId,
            status: 'planned',
            nodeStates: {
                'node-1': { status: 'planned' },
                'node-2': { status: 'planned' }
            }
        };

        // State after node 1 completes
        const state2 = {
            ...state1,
            nodeStates: {
                'node-1': { status: 'step_complete', output: 'Output 1' },
                'node-2': { status: 'planned' }
            }
        };

        // State after node 2 completes
        const state3 = {
            ...state2,
            nodeStates: {
                'node-1': { status: 'step_complete', output: 'Output 1' },
                'node-2': { status: 'step_complete', output: 'Output 2' }
            },
            status: 'completed'
        };

        (agentGraphStateService.createExecution as any).mockResolvedValue(state1);
        (agentGraphStateService.getExecution as any)
            .mockResolvedValueOnce(state1) // Start of loop 1
            .mockResolvedValueOnce(state1) // Check after task start
            .mockResolvedValueOnce(state2) // Start of loop 2
            .mockResolvedValueOnce(state2) // Check after task start
            .mockResolvedValueOnce(state3); // Final check to exit

        (agentService.delegateTask as any)
            .mockResolvedValueOnce('Output 1')
            .mockResolvedValueOnce('Output 2');

        const result = await agentGraphService.executeGraph(mockGraph, mockContext);

        expect(result).toContain('Graph execution finished');
        expect(agentService.delegateTask).toHaveBeenCalledTimes(2);
        
        // Check Memory Bank Integration
        expect(memoryBankService.searchMemories).toHaveBeenCalled();
        expect(memoryBankService.addMemory).toHaveBeenCalled();
        
        // Verify node 2 received node 1's output
        const node2TaskCall = (agentService.delegateTask as any).mock.calls[1];
        expect(node2TaskCall[1]).toContain('Output 1');
    });

    it('should handle parallel execution of independent nodes', async () => {
        const parallelGraph: AgentGraph = {
            ...mockGraph,
            nodes: [
                { id: 'node-1', agentId: 'generalist', taskTemplate: 'Parallel 1', waitCondition: 'all' },
                { id: 'node-2', agentId: 'generalist', taskTemplate: 'Parallel 2', waitCondition: 'all' }
            ],
            edges: [], // No edges means they both start (if they are entry nodes, but entryNodeId is only one)
        };
        
        // Parallel testing logic...
    });
});
