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
            .mockResolvedValueOnce(state1) // Start of loop 1: node-1
            .mockResolvedValueOnce(state2) // Start of loop 2: node-2
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
            id: 'parallel-graph',
            nodes: [
                { id: 'node-1', agentId: 'generalist', taskTemplate: 'Start', waitCondition: 'all' },
                { id: 'node-2', agentId: 'generalist', taskTemplate: 'Parallel A', waitCondition: 'all' },
                { id: 'node-3', agentId: 'generalist', taskTemplate: 'Parallel B', waitCondition: 'all' },
            ],
            edges: [
                { sourceId: 'node-1', targetId: 'node-2' },
                { sourceId: 'node-1', targetId: 'node-3' },
            ],
        };

        const mockExecutionId = 'exec-parallel';
        const state1 = {
            executionId: mockExecutionId,
            status: 'planned',
            nodeStates: {
                'node-1': { status: 'planned' },
                'node-2': { status: 'planned' },
                'node-3': { status: 'planned' },
            }
        };

        const state2 = {
            ...state1,
            nodeStates: {
                'node-1': { status: 'step_complete', output: 'Done 1' },
                'node-2': { status: 'planned' },
                'node-3': { status: 'planned' },
            }
        };

        const state3 = {
            ...state2,
            nodeStates: {
                'node-1': { status: 'step_complete', output: 'Done 1' },
                'node-2': { status: 'step_complete', output: 'Done 2' },
                'node-3': { status: 'step_complete', output: 'Done 3' },
            },
            status: 'completed'
        };

        (agentGraphStateService.createExecution as any).mockResolvedValue(state1);
        (agentGraphStateService.getExecution as any)
            .mockResolvedValueOnce(state1) // Loop 1: node 1
            .mockResolvedValueOnce(state2) // Loop 2: node 2 & 3
            .mockResolvedValueOnce(state3); // Exit

        (agentService.delegateTask as any)
            .mockResolvedValueOnce('Done 1')
            .mockResolvedValueOnce('Done 2')
            .mockResolvedValueOnce('Done 3');

        await agentGraphService.executeGraph(parallelGraph, mockContext);

        // Verify that node 2 and 3 were started together in Loop 2
        // Loop 1 called delegateTask for node 1
        // Loop 2 should have called delegateTask for both node 2 and node 3
        expect(agentService.delegateTask).toHaveBeenCalledTimes(3);
        
        // The first call was node 1
        expect((agentService.delegateTask as any).mock.calls[0][1]).toBe('Start');
        
        // The next two calls should be node 2 and 3
        const task2Prompt = (agentService.delegateTask as any).mock.calls[1][1];
        const task3Prompt = (agentService.delegateTask as any).mock.calls[2][1];
        expect(task2Prompt).toBe('Parallel A');
        expect(task3Prompt).toBe('Parallel B');
    });

    it('should handle conditional branching (regex matching)', async () => {
        const conditionalGraph: AgentGraph = {
            ...mockGraph,
            id: 'conditional-graph',
            nodes: [
                { id: 'node-1', agentId: 'generalist', taskTemplate: 'Evaluate', waitCondition: 'all' },
                { id: 'node-2', agentId: 'generalist', taskTemplate: 'Success Path', waitCondition: 'all' },
                { id: 'node-3', agentId: 'generalist', taskTemplate: 'Failure Path', waitCondition: 'all' },
            ],
            edges: [
                { sourceId: 'node-1', targetId: 'node-2', condition: 'SUCCESS' },
                { sourceId: 'node-1', targetId: 'node-3', condition: 'FAILURE' },
            ],
        };

        const mockExecutionId = 'exec-conditional';
        const state1 = {
            executionId: mockExecutionId,
            status: 'planned',
            nodeStates: {
                'node-1': { status: 'planned' },
                'node-2': { status: 'planned' },
                'node-3': { status: 'planned' },
            }
        };

        // Node 1 returns "SUCCESS"
        const state2 = {
            ...state1,
            nodeStates: {
                'node-1': { status: 'step_complete', output: 'The result is SUCCESS' },
                'node-2': { status: 'planned' },
                'node-3': { status: 'planned' },
            }
        };

        // Node 2 starts, Node 3 skipped
        const state3 = {
            ...state2,
            nodeStates: {
                'node-1': { status: 'step_complete', output: 'The result is SUCCESS' },
                'node-2': { status: 'step_complete', output: 'Success Output' },
                'node-3': { status: 'skipped' },
            },
            status: 'completed'
        };

        (agentGraphStateService.createExecution as any).mockResolvedValue(state1);
        (agentGraphStateService.getExecution as any)
            .mockResolvedValueOnce(state1) // Loop 1: node 1
            .mockResolvedValueOnce(state2) // Loop 2: node 2 executes, node 3 skips
            .mockResolvedValueOnce(state3);

        (agentService.delegateTask as any)
            .mockResolvedValueOnce('The result is SUCCESS')
            .mockResolvedValueOnce('Success Output');

        await agentGraphService.executeGraph(conditionalGraph, mockContext);

        expect(agentService.delegateTask).toHaveBeenCalledTimes(2);
        expect(agentGraphStateService.updateNodeStatus).toHaveBeenCalledWith(
            mockUserId, mockExecutionId, 'node-3', expect.objectContaining({ status: 'skipped' })
        );
    });

    it('should fail the graph if a node fails', async () => {
        const simpleGraph: AgentGraph = {
            ...mockGraph,
            nodes: [{ id: 'node-1', agentId: 'generalist', taskTemplate: 'Task 1', waitCondition: 'all' }],
            edges: [],
        };

        const mockExecutionId = 'exec-fail';
        const state1 = {
            executionId: mockExecutionId,
            status: 'planned',
            nodeStates: { 'node-1': { status: 'planned' } }
        };

        (agentGraphStateService.createExecution as any).mockResolvedValue(state1);
        (agentGraphStateService.getExecution as any)
            .mockResolvedValueOnce(state1);

        (agentService.delegateTask as any).mockRejectedValue(new Error('Agent Crash'));

        await expect(agentGraphService.executeGraph(simpleGraph, mockContext))
            .rejects.toThrow('Agent Crash');

        expect(agentGraphStateService.finalizeStatus).toHaveBeenCalledWith(
            mockUserId, mockExecutionId, 'failed'
        );
    });

    it('should resume a previously interrupted graph execution', async () => {
        const resumeGraphDef: AgentGraph = {
            ...mockGraph,
            id: 'resume-graph',
            nodes: [
                { id: 'node-1', agentId: 'generalist', taskTemplate: 'Task 1', waitCondition: 'all' },
                { id: 'node-2', agentId: 'generalist', taskTemplate: 'Task 2', waitCondition: 'all' },
            ],
            edges: [{ sourceId: 'node-1', targetId: 'node-2' }],
        };

        const mockExecutionId = 'exec-resume';
        
        // Initial state: node-1 complete, node-2 planned
        const state1 = {
            graphId: 'resume-graph',
            executionId: mockExecutionId,
            status: 'executing',
            nodeStates: {
                'node-1': { status: 'step_complete', output: 'Output 1' },
                'node-2': { status: 'planned' },
            }
        };

        // Final state
        const state2 = {
            ...state1,
            nodeStates: {
                'node-1': { status: 'step_complete', output: 'Output 1' },
                'node-2': { status: 'step_complete', output: 'Output 2' },
            },
            status: 'executing'
        };

        (agentGraphStateService.getExecution as any)
            .mockResolvedValueOnce(state1) // resumeGraph setup
            .mockResolvedValueOnce(state1) // Loop 1: finds node-2 ready
            .mockResolvedValueOnce(state2); // Loop 2: exit (status is completed)

        (agentService.delegateTask as any).mockResolvedValue('Output 2');

        // We need to provide the graph to AgentGraphService somehow or let it be passed to resumeGraph
        // For now, let's update resumeGraph signature in implementation or mock it.
        await agentGraphService.resumeGraph(mockExecutionId, mockContext, resumeGraphDef);

        expect(agentService.delegateTask).toHaveBeenCalledTimes(1);
        expect((agentService.delegateTask as any).mock.calls[0][1]).toBe('Task 2');
        expect(agentGraphStateService.finalizeStatus).toHaveBeenCalledWith(
            mockUserId, mockExecutionId, 'completed'
        );
    });
});
