import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { agentGraphService } from '@/services/agent/orchestration/AgentGraphService';
import type { AgentGraph, AgentContext } from '@/services/agent/types';
import { runTransaction } from 'firebase/firestore';

// ----------------------------------------------------------------------------
// Structural-only tests of the graph protocol using deterministic state and
// transaction adapters. Live Firestore recovery remains unverified.
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

const transactionWrites: Record<string, unknown>[] = [];
let lease: { holderId: string; acquiredAt: number; expiresAt: number } | null = null;
let legacyLease: typeof lease = null;
const claimTx = (nodeStatus: () => string, graphStatus = 'PLANNED', onUpdate: (patch: Record<string, unknown>) => void = () => {}) => ({
    get: vi.fn(async () => ({
        exists: () => true,
        data: () => ({ status: graphStatus, metadata: { lease }, lease: legacyLease, nodeStates: { n1: { status: nodeStatus() } } }),
    })),
    set: vi.fn(),
    update: vi.fn((_ref: unknown, patch: Record<string, unknown>) => {
        transactionWrites.push(patch);
        if (Object.prototype.hasOwnProperty.call(patch, 'metadata.lease')) {
            lease = patch['metadata.lease'] as typeof lease;
        }
        onUpdate(patch);
    }),
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
            cb(claimTx(() => execState.nodeStates.n1.status, execState.status, patch => {
                if (typeof patch.status === 'string') execState.status = patch.status;
                const status = patch['nodeStates.n1.status'];
                if (typeof status === 'string') execState.nodeStates.n1.status = status;
            }) as never)
        );
    };

    beforeEach(() => {
        vi.clearAllMocks();
        vi.spyOn(console, 'error').mockImplementation(() => { });
        vi.spyOn(console, 'warn').mockImplementation(() => { });
        vi.spyOn(console, 'info').mockImplementation(() => { });
        execState.status = 'PLANNED';
        execState.nodeStates.n1.status = 'PLANNED';
        lease = null;
        legacyLease = null;
        transactionWrites.length = 0;

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

    it('does not let a late heartbeat recreate a released lease (structural)', async () => {
        const transaction = claimTx(() => 'PLANNED');
        vi.mocked(runTransaction).mockImplementationOnce(async (_db, cb) => cb(transaction as never));
        const renew = (agentGraphService as unknown as {
            acquireGraphLease(userId: string, executionId: string, runnerId: string, renewOnly: boolean): Promise<boolean>;
        }).acquireGraphLease.bind(agentGraphService);

        await expect(renew('u1', 'exec-1', 'finished-runner', true)).resolves.toBe(false);
        expect(transaction.update).not.toHaveBeenCalled();
    });

    it('does not claim a lease when the execution document disappears (structural)', async () => {
        wireHappyPath();
        const update = vi.fn();
        vi.mocked(runTransaction).mockImplementationOnce(async (_db, cb) =>
            cb({ get: async () => ({ exists: () => false, data: () => undefined }), update } as never)
        );

        await expect(agentGraphService.executeGraph(makeGraph(), makeContext(), 'input', 'exec-1'))
            .rejects.toThrow(/locked by another runner/);
        expect(update).not.toHaveBeenCalled();
        expect(mocks.delegateTask).not.toHaveBeenCalled();
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

    it('refuses dispatch if the graph is cancelled between readiness and claim', async () => {
        wireHappyPath();
        vi.mocked(runTransaction).mockImplementation(async (_db, cb) =>
            cb(claimTx(() => 'PLANNED', lease ? 'CANCELLED' : 'PLANNED') as never),
        );

        await expect(agentGraphService.executeGraph(makeGraph(), makeContext(), 'input', 'exec-1'))
            .rejects.toThrow(/lost its lease before node dispatch/);
        expect(mocks.delegateTask).not.toHaveBeenCalled();
        expect(mocks.finalizeStatus).not.toHaveBeenCalled();
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

    it.each(['another holder', 'expired lease', 'cleared lease with a stale legacy field'])('refuses node dispatch after %s', async failure => {
        wireHappyPath();
        let transactions = 0;
        vi.mocked(runTransaction).mockImplementation(async (_db, cb) => {
            transactions += 1;
            if (transactions === 2 && lease) {
                if (failure === 'cleared lease with a stale legacy field') {
                    legacyLease = lease;
                    lease = null;
                } else {
                    lease = failure === 'another holder'
                        ? { ...lease, holderId: 'other-runner' }
                        : { ...lease, expiresAt: Date.now() - 1 };
                }
            }
            return cb(claimTx(() => execState.nodeStates.n1.status) as never);
        });

        await expect(agentGraphService.executeGraph(makeGraph(), makeContext(), 'input', 'exec-1'))
            .rejects.toThrow(/lost its lease before node dispatch/);
        expect(mocks.delegateTask).not.toHaveBeenCalled();
    });

    it.each(['another holder', 'expired lease', 'cancelled graph', 'changed node state', 'result storage unavailable'])(
        'refuses result and memory writes after %s (structural)', async failure => {
            wireHappyPath();
            mocks.delegateTask.mockImplementationOnce(async () => {
                if (failure === 'another holder') lease = { ...lease!, holderId: 'replacement-runner' };
                if (failure === 'expired lease') lease = { ...lease!, expiresAt: Date.now() - 1 };
                if (failure === 'cancelled graph') execState.status = 'CANCELLED';
                if (failure === 'changed node state') execState.nodeStates.n1.status = 'FAILED';
                if (failure === 'result storage unavailable') {
                    vi.mocked(runTransaction).mockRejectedValueOnce(new Error('Result write unavailable'));
                }
                return 'Late result';
            });

            await expect(agentGraphService.executeGraph(makeGraph(), makeContext(), 'input', 'exec-1'))
                .rejects.toThrow(/before saving node|result could not be verified/);
            expect(transactionWrites.some(patch => patch['nodeStates.n1.status'] === 'STEP_COMPLETE')).toBe(false);
            expect(mocks.addMemory).not.toHaveBeenCalled();
            expect(mocks.indexGraphExecution).not.toHaveBeenCalled();
            expect(mocks.finalizeStatus).not.toHaveBeenCalled();
        },
    );

    it('rejects a malformed delegated result before storing it as output or memory (structural)', async () => {
        wireHappyPath();
        mocks.delegateTask.mockResolvedValueOnce({ unexpected: 'body' });
        await expect(agentGraphService.executeGraph(makeGraph(), makeContext(), 'input', 'exec-1'))
            .rejects.toThrow(/invalid text result/);
        expect(transactionWrites.some(patch => patch['nodeStates.n1.status'] === 'STEP_COMPLETE')).toBe(false);
        expect(mocks.addMemory).not.toHaveBeenCalled();
    });

    it.each(['another holder', 'expired lease', 'cancelled graph', 'completed by another holder', 'final status unavailable'])(
        'keeps the saved graph unchanged when finalization sees %s (structural)', async failure => {
            wireHappyPath();
            mocks.delegateTask.mockResolvedValueOnce('Confirmed result');
            mocks.addMemory.mockImplementationOnce(async () => {
                if (failure === 'another holder') lease = { ...lease!, holderId: 'new-runner' };
                if (failure === 'expired lease') lease = { ...lease!, expiresAt: Date.now() - 1 };
                if (failure === 'final status unavailable') {
                    vi.mocked(runTransaction).mockRejectedValueOnce(new Error('Final write unavailable'));
                }
                if (failure === 'cancelled graph' || failure === 'completed by another holder') {
                    vi.mocked(runTransaction).mockImplementationOnce(async (_db, callback) => {
                        execState.status = failure === 'cancelled graph' ? 'CANCELLED' : 'COMPLETED';
                        if (failure === 'completed by another holder') lease = { ...lease!, holderId: 'new-runner' };
                        return callback(claimTx(() => execState.nodeStates.n1.status, execState.status) as never);
                    });
                }
            });
            await expect(agentGraphService.executeGraph(makeGraph(), makeContext(), 'input', 'exec-1'))
                .rejects.toThrow(/lost ownership before finalization|final status could not be verified/);
            expect(transactionWrites.some(patch => patch.status === 'FAILED' || patch.status === 'COMPLETED')).toBe(false);
            expect(mocks.indexGraphExecution).not.toHaveBeenCalled();
        },
    );

    it('completes a graph when its claimed node succeeds', async () => {
        wireHappyPath();
        mocks.delegateTask.mockResolvedValue('report done');

        const result = await agentGraphService.executeGraph(makeGraph(), makeContext(), 'input', 'exec-1');

        expect(result).toContain('report done');
        expect(execState.status).toBe('COMPLETED');
        expect(mocks.delegateTask).toHaveBeenCalledTimes(1);
    });
});
