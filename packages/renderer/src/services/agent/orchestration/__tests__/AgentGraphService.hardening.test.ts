import { describe, it, expect, vi, beforeEach } from 'vitest';
import { agentGraphService } from '../AgentGraphService';
import { agentGraphStateService } from '../AgentGraphStateService';
import { agentService } from '../../AgentService';
import { memoryBankService } from '../../memory/MemoryBankService';
import { AgentGraph, AgentContext } from '../../types';
import { runTransaction } from 'firebase/firestore';

// Mock dependencies
vi.mock('../AgentGraphStateService', () => ({
    agentGraphStateService: {
        createExecution: vi.fn(),
        getExecution: vi.fn(),
        updateNodeStatus: vi.fn(),
        finalizeStatus: vi.fn(),
        updateExecutionMetadata: vi.fn(),
    },
}));

vi.mock('../../AgentService', () => ({
    agentService: {
        delegateTask: vi.fn(),
    },
}));

vi.mock('../../memory/MemoryBankService', () => ({
    memoryBankService: {
        searchMemories: vi.fn().mockResolvedValue({ results: [] }),
        addMemory: vi.fn().mockResolvedValue([{ id: 'mem-123' }]),
        indexGraphExecution: vi.fn().mockResolvedValue(undefined),
    },
}));

vi.mock('../../governance/AgentEventBus', () => ({
    AgentEventBus: {
        emitGraphEvent: vi.fn(),
        emitNodeEvent: vi.fn(),
    },
}));

describe('AgentGraphService Hardening & Concurrency Protection', () => {
    const mockUserId = 'user-123';
    const mockContext: AgentContext = { userId: mockUserId };

    const mockGraph: AgentGraph = {
        id: 'graph-hardening',
        name: 'Hardening Test Graph',
        description: 'Test graph for leases and trimming',
        entryNodeId: 'node-1',
        nodes: [
            { id: 'node-1', agentId: 'generalist', taskTemplate: 'Input: {{input}}', waitCondition: 'all' },
            { id: 'node-2', agentId: 'generalist', taskTemplate: 'Parent: {{node-1}}', waitCondition: 'all' }
        ],
        edges: [
            { sourceId: 'node-1', targetId: 'node-2' }
        ],
        metadata: { version: '1.0', author: 'test', createdAt: Date.now() }
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('rejects execution if execution is actively leased by another runner', async () => {
        const executionId = 'exec-leased';

        // Transaction mock returns an existing, active lease from another runner
        vi.mocked(runTransaction).mockImplementationOnce(async (_db, cb) => cb({
            get: vi.fn(async () => ({
                exists: true,
                data: () => ({
                    executionId,
                    lease: {
                        holderId: 'other-runner-id',
                        expiresAt: Date.now() + 15000, // active for 15 more seconds
                        acquiredAt: Date.now() - 5000,
                    },
                    nodeStates: {
                        'node-1': { status: 'PLANNED' },
                    },
                }),
            })),
            update: vi.fn(),
        } as any));

        await expect(
            agentGraphService.executeGraph(mockGraph, mockContext, 'Test', executionId)
        ).rejects.toThrow(/is locked by another runner/);
    });

    it('successfully acquires lease if existing lease is expired', async () => {
        const executionId = 'exec-expired-lease';
        const mockUpdate = vi.fn();

        const singleNodeGraph: AgentGraph = {
            id: 'graph-single',
            name: 'Single Node Graph',
            description: 'Single node',
            entryNodeId: 'node-1',
            nodes: [{ id: 'node-1', agentId: 'generalist', taskTemplate: 'Task 1', waitCondition: 'all' }],
            edges: [],
            metadata: { version: '1.0', author: 'test', createdAt: Date.now() }
        };

        vi.mocked(runTransaction).mockImplementation(async (_db, cb) => {
            return cb({
                get: vi.fn(async () => ({
                    exists: true,
                    data: () => ({
                        executionId,
                        // Expired lease (> 20s old)
                        lease: {
                            holderId: 'stale-runner-id',
                            expiresAt: Date.now() - 5000,
                            acquiredAt: Date.now() - 25000,
                        },
                        nodeStates: {
                            'node-1': { status: 'PLANNED' },
                        },
                    }),
                })),
                update: mockUpdate,
            } as any);
        });

        (agentGraphStateService.getExecution as any).mockResolvedValueOnce({
            executionId,
            status: 'EXECUTING',
            nodeStates: {
                'node-1': { status: 'PLANNED' },
            },
        }).mockResolvedValueOnce({
            executionId,
            status: 'COMPLETED',
            nodeStates: {
                'node-1': { status: 'STEP_COMPLETE', output: 'Node 1 Result' },
            },
        });

        vi.mocked(agentService.delegateTask).mockResolvedValue('Node 1 Result');

        await agentGraphService.executeGraph(singleNodeGraph, mockContext, 'Test', executionId);

        // Verify update was called with a new lease
        expect(mockUpdate).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({
                lease: expect.objectContaining({
                    expiresAt: expect.any(Number),
                })
            })
        );
    });

    it('trims oversized parent output in resolveNodePrompt to prevent context bloat', () => {
        const largeOutput = 'A'.repeat(25000);
        const state: any = {
            executionId: 'exec-trim',
            nodeStates: {
                'node-1': {
                    status: 'STEP_COMPLETE',
                    output: largeOutput,
                }
            }
        };

        const resolvedPrompt = (agentGraphService as any).resolveNodePrompt(
            mockGraph.nodes[1],
            mockGraph,
            state
        );

        // Prompt should be trimmed, not the full 25,000 characters
        expect(resolvedPrompt.length).toBeLessThan(15000);
        expect(resolvedPrompt).toContain('Output trimmed for context efficiency');
    });

    it('caps memory bank search to top 5 memories', async () => {
        const executionId = 'exec-mem-cap';

        const singleNodeGraph: AgentGraph = {
            id: 'graph-single-mem',
            name: 'Single Node Graph',
            description: 'Single node',
            entryNodeId: 'node-1',
            nodes: [{ id: 'node-1', agentId: 'generalist', taskTemplate: 'Task 1', waitCondition: 'all' }],
            edges: [],
            metadata: { version: '1.0', author: 'test', createdAt: Date.now() }
        };

        vi.mocked(runTransaction).mockImplementation(async (_db, cb) => cb({
            get: vi.fn(async () => ({
                exists: true,
                data: () => ({
                    executionId,
                    nodeStates: { 'node-1': { status: 'PLANNED' } },
                }),
            })),
            update: vi.fn(),
        } as any));

        (agentGraphStateService.getExecution as any).mockResolvedValueOnce({
            executionId,
            status: 'EXECUTING',
            nodeStates: { 'node-1': { status: 'PLANNED' } },
        }).mockResolvedValueOnce({
            executionId,
            status: 'COMPLETED',
            nodeStates: { 'node-1': { status: 'STEP_COMPLETE', output: 'Done' } },
        });

        vi.mocked(agentService.delegateTask).mockResolvedValue('Done');

        await agentGraphService.executeGraph(singleNodeGraph, mockContext, 'Test', executionId);

        // Verify searchMemories was called with limit 5 (not 100)
        expect(memoryBankService.searchMemories).toHaveBeenCalledWith(
            mockUserId,
            expect.any(String),
            5
        );
    });
});
