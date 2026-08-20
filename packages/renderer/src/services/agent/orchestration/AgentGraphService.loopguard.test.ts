import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { agentGraphService } from './AgentGraphService';
import type { AgentGraph, AgentContext } from '@/services/agent/types';
import { runTransaction } from 'firebase/firestore';

// ----------------------------------------------------------------------------
// Mocks — the graph loop needs the state service, the agent runner, memory,
// and a controllable Firestore transaction to prove exactly-once claims.
// The global test setup mocks firebase/firestore; runTransaction is
// overridden per test below.
// ----------------------------------------------------------------------------

const mocks = vi.hoisted(() => ({
    delegateTask: vi.fn(),
    getExecution: vi.fn(),
    createExecution: vi.fn(),
    updateExecutionMetadata: vi.fn(),
    updateNodeStatus: vi.fn(),
    finalizeStatus: vi.fn(),
    searchMemories: vi.fn(),
    addMemory: vi.fn(),
    indexGraphExecution: vi.fn(),
}));

vi.mock('@/services/agent/AgentService', () => ({
    agentService: { delegateTask: mocks.delegateTask },
}));

vi.mock('@/services/agent/orchestration/AgentGraphStateService', () => ({
    agentGraphStateService: {
        getExecution: mocks.getExecution,
        createExecution: mocks.createExecution,
        updateExecutionMetadata: mocks.updateExecutionMetadata,
        updateNodeStatus: mocks.updateNodeStatus,
        finalizeStatus: mocks.finalizeStatus,
    },
}));

vi.mock('@/services/agent/memory/MemoryBankService', () => ({
    memoryBankService: {
        searchMemories: mocks.searchMemories,
        addMemory: mocks.addMemory,
        indexGraphExecution: mocks.indexGraphExecution,
    },
}));

// ----------------------------------------------------------------------------
// Fixtures
// ----------------------------------------------------------------------------

const makeGraph = (): AgentGraph => ({
    id: 'graph-1',
    name: 'Test Graph',
    description: 'single entry node',
    entryNodeId: 'n1',
    nodes: [{
        id: 'n1',
        agentId: 'finance',
        taskTemplate: 'do the thing',
        waitCondition: 'any',
    }],
    edges: [],
    metadata: { version: '1', author: 'test', createdAt: 1 },
});

const makeContext = (): AgentContext => ({ userId: 'u1', traceId: 't1' });

const claimTx = (nodeStatus: () => string) => ({
    get: vi.fn(async () => ({
        exists: true,
        data: () => ({ status: 'PLANNED', nodeStates: { n1: { status: nodeStatus() } } }),
    })),
    set: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
});

describe('AgentGraphService loop guard and atomic claims', () => {
    // Mutable execution state the loop reads back each iteration.
    const execState = {
        executionId: 'exec-1',
        graphId: 'graph-1',
        status: 'PLANNED' as string,
        metadata: { initialInput: 'input' },
        nodeStates: { n1: { status: 'PLANNED' as string } },
    };

    const wireHappyPath = () => {
        mocks.getExecution.mockImplementation(async () => ({
            ...execState,
            nodeStates: { n1: { ...execState.nodeStates.n1 } },
        }));
        mocks.updateNodeStatus.mockImplementation(async (_u, _e, nodeId, updates) => {
            execState.nodeStates[nodeId] = { ...execState.nodeStates[nodeId], ...updates };
        });
        // The claim transaction sees whatever the last write left.
        vi.mocked(runTransaction).mockImplementation(async (_db, cb) =>
            cb(claimTx(() => execState.nodeStates.n1.status) as never)
        );
    };

    beforeEach(() => {
        vi.clearAllMocks();
        vi.spyOn(console, 'error').mockImplementation(() => { });
        vi.spyOn(console, 'warn').mockImplementation(() => { });
        vi.spyOn(console, 'info').mockImplementation(() => { });
        execState.status = 'PLANNED';
        execState.nodeStates.n1.status = 'PLANNED';

        mocks.searchMemories.mockResolvedValue({ results: [] });
        mocks.addMemory.mockResolvedValue(undefined);
        mocks.indexGraphExecution.mockResolvedValue(undefined);
        mocks.updateExecutionMetadata.mockResolvedValue(undefined);
        mocks.updateNodeStatus.mockResolvedValue(undefined);
        mocks.finalizeStatus.mockImplementation(async (_u, _e, status) => {
            execState.status = status;
        });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('refuses a second loop for an execution that already has one running', async () => {
        wireHappyPath();
        let releaseDelegate: (value: string) => void = () => { };
        mocks.delegateTask.mockImplementation(() => new Promise<string>(resolve => {
            releaseDelegate = resolve;
        }));

        const first = agentGraphService.executeGraph(makeGraph(), makeContext(), 'input', 'exec-1');
        await vi.waitFor(() => expect(mocks.delegateTask).toHaveBeenCalledTimes(1));

        // A resume/retry while the loop is live must not start a second loop.
        await expect(
            agentGraphService.executeGraph(makeGraph(), makeContext(), 'input', 'exec-1')
        ).rejects.toThrow(/already has an active loop/);

        releaseDelegate('done');
        await expect(first).resolves.toContain('Final output snippet');
    });

    it('never executes a node whose atomic claim lost to another loop', async () => {
        wireHappyPath();
        mocks.delegateTask.mockResolvedValue('done');

        // The claim transaction always sees the node already claimed
        // (EXECUTING_GENERATION) — a concurrent loop won the race. The loop
        // must NOT execute it; with no claimable node it eventually hits the
        // iteration safety cap and fails cleanly.
        vi.mocked(runTransaction).mockImplementation(async (_db, cb) =>
            cb(claimTx(() => 'EXECUTING_GENERATION') as never)
        );

        await expect(
            agentGraphService.executeGraph(makeGraph(), makeContext(), 'input', 'exec-1')
        ).rejects.toThrow(/Maximum graph iterations exceeded/);

        expect(mocks.delegateTask).not.toHaveBeenCalled();
    });

    it('completes a graph when its claimed node succeeds', async () => {
        wireHappyPath();
        mocks.delegateTask.mockResolvedValue('report done');

        const result = await agentGraphService.executeGraph(makeGraph(), makeContext(), 'input', 'exec-1');

        expect(result).toContain('report done');
        expect(execState.status).toBe('COMPLETED');
        expect(mocks.delegateTask).toHaveBeenCalledTimes(1);
    });
});
