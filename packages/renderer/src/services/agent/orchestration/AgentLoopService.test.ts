import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AgentLoopService, agentLoopService } from './AgentLoopService';
import { maestroBatchingService } from '../MaestroBatchingService';
import { judgeTransientError } from '@/config/typesafeJudgments';
import { AgentLoopDefinition, AgentLoopTriggerEnum, AgentLoopJudgeModeEnum, AgentLoopStatusEnum } from '@indii/shared';
import { executionTokenBudget } from '../governance/ExecutionTokenBudget';
import { FirestoreService } from '../../FirestoreService';

const snapshotOf = (definition: AgentLoopDefinition) => ({
    id: definition.id,
    trigger: definition.trigger,
    goal: definition.goal,
    verifiabilityCriteria: definition.verifiabilityCriteria,
    judgeMode: definition.judgeMode,
    maxIterations: definition.maxIterations,
});

// Mock dependencies
vi.mock('../MaestroBatchingService', () => ({
    maestroBatchingService: {
        executeBatch: vi.fn(),
    }
}));

vi.mock('@/config/typesafeJudgments', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@/config/typesafeJudgments')>();
    return {
        ...actual,
        judgeTransientError: vi.fn(actual.judgeTransientError),
    };
});

const mockGenerateContent = vi.fn();
vi.mock('@/services/intelligence/FirebaseIntelligenceService', () => ({
    FirebaseIntelligenceService: {
        getInstance: () => ({
            generateContent: mockGenerateContent,
        })
    }
}));

// Structural persistence adapter: independent snapshots and revision conflicts,
// not evidence of live Firestore or a real user's recovery journey.
const durableExecutions = new Map<string, Record<string, unknown>>();
function servicePath(service: unknown, id: string) {
    return `${(service as { collectionPath: string }).collectionPath}/${id}`;
}
function seedExecution<T extends { id: string }>(execution: T, owner = 'user1') {
    (agentLoopService as unknown as { executionStore: Map<string, unknown> }).executionStore.set(execution.id, execution);
    durableExecutions.set(`users/${owner}/agentLoopExecutions/${execution.id}`, structuredClone(execution) as Record<string, unknown>);
}
async function saveCheckpoint(this: FirestoreService, id: string, data: Record<string, unknown>, field: string, expected: number | null) {
    const key = servicePath(this, id);
    const saved = durableExecutions.get(key);
    const revision = saved ? saved[field] ?? 0 : null;
    if (revision !== expected) throw new Error('Document checkpoint revision changed');
    const next = (expected ?? 0) + 1;
    durableExecutions.set(key, structuredClone({ ...data, [field]: next }));
    return next;
}

describe('AgentLoopService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        durableExecutions.clear();
        vi.spyOn(FirestoreService.prototype, 'setIfRevision').mockImplementation(saveCheckpoint);
        vi.spyOn(FirestoreService.prototype, 'get').mockImplementation(async function (id) {
            const saved = durableExecutions.get(servicePath(this, id));
            return saved ? structuredClone(saved) : null;
        });
    });
    afterEach(() => vi.restoreAllMocks());

    it.each([0, 1.5, Infinity, Number.MAX_SAFE_INTEGER + 1])('rejects an invalid start iteration limit (%s)', async maxIterations => {
        const definition: AgentLoopDefinition = {
            id: 'invalid-limit', trigger: 'MANUAL', goal: 'Review', verifiabilityCriteria: 'Complete',
            judgeMode: 'LLM_EVALUATION', maxIterations, createdAt: 1, updatedAt: 1,
        };
        await expect(agentLoopService.startLoop(definition, { userId: 'user1' }))
            .rejects.toThrow('positive safe integer');
        expect(FirestoreService.prototype.setIfRevision).not.toHaveBeenCalled();
        expect(maestroBatchingService.executeBatch).not.toHaveBeenCalled();
    });

    it('rejects direct resume of an exhausted loop before writing a checkpoint', async () => {
        const definition: AgentLoopDefinition = {
            id: 'exhausted-loop', trigger: 'MANUAL', goal: 'Review', verifiabilityCriteria: 'Complete',
            judgeMode: 'LLM_EVALUATION', maxIterations: 1, createdAt: 1, updatedAt: 1,
        };
        seedExecution({
            id: 'exhausted-execution', loopId: definition.id, definitionSnapshot: snapshotOf(definition),
            status: 'FAILED', currentIteration: 2, history: [], tokenBudgetSpent: 0,
            actionCheckpoint: { phase: 'READY', iteration: 2 }, createdAt: 1, updatedAt: 1,
        });
        await expect(agentLoopService.resumeLoop(definition, 'exhausted-execution', { userId: 'user1' }))
            .rejects.toThrow('no iterations left');
        expect(FirestoreService.prototype.setIfRevision).not.toHaveBeenCalled();
        expect(maestroBatchingService.executeBatch).not.toHaveBeenCalled();
    });

    it('lists only checkpoints eligible for recovery', async () => {
        const ready = {
            id: 'ready', loopId: 'loop', status: 'IDLE' as const, currentIteration: 1,
            history: [], createdAt: 1, updatedAt: 1, tokenBudgetSpent: 0,
            definitionSnapshot: {
                id: 'loop', trigger: 'SCHEDULE' as const, goal: 'Review', verifiabilityCriteria: 'Complete',
                judgeMode: 'LLM_EVALUATION' as const, maxIterations: 1,
            },
            actionCheckpoint: { phase: 'READY' as const, iteration: 1 },
        };
        vi.spyOn(FirestoreService.prototype, 'list').mockResolvedValue([
            ready,
            { ...ready, id: 'legacy', definitionSnapshot: undefined },
            { ...ready, id: 'no-budget', tokenBudgetSpent: undefined },
            { ...ready, id: 'claimed', actionCheckpoint: { phase: 'DISPATCHING', iteration: 1, prompt: 'Review' } },
            { ...ready, id: 'exhausted', currentIteration: 2, actionCheckpoint: { phase: 'READY', iteration: 2 } },
        ]);
        expect(await agentLoopService.getResumableLoops('user1')).toEqual([ready]);
    });

    it('allows only one dispatch when independent clients resume the same revision', async () => {
        const definition: AgentLoopDefinition = {
            id: 'cross-client-loop', trigger: AgentLoopTriggerEnum.enum.MANUAL,
            goal: 'Execute once', verifiabilityCriteria: 'Complete',
            judgeMode: AgentLoopJudgeModeEnum.enum.LLM_EVALUATION, maxIterations: 1,
            createdAt: 1000, updatedAt: 1000,
        };
        const saved = {
            id: 'cross-client-execution', loopId: definition.id, definitionSnapshot: snapshotOf(definition),
            status: AgentLoopStatusEnum.enum.FAILED, currentIteration: 1, history: [], tokenBudgetSpent: 0,
            checkpointRevision: 1, actionCheckpoint: { phase: 'READY' as const, iteration: 1 },
            createdAt: 1000, updatedAt: 1000,
        };
        seedExecution(saved);
        const first = new AgentLoopService();
        const second = new AgentLoopService();
        let finishAction!: (value: Awaited<ReturnType<typeof maestroBatchingService.executeBatch>>) => void;
        vi.mocked(maestroBatchingService.executeBatch).mockImplementationOnce(() => new Promise(resolve => { finishAction = resolve; }));
        mockGenerateContent.mockResolvedValueOnce({ response: { text: () => JSON.stringify({ passed: true, feedback: 'PASS' }) } });
        const results = await Promise.allSettled([
            first.resumeLoop(definition, saved.id, { userId: 'user1' }),
            second.resumeLoop(definition, saved.id, { userId: 'user1' }),
        ]);
        expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
        expect(results.filter(result => result.status === 'rejected')).toHaveLength(1);
        await vi.waitFor(() => expect(maestroBatchingService.executeBatch).toHaveBeenCalledOnce());
        finishAction([{ success: true, message: 'Done', data: { taskId: 'one-action' } }]);
        await vi.waitFor(() => expect(durableExecutions.get(`users/user1/agentLoopExecutions/${saved.id}`)?.status).toBe('COMPLETED'));
        expect(maestroBatchingService.executeBatch).toHaveBeenCalledOnce();
    });

    it('does not resume cached READY work after another client claimed dispatch', async () => {
        const definition: AgentLoopDefinition = {
            id: 'stale-client-loop', trigger: AgentLoopTriggerEnum.enum.MANUAL,
            goal: 'Execute once', verifiabilityCriteria: 'Complete',
            judgeMode: AgentLoopJudgeModeEnum.enum.LLM_EVALUATION, maxIterations: 1,
            createdAt: 1000, updatedAt: 1000,
        };
        const saved = {
            id: 'stale-client-execution', loopId: definition.id, definitionSnapshot: snapshotOf(definition),
            status: AgentLoopStatusEnum.enum.FAILED, currentIteration: 1, history: [], tokenBudgetSpent: 0,
            checkpointRevision: 1, actionCheckpoint: { phase: 'READY' as const, iteration: 1 },
            createdAt: 1000, updatedAt: 1000,
        };
        seedExecution(saved);
        const claimed = { ...saved, checkpointRevision: 2, actionCheckpoint: { phase: 'DISPATCHING', iteration: 1, prompt: 'Already dispatched' } };
        durableExecutions.set(`users/user1/agentLoopExecutions/${saved.id}`, claimed);
        await expect(agentLoopService.resumeLoop(definition, saved.id, { userId: 'user1' })).rejects.toThrow('reconcile its outcome');
        expect(maestroBatchingService.executeBatch).not.toHaveBeenCalled();
        expect(durableExecutions.get(`users/user1/agentLoopExecutions/${saved.id}`)).toEqual(claimed);
    });

    it.each([
        { phase: 'UNKNOWN_PHASE', iteration: 1 },
        { phase: 'RESULT_RECORDED', iteration: 1, prompt: 'Saved', output: 42 },
    ])('refuses malformed durable checkpoint %j before dispatch', async actionCheckpoint => {
        const definition: AgentLoopDefinition = {
            id: 'invalid-checkpoint-loop', trigger: AgentLoopTriggerEnum.enum.MANUAL,
            goal: 'Execute once', verifiabilityCriteria: 'Complete',
            judgeMode: AgentLoopJudgeModeEnum.enum.LLM_EVALUATION, maxIterations: 1,
            createdAt: 1000, updatedAt: 1000,
        };
        const saved = {
            id: 'invalid-checkpoint-execution', loopId: definition.id, definitionSnapshot: snapshotOf(definition),
            status: AgentLoopStatusEnum.enum.FAILED, currentIteration: 1, history: [], tokenBudgetSpent: 0,
            checkpointRevision: 1, actionCheckpoint, createdAt: 1000, updatedAt: 1000,
        };
        seedExecution(saved);
        await expect(agentLoopService.resumeLoop(definition, saved.id, { userId: 'user1' })).rejects.toThrow('reconcile its outcome');
        expect(maestroBatchingService.executeBatch).not.toHaveBeenCalled();
        expect(mockGenerateContent).not.toHaveBeenCalled();
    });

    it('rejects a saved checkpoint whose embedded identity differs from its document', async () => {
        const definition: AgentLoopDefinition = {
            id: 'identity-loop', trigger: AgentLoopTriggerEnum.enum.MANUAL,
            goal: 'Execute once', verifiabilityCriteria: 'Complete',
            judgeMode: AgentLoopJudgeModeEnum.enum.LLM_EVALUATION, maxIterations: 1,
            createdAt: 1000, updatedAt: 1000,
        };
        durableExecutions.set('users/user1/agentLoopExecutions/requested-execution', { id: 'different-execution', loopId: definition.id });
        await expect(agentLoopService.resumeLoop(definition, 'requested-execution', { userId: 'user1' })).rejects.toThrow('mismatched saved checkpoint identity');
        expect(maestroBatchingService.executeBatch).not.toHaveBeenCalled();
    });

    it('does not return another user’s cached loop execution', async () => {
        const saved = {
            id: 'owner-scoped-execution', loopId: 'owner-loop', status: AgentLoopStatusEnum.enum.FAILED,
            currentIteration: 1, history: [], createdAt: 1000, updatedAt: 1000,
        };
        seedExecution(saved);
        (agentLoopService as any).executionOwners.set(saved.id, 'user1');
        const fetch = vi.spyOn(FirestoreService.prototype, 'get').mockResolvedValue(null);

        expect(agentLoopService.getExecution('user2', saved.id)).toBeUndefined();
        expect(agentLoopService.getExecution('user1', saved.id)).toBe(saved);
        expect(await agentLoopService.getExecutionAsync(undefined, saved.id)).toBeNull();
        expect(await agentLoopService.getExecutionAsync('user2', saved.id)).toBeNull();
        expect(fetch).toHaveBeenCalledTimes(1);
        expect(await agentLoopService.getExecutionAsync('user1', saved.id)).toBe(saved);
    });

    it('rejects a saved execution paired with a different loop definition', async () => {
        const saved = {
            id: 'mismatched-definition', loopId: 'original-loop', status: AgentLoopStatusEnum.enum.FAILED,
            currentIteration: 1, history: [], createdAt: 1000, updatedAt: 1000,
        };
        seedExecution(saved);
        (agentLoopService as any).executionOwners.set(saved.id, 'user1');
        const definition: AgentLoopDefinition = {
            id: 'different-loop', trigger: AgentLoopTriggerEnum.enum.MANUAL,
            goal: 'Review result', verifiabilityCriteria: 'Must be complete',
            judgeMode: AgentLoopJudgeModeEnum.enum.LLM_EVALUATION, maxIterations: 1,
            createdAt: 1000, updatedAt: 1000,
        };

        await expect(agentLoopService.resumeLoop(definition, saved.id, { userId: 'user1' }))
            .rejects.toThrow('belongs to a different loop definition');
        expect(maestroBatchingService.executeBatch).not.toHaveBeenCalled();
    });

    it('refuses a same-ID definition edit and an unverifiable legacy checkpoint', async () => {
        const definition: AgentLoopDefinition = {
            id: 'snapshot-loop', trigger: AgentLoopTriggerEnum.enum.MANUAL,
            goal: 'Original goal', verifiabilityCriteria: 'Original criterion',
            judgeMode: AgentLoopJudgeModeEnum.enum.LLM_EVALUATION, maxIterations: 2,
            createdAt: 1000, updatedAt: 1000,
        };
        const saved = {
            id: 'snapshot-execution', loopId: definition.id,
            definitionSnapshot: snapshotOf(definition), status: AgentLoopStatusEnum.enum.FAILED,
            currentIteration: 1, history: [], createdAt: 1000, updatedAt: 1000,
        };
        seedExecution(saved);
        (agentLoopService as any).executionOwners.set(saved.id, 'user1');
        const edited = { ...definition, verifiabilityCriteria: 'Different criterion' };

        await expect(agentLoopService.resumeLoop(edited, saved.id, { userId: 'user1' }))
            .rejects.toThrow('saved loop definition is missing or has changed');
        const legacy = { ...saved, id: 'legacy-execution', definitionSnapshot: undefined };
        seedExecution(legacy);
        (agentLoopService as any).executionOwners.set(legacy.id, 'user1');
        await expect(agentLoopService.resumeLoop(definition, legacy.id, { userId: 'user1' }))
            .rejects.toThrow('saved loop definition is missing or has changed');
        expect(maestroBatchingService.executeBatch).not.toHaveBeenCalled();
    });

    it('does not dispatch a cached loop from another user account', async () => {
        const saved = {
            id: 'other-user-execution', loopId: 'owner-loop', status: AgentLoopStatusEnum.enum.FAILED,
            currentIteration: 1, history: [], createdAt: 1000, updatedAt: 1000,
        };
        seedExecution(saved);
        (agentLoopService as any).executionOwners.set(saved.id, 'user1');
        vi.spyOn(FirestoreService.prototype, 'get').mockResolvedValue(null);
        const definition: AgentLoopDefinition = {
            id: saved.loopId, trigger: AgentLoopTriggerEnum.enum.MANUAL,
            goal: 'Review result', verifiabilityCriteria: 'Must be complete',
            judgeMode: AgentLoopJudgeModeEnum.enum.LLM_EVALUATION, maxIterations: 1,
            createdAt: 1000, updatedAt: 1000,
        };

        await expect(agentLoopService.resumeLoop(definition, saved.id, { userId: 'user2' }))
            .rejects.toThrow('not found to resume');
        expect(maestroBatchingService.executeBatch).not.toHaveBeenCalled();
    });

    it('rejects resuming a new loop while its action is still running', async () => {
        const def: AgentLoopDefinition = {
            id: 'loop-active-start', trigger: AgentLoopTriggerEnum.enum.MANUAL,
            goal: 'Review result', verifiabilityCriteria: 'Must be complete',
            judgeMode: AgentLoopJudgeModeEnum.enum.LLM_EVALUATION, maxIterations: 1,
            createdAt: Date.now(), updatedAt: Date.now(),
        };
        let finishBatch!: (result: Array<{ success: boolean; message: string; data: { taskId: string } }>) => void;
        vi.mocked(maestroBatchingService.executeBatch).mockImplementationOnce(() =>
            new Promise(resolve => { finishBatch = resolve; }));
        mockGenerateContent.mockResolvedValueOnce({
            response: { text: () => JSON.stringify({ passed: true, feedback: 'PASS' }) },
        });

        const executionId = await agentLoopService.startLoop(def, { userId: 'user1' });
        expect(agentLoopService.getExecution('user1', executionId)?.definitionSnapshot).toEqual(snapshotOf(def));
        await expect(agentLoopService.resumeLoop(def, executionId, { userId: 'user1' }))
            .rejects.toThrow('already running');
        expect(maestroBatchingService.executeBatch).toHaveBeenCalledTimes(1);

        finishBatch([{ success: true, message: 'Action result', data: { taskId: 'task-1' } }]);
        await vi.waitFor(() => expect(agentLoopService.getExecution('user1', executionId)?.status)
            .toBe(AgentLoopStatusEnum.enum.COMPLETED));
        expect(maestroBatchingService.executeBatch).toHaveBeenCalledTimes(1);
    });

    it('allows only one concurrent resume of a saved execution', async () => {
        const def: AgentLoopDefinition = {
            id: 'loop-active-resume', trigger: AgentLoopTriggerEnum.enum.MANUAL,
            goal: 'Review result', verifiabilityCriteria: 'Must be complete',
            judgeMode: AgentLoopJudgeModeEnum.enum.LLM_EVALUATION, maxIterations: 1,
            createdAt: Date.now(), updatedAt: Date.now(),
        };
        const saved = {
            id: 'saved-active-resume', loopId: def.id, status: AgentLoopStatusEnum.enum.FAILED,
            definitionSnapshot: snapshotOf(def),
            tokenBudgetSpent: 0,
            actionCheckpoint: { phase: 'READY' as const, iteration: 1 },
            currentIteration: 1, history: [], createdAt: 1000, updatedAt: 1000,
        };
        seedExecution(saved);
        (agentLoopService as any).executionOwners.set(saved.id, 'user1');
        vi.mocked(maestroBatchingService.executeBatch).mockResolvedValueOnce([
            { success: true, message: 'Action result', data: { taskId: 'task-1' } },
        ]);
        mockGenerateContent.mockResolvedValueOnce({
            response: { text: () => JSON.stringify({ passed: true, feedback: 'PASS' }) },
        });

        const first = agentLoopService.resumeLoop(def, saved.id, { userId: 'user1' });
        await expect(agentLoopService.resumeLoop(def, saved.id, { userId: 'user1' }))
            .rejects.toThrow('already running');
        await first;
        await vi.waitFor(() => expect(agentLoopService.getExecution('user1', saved.id)?.status)
            .toBe(AgentLoopStatusEnum.enum.COMPLETED));
        expect(maestroBatchingService.executeBatch).toHaveBeenCalledTimes(1);
    });

    it('does not dispatch a new loop when its first checkpoint cannot be saved', async () => {
        vi.spyOn(FirestoreService.prototype, 'setIfRevision').mockRejectedValueOnce(new Error('offline'));
        const def: AgentLoopDefinition = {
            id: 'loop-checkpoint-failure', trigger: AgentLoopTriggerEnum.enum.MANUAL,
            goal: 'Review result', verifiabilityCriteria: 'Must be complete',
            judgeMode: AgentLoopJudgeModeEnum.enum.LLM_EVALUATION, maxIterations: 1,
            createdAt: Date.now(), updatedAt: Date.now(),
        };

        await expect(agentLoopService.startLoop(def, { userId: 'user1' }))
            .rejects.toThrow('Loop checkpoint could not be saved; no action was dispatched.');
        expect(maestroBatchingService.executeBatch).not.toHaveBeenCalled();
    });

    it('does not dispatch when the per-action checkpoint cannot be saved', async () => {
        vi.spyOn(FirestoreService.prototype, 'setIfRevision')
            .mockImplementationOnce(saveCheckpoint)
            .mockRejectedValueOnce(new Error('offline'))
            .mockImplementation(saveCheckpoint);
        const def: AgentLoopDefinition = {
            id: 'action-checkpoint-failure', trigger: AgentLoopTriggerEnum.enum.MANUAL,
            goal: 'Review result', verifiabilityCriteria: 'Must be complete',
            judgeMode: AgentLoopJudgeModeEnum.enum.LLM_EVALUATION, maxIterations: 1,
            createdAt: 1000, updatedAt: 1000,
        };

        const executionId = await agentLoopService.startLoop(def, { userId: 'user1' });
        await vi.waitFor(() => expect(agentLoopService.getExecution('user1', executionId)?.status)
            .toBe(AgentLoopStatusEnum.enum.FAILED));
        expect(agentLoopService.getExecution('user1', executionId)?.actionCheckpoint).toEqual({ phase: 'READY', iteration: 1 });
        expect(maestroBatchingService.executeBatch).not.toHaveBeenCalled();
    });

    it('requires reconciliation when the action result checkpoint fails', async () => {
        vi.spyOn(FirestoreService.prototype, 'setIfRevision')
            .mockImplementationOnce(saveCheckpoint)
            .mockImplementationOnce(saveCheckpoint)
            .mockRejectedValueOnce(new Error('offline'))
            .mockImplementation(saveCheckpoint);
        vi.mocked(maestroBatchingService.executeBatch).mockResolvedValueOnce([
            { success: true, message: 'Action result', data: { taskId: 'task-1' } },
        ]);
        const def: AgentLoopDefinition = {
            id: 'result-checkpoint-failure', trigger: AgentLoopTriggerEnum.enum.MANUAL,
            goal: 'Review result', verifiabilityCriteria: 'Must be complete',
            judgeMode: AgentLoopJudgeModeEnum.enum.LLM_EVALUATION, maxIterations: 1,
            createdAt: 1000, updatedAt: 1000,
        };

        const executionId = await agentLoopService.startLoop(def, { userId: 'user1' });
        await vi.waitFor(() => expect(agentLoopService.getExecution('user1', executionId)?.status)
            .toBe(AgentLoopStatusEnum.enum.FAILED));
        expect(agentLoopService.getExecution('user1', executionId)?.actionCheckpoint?.phase).toBe('DISPATCHING');
        expect(mockGenerateContent).not.toHaveBeenCalled();
        await expect(agentLoopService.resumeLoop(def, executionId, { userId: 'user1' }))
            .rejects.toThrow('reconcile its outcome');
        expect(maestroBatchingService.executeBatch).toHaveBeenCalledTimes(1);
    });

    it('evaluates a recorded result on resume without dispatching again', async () => {
        const def: AgentLoopDefinition = {
            id: 'recorded-result-loop', trigger: AgentLoopTriggerEnum.enum.MANUAL,
            goal: 'Review result', verifiabilityCriteria: 'Must be complete',
            judgeMode: AgentLoopJudgeModeEnum.enum.LLM_EVALUATION, maxIterations: 1,
            createdAt: 1000, updatedAt: 1000,
        };
        const saved = {
            id: 'recorded-result-execution', loopId: def.id, definitionSnapshot: snapshotOf(def),
            tokenBudgetSpent: 0,
            actionCheckpoint: { phase: 'RESULT_RECORDED' as const, iteration: 1, prompt: 'Saved prompt', output: 'Saved output' },
            status: AgentLoopStatusEnum.enum.EVALUATING, currentIteration: 1,
            history: [], createdAt: 1000, updatedAt: 1000,
        };
        seedExecution(saved);
        (agentLoopService as any).executionOwners.set(saved.id, 'user1');
        mockGenerateContent.mockResolvedValueOnce({ response: { text: () => JSON.stringify({ passed: true, feedback: 'PASS' }) } });

        await agentLoopService.resumeLoop(def, saved.id, { userId: 'user1' });
        await vi.waitFor(() => expect(agentLoopService.getExecution('user1', saved.id)?.status)
            .toBe(AgentLoopStatusEnum.enum.COMPLETED));
        expect(maestroBatchingService.executeBatch).not.toHaveBeenCalled();
        expect(agentLoopService.getExecution('user1', saved.id)?.history[0]?.output).toBe('Saved output');
    });

    it('rejects a recorded checkpoint without evaluable output', async () => {
        const def: AgentLoopDefinition = {
            id: 'empty-result-loop', trigger: AgentLoopTriggerEnum.enum.MANUAL,
            goal: 'Review result', verifiabilityCriteria: 'Must be complete',
            judgeMode: AgentLoopJudgeModeEnum.enum.LLM_EVALUATION, maxIterations: 1,
            createdAt: 1000, updatedAt: 1000,
        };
        const saved = {
            id: 'empty-result-execution', loopId: def.id, definitionSnapshot: snapshotOf(def),
            tokenBudgetSpent: 0,
            actionCheckpoint: { phase: 'RESULT_RECORDED' as const, iteration: 1, prompt: 'Saved prompt', output: '  ' },
            status: AgentLoopStatusEnum.enum.EVALUATING, currentIteration: 1,
            history: [], createdAt: 1000, updatedAt: 1000,
        };
        seedExecution(saved);
        (agentLoopService as any).executionOwners.set(saved.id, 'user1');

        await expect(agentLoopService.resumeLoop(def, saved.id, { userId: 'user1' }))
            .rejects.toThrow('reconcile its outcome');
        expect(maestroBatchingService.executeBatch).not.toHaveBeenCalled();
        expect(mockGenerateContent).not.toHaveBeenCalled();
    });

    it('keeps a saved loop unchanged when its resume checkpoint fails', async () => {
        vi.spyOn(FirestoreService.prototype, 'setIfRevision').mockRejectedValueOnce(new Error('offline'));
        const def: AgentLoopDefinition = {
            id: 'loop-resume-checkpoint-failure', trigger: AgentLoopTriggerEnum.enum.MANUAL,
            goal: 'Review result', verifiabilityCriteria: 'Must be complete',
            judgeMode: AgentLoopJudgeModeEnum.enum.LLM_EVALUATION, maxIterations: 2,
            createdAt: Date.now(), updatedAt: Date.now(),
        };
        const saved = {
            id: 'saved-checkpoint-failure', loopId: def.id, status: AgentLoopStatusEnum.enum.FAILED,
            definitionSnapshot: snapshotOf(def),
            tokenBudgetSpent: 0,
            actionCheckpoint: { phase: 'READY' as const, iteration: 1 },
            currentIteration: 1, history: [], createdAt: 1000, updatedAt: 1000,
        };
        seedExecution(saved);
        (agentLoopService as any).executionOwners.set(saved.id, 'user1');

        await expect(agentLoopService.resumeLoop(def, saved.id, { userId: 'user1' }))
            .rejects.toThrow('Loop checkpoint could not be saved; no action was dispatched.');
        // Resume refreshes a distinct durable snapshot, without mutating it on failure.
        expect(agentLoopService.getExecution('user1', saved.id)).toEqual(saved);
        expect(saved.status).toBe(AgentLoopStatusEnum.enum.FAILED);
        expect(maestroBatchingService.executeBatch).not.toHaveBeenCalled();
    });

    it('refuses deterministic mode before dispatch when no verifier exists', async () => {
        const def: AgentLoopDefinition = {
            id: 'loop-test-1',
            trigger: AgentLoopTriggerEnum.enum.MANUAL,
            goal: 'Test Goal',
            verifiabilityCriteria: 'Test Criteria',
            judgeMode: AgentLoopJudgeModeEnum.enum.DETERMINISTIC_TEST,
            maxIterations: 3,
            createdAt: Date.now(),
            updatedAt: Date.now(),
        };

        const context = { userId: 'user1', projectId: 'proj1' } as any;

        await expect(agentLoopService.startLoop(def, context)).rejects.toThrow('no verifier is configured');
        expect(maestroBatchingService.executeBatch).not.toHaveBeenCalled();
    });

    it('should run an LLM evaluation loop that iterates once before passing', async () => {
        const def: AgentLoopDefinition = {
            id: 'loop-test-2',
            trigger: AgentLoopTriggerEnum.enum.MANUAL,
            goal: 'Find venues',
            verifiabilityCriteria: 'Must have 3 venues',
            judgeMode: AgentLoopJudgeModeEnum.enum.LLM_EVALUATION,
            maxIterations: 3,
            createdAt: Date.now(),
            updatedAt: Date.now(),
        };

        const context = { userId: 'user1', projectId: 'proj1' } as any;

        // Maestro fails first time, succeeds second time
        vi.mocked(maestroBatchingService.executeBatch)
            .mockResolvedValueOnce([{ success: true, message: 'Found 1 venue', data: { taskId: 'task-1' } }])
            .mockResolvedValueOnce([{ success: true, message: 'Found 3 venues', data: { taskId: 'task-2' } }]);

        // LLM Judge fails first time, passes second time
        mockGenerateContent
            .mockResolvedValueOnce({
                response: {
                    text: () => JSON.stringify({ passed: false, feedback: 'Need 2 more venues' })
                }
            })
            .mockResolvedValueOnce({
                response: {
                    text: () => JSON.stringify({ passed: true, feedback: 'PASS' })
                }
            });

        const executionId = await agentLoopService.startLoop(def, context);
        
        await vi.waitFor(() => expect(agentLoopService.getExecution('user1', executionId)?.history).toHaveLength(2));

        const execution = agentLoopService.getExecution('user1', executionId);
        expect(execution).toBeDefined();
        expect(execution?.status).toBe(AgentLoopStatusEnum.enum.COMPLETED);
        expect(mockGenerateContent).toHaveBeenCalledWith(
            expect.any(String),
            expect.any(String),
            expect.objectContaining({ temperature: 1.0, maxOutputTokens: 300 }),
            expect.any(String)
        );
        expect(execution?.history).toHaveLength(2);
        
        // First iteration
        expect(execution?.history[0]?.passed).toBe(false);
        expect(execution?.history[0]?.feedback).toBe('Need 2 more venues');
        expect(mockGenerateContent.mock.calls[0]?.[0]).toContain('Found 1 venue');

        // Second iteration
        expect(execution?.history[1]?.passed).toBe(true);
        expect(execution?.history[1]?.feedback).toBe('PASS');
    });

    it.each([
        { passed: 'false', feedback: 'No' },
        { passed: 1, feedback: 'Yes' },
        { feedback: 'Missing verdict' },
        { passed: true, feedback: 42 },
    ])('does not complete from a malformed judge verdict: %j', async verdict => {
        const def: AgentLoopDefinition = {
            id: 'loop-invalid-verdict',
            trigger: AgentLoopTriggerEnum.enum.MANUAL,
            goal: 'Review action',
            verifiabilityCriteria: 'Must be complete',
            judgeMode: AgentLoopJudgeModeEnum.enum.LLM_EVALUATION,
            maxIterations: 2,
            createdAt: Date.now(),
            updatedAt: Date.now(),
        };
        vi.mocked(maestroBatchingService.executeBatch).mockResolvedValueOnce([
            { success: true, message: 'Action result', data: { taskId: 'task-1' } },
        ]);
        mockGenerateContent.mockResolvedValueOnce({ response: { text: () => JSON.stringify(verdict) } });

        const executionId = await agentLoopService.startLoop(def, { userId: 'user1', projectId: 'proj1' });
        await vi.waitFor(() => expect(agentLoopService.getExecution('user1', executionId)?.status).toBe('FAILED'));

        const execution = agentLoopService.getExecution('user1', executionId);
        expect(execution?.status).toBe(AgentLoopStatusEnum.enum.FAILED);
        expect(execution?.actionCheckpoint).toMatchObject({ phase: 'RESULT_RECORDED', iteration: 1, output: 'Action result' });
        expect(maestroBatchingService.executeBatch).toHaveBeenCalledOnce();
        expect(mockGenerateContent).toHaveBeenCalledTimes(1);
    });

    it('resumes evaluation of the saved action after a malformed retry verdict', async () => {
        const def: AgentLoopDefinition = {
            id: 'loop-invalid-retry-verdict',
            trigger: AgentLoopTriggerEnum.enum.MANUAL,
            goal: 'Review action',
            verifiabilityCriteria: 'Must be complete',
            judgeMode: AgentLoopJudgeModeEnum.enum.LLM_EVALUATION,
            maxIterations: 2,
            createdAt: Date.now(),
            updatedAt: Date.now(),
        };
        vi.mocked(maestroBatchingService.executeBatch).mockResolvedValueOnce([
            { success: true, message: 'Action result', data: { taskId: 'task-1' } },
        ]);
        mockGenerateContent
            .mockRejectedValueOnce(new Error('503 Service Unavailable'))
            .mockResolvedValueOnce({ response: { text: () => JSON.stringify({ passed: 'true', feedback: 'PASS' }) } });

        const executionId = await agentLoopService.startLoop(def, { userId: 'user1', projectId: 'proj1' });
        await vi.waitFor(() => expect(agentLoopService.getExecution('user1', executionId)?.status).toBe('FAILED'), { timeout: 3000 });

        const execution = agentLoopService.getExecution('user1', executionId);
        expect(execution?.status).toBe(AgentLoopStatusEnum.enum.FAILED);
        expect(execution?.actionCheckpoint).toMatchObject({ phase: 'RESULT_RECORDED', iteration: 1, output: 'Action result' });
        expect(maestroBatchingService.executeBatch).toHaveBeenCalledOnce();
        expect(mockGenerateContent).toHaveBeenCalledTimes(2);

        mockGenerateContent.mockResolvedValueOnce({
            response: { text: () => JSON.stringify({ passed: true, feedback: 'Saved result verified' }) },
        });
        const recovered = new AgentLoopService();
        await recovered.resumeLoop(def, executionId, { userId: 'user1', projectId: 'proj1' });
        await vi.waitFor(() => expect(recovered.getExecution('user1', executionId)?.status).toBe('COMPLETED'));
        expect(recovered.getExecution('user1', executionId)?.history).toMatchObject([
            { iteration: 1, output: 'Action result', passed: true, feedback: 'Saved result verified' },
        ]);
        expect(maestroBatchingService.executeBatch).toHaveBeenCalledOnce();
        expect(mockGenerateContent).toHaveBeenCalledTimes(3);
    });

    it('halts before a judge call when the shared execution allowance is exhausted', async () => {
        const def: AgentLoopDefinition = {
            id: 'loop-budget-exhausted',
            trigger: AgentLoopTriggerEnum.enum.MANUAL,
            goal: 'Review a result',
            verifiabilityCriteria: 'Must be valid',
            judgeMode: AgentLoopJudgeModeEnum.enum.LLM_EVALUATION,
            maxIterations: 3,
            createdAt: Date.now(),
            updatedAt: Date.now(),
        };
        const context = { userId: 'user1', projectId: 'proj1' };
        executionTokenBudget(context, 1_500_000).reserve(1_500_000);
        vi.mocked(maestroBatchingService.executeBatch).mockResolvedValueOnce([{ success: true, message: 'Action taken', data: { taskId: 'task-1' } }]);

        const executionId = await agentLoopService.startLoop(def, context);
        await vi.waitFor(() => expect(agentLoopService.getExecution('user1', executionId)?.status)
            .toBe(AgentLoopStatusEnum.enum.FAILED));

        expect(agentLoopService.getExecution('user1', executionId)?.status).toBe(AgentLoopStatusEnum.enum.FAILED);
        expect(mockGenerateContent).not.toHaveBeenCalled();
    });

    it('restores the saved allowance before judging a recorded result on a fresh context', async () => {
        const def: AgentLoopDefinition = {
            id: 'loop-resume-budget', trigger: AgentLoopTriggerEnum.enum.MANUAL,
            goal: 'Review result', verifiabilityCriteria: 'Must be valid',
            judgeMode: AgentLoopJudgeModeEnum.enum.LLM_EVALUATION, maxIterations: 2,
            createdAt: 1000, updatedAt: 1000,
        };
        const saved = {
            id: 'resume-budget-execution', loopId: def.id, definitionSnapshot: snapshotOf(def),
            actionCheckpoint: { phase: 'RESULT_RECORDED' as const, iteration: 1, prompt: 'Saved prompt', output: 'Saved output' },
            status: AgentLoopStatusEnum.enum.EVALUATING, currentIteration: 1,
            tokenBudgetSpent: 1_500_000, history: [], createdAt: 1000, updatedAt: 1000,
        };
        seedExecution(saved);
        (agentLoopService as any).executionOwners.set(saved.id, 'user1');
        const freshContext = { userId: 'user1' };

        await agentLoopService.resumeLoop(def, saved.id, freshContext);
        await vi.waitFor(() => expect(agentLoopService.getExecution('user1', saved.id)?.status)
            .toBe(AgentLoopStatusEnum.enum.FAILED));
        expect(executionTokenBudget(freshContext, 1_500_000).remaining).toBe(0);
        expect(maestroBatchingService.executeBatch).not.toHaveBeenCalled();
        expect(mockGenerateContent).not.toHaveBeenCalled();
    });

    it('refuses to resume an older checkpoint with unknown cumulative spend', async () => {
        const def: AgentLoopDefinition = {
            id: 'loop-legacy-budget', trigger: AgentLoopTriggerEnum.enum.MANUAL,
            goal: 'Review result', verifiabilityCriteria: 'Must be valid',
            judgeMode: AgentLoopJudgeModeEnum.enum.LLM_EVALUATION, maxIterations: 2,
            createdAt: 1000, updatedAt: 1000,
        };
        const saved = {
            id: 'legacy-budget-execution', loopId: def.id, definitionSnapshot: snapshotOf(def),
            actionCheckpoint: { phase: 'READY' as const, iteration: 2 },
            status: AgentLoopStatusEnum.enum.FAILED, currentIteration: 2,
            history: [], createdAt: 1000, updatedAt: 1000,
        };
        seedExecution(saved);
        (agentLoopService as any).executionOwners.set(saved.id, 'user1');

        await expect(agentLoopService.resumeLoop(def, saved.id, { userId: 'user1' }))
            .rejects.toThrow(/valid saved token allowance/);
        expect(maestroBatchingService.executeBatch).not.toHaveBeenCalled();
    });

    it('does not dispatch a judge when its budget checkpoint cannot be saved', async () => {
        let attemptedBudgetSpend = 0;
        vi.spyOn(FirestoreService.prototype, 'setIfRevision')
            .mockImplementationOnce(saveCheckpoint)
            .mockImplementationOnce(saveCheckpoint)
            .mockImplementationOnce(saveCheckpoint)
            .mockImplementationOnce(async (_id, record) => {
                attemptedBudgetSpend = (record as { tokenBudgetSpent?: number }).tokenBudgetSpent ?? 0;
                throw new Error('offline');
            })
            .mockImplementation(saveCheckpoint);
        const def: AgentLoopDefinition = {
            id: 'loop-judge-checkpoint', trigger: AgentLoopTriggerEnum.enum.MANUAL,
            goal: 'Review result', verifiabilityCriteria: 'Must be valid',
            judgeMode: AgentLoopJudgeModeEnum.enum.LLM_EVALUATION, maxIterations: 1,
            createdAt: 1000, updatedAt: 1000,
        };
        vi.mocked(maestroBatchingService.executeBatch).mockResolvedValueOnce([
            { success: true, message: 'Action result', data: { taskId: 'task-1' } },
        ]);
        const executionId = await agentLoopService.startLoop(def, { userId: 'user1' });
        await vi.waitFor(() => expect(agentLoopService.getExecution('user1', executionId)?.status)
            .toBe(AgentLoopStatusEnum.enum.FAILED));
        expect(agentLoopService.getExecution('user1', executionId)?.actionCheckpoint?.phase).toBe('RESULT_RECORDED');
        expect(attemptedBudgetSpend).toBeGreaterThan(0);
        expect(mockGenerateContent).not.toHaveBeenCalled();
    });

    it('does not judge a successful batch with empty output', async () => {
        const def: AgentLoopDefinition = {
            id: 'loop-empty-output', trigger: AgentLoopTriggerEnum.enum.MANUAL,
            goal: 'Review a result', verifiabilityCriteria: 'Must be valid',
            judgeMode: AgentLoopJudgeModeEnum.enum.LLM_EVALUATION, maxIterations: 1,
            createdAt: Date.now(), updatedAt: Date.now(),
        };
        vi.mocked(maestroBatchingService.executeBatch).mockResolvedValueOnce([
            { success: true, message: '   ', data: { taskId: 'task-1' } },
        ]);
        const executionId = await agentLoopService.startLoop(def, { userId: 'user1' });
        await vi.waitFor(() => expect(agentLoopService.getExecution('user1', executionId)?.status)
            .toBe(AgentLoopStatusEnum.enum.FAILED));
        expect(mockGenerateContent).not.toHaveBeenCalled();
        expect(agentLoopService.getExecution('user1', executionId)?.history[0]?.feedback)
            .toContain('Agent returned no evaluable output.');
    });

    it('should fail if max iterations are reached', async () => {
        const def: AgentLoopDefinition = {
            id: 'loop-test-3',
            trigger: AgentLoopTriggerEnum.enum.MANUAL,
            goal: 'Impossible task',
            verifiabilityCriteria: 'Never possible',
            judgeMode: AgentLoopJudgeModeEnum.enum.LLM_EVALUATION,
            maxIterations: 2,
            createdAt: Date.now(),
            updatedAt: Date.now(),
        };

        const context = { userId: 'user1', projectId: 'proj1' } as any;

        vi.mocked(maestroBatchingService.executeBatch).mockResolvedValue([
            { success: true, message: 'Still failing', data: { taskId: 'task-1' } }
        ]);

        mockGenerateContent.mockResolvedValue({
            response: {
                text: () => JSON.stringify({ passed: false, feedback: 'Failed again' })
            }
        });

        const executionId = await agentLoopService.startLoop(def, context);
        
        await vi.waitFor(() => expect(agentLoopService.getExecution('user1', executionId)?.history).toHaveLength(2));

        const execution = agentLoopService.getExecution('user1', executionId);
        expect(execution).toBeDefined();
        expect(execution?.status).toBe(AgentLoopStatusEnum.enum.FAILED);
        expect(execution?.history).toHaveLength(2); // maxIterations = 2
    });

    it('does not repeat a rate-limited action whose outcome is uncertain', async () => {
        const def: AgentLoopDefinition = {
            id: 'loop-test-retry',
            trigger: AgentLoopTriggerEnum.enum.MANUAL,
            goal: 'Resilient Task',
            verifiabilityCriteria: 'Must succeed',
            judgeMode: AgentLoopJudgeModeEnum.enum.LLM_EVALUATION,
            maxIterations: 2,
            createdAt: Date.now(),
            updatedAt: Date.now(),
        };

        const context = { userId: 'user1', projectId: 'proj1' } as any;

        vi.mocked(maestroBatchingService.executeBatch)
            .mockResolvedValueOnce([{ success: false, error: 'Rate limit 429: RESOURCE_EXHAUSTED', data: { taskId: 'task-1' } }]);

        const executionId = await agentLoopService.startLoop(def, context);

        await vi.waitFor(() => expect(agentLoopService.getExecution('user1', executionId)?.status)
            .toBe(AgentLoopStatusEnum.enum.FAILED));

        const execution = agentLoopService.getExecution('user1', executionId);
        expect(execution).toBeDefined();
        expect(execution?.status).toBe(AgentLoopStatusEnum.enum.FAILED);
        expect(execution?.currentIteration).toBe(1);
        expect(execution?.actionCheckpoint?.phase).toBe('DISPATCHING');
        expect(maestroBatchingService.executeBatch).toHaveBeenCalledTimes(1);
        expect(mockGenerateContent).not.toHaveBeenCalled();
    });

    it('should halt on persistent transient failure without invoking LLM judge', async () => {
        const def: AgentLoopDefinition = {
            id: 'loop-test-exhausted',
            trigger: AgentLoopTriggerEnum.enum.MANUAL,
            goal: 'Fail gracefully',
            verifiabilityCriteria: 'Criteria',
            judgeMode: AgentLoopJudgeModeEnum.enum.LLM_EVALUATION,
            maxIterations: 3,
            createdAt: Date.now(),
            updatedAt: Date.now(),
        };

        const context = { userId: 'user1', projectId: 'proj1' } as any;

        // Persistent timeout error
        vi.mocked(maestroBatchingService.executeBatch).mockResolvedValue([
            { success: false, error: 'Connection timeout after 30000ms', data: { taskId: 'task-1' } }
        ]);

        const executionId = await agentLoopService.startLoop(def, context);

        await vi.waitFor(() => expect(agentLoopService.getExecution('user1', executionId)?.status)
            .toBe(AgentLoopStatusEnum.enum.FAILED), { timeout: 5000 });

        const execution = agentLoopService.getExecution('user1', executionId);
        expect(execution).toBeDefined();
        expect(execution?.status).toBe(AgentLoopStatusEnum.enum.FAILED);
        expect(maestroBatchingService.executeBatch).toHaveBeenCalledTimes(1);
        // LLM judge should NOT have been called with the timeout error string
        expect(mockGenerateContent).not.toHaveBeenCalled();
    });

    it('should resume an interrupted loop from its saved iteration', async () => {
        const def: AgentLoopDefinition = {
            id: 'loop-test-resume',
            trigger: AgentLoopTriggerEnum.enum.MANUAL,
            goal: 'Resume goal',
            verifiabilityCriteria: 'Resume criteria',
            judgeMode: AgentLoopJudgeModeEnum.enum.LLM_EVALUATION,
            maxIterations: 3,
            createdAt: Date.now(),
            updatedAt: Date.now(),
        };

        const context = { userId: 'user1', projectId: 'proj1' } as any;

        // Create an interrupted execution pre-set at iteration 2
        const executionId = 'saved-exec-id';
        seedExecution({
            id: executionId,
            loopId: def.id,
            definitionSnapshot: snapshotOf(def),
            actionCheckpoint: { phase: 'READY', iteration: 2 },
            tokenBudgetSpent: 0,
            status: AgentLoopStatusEnum.enum.FAILED,
            currentIteration: 2,
            history: [
                { iteration: 1, prompt: 'p1', output: 'o1', feedback: 'f1', passed: false, timestamp: 1000 }
            ],
            createdAt: 1000,
            updatedAt: 1000,
        });
        (agentLoopService as any).executionOwners.set(executionId, 'user1');

        vi.mocked(maestroBatchingService.executeBatch).mockResolvedValueOnce([
            { success: true, message: 'Resumed output', data: { taskId: 'task-1' } }
        ]);
        mockGenerateContent.mockResolvedValueOnce({
            response: { text: () => JSON.stringify({ passed: true, feedback: 'PASS' }) }
        });

        const resumed = await agentLoopService.resumeLoop(def, executionId, context);
        expect(resumed.id).toBe(executionId);

        await vi.waitFor(() => expect(agentLoopService.getExecution('user1', executionId)?.status)
            .toBe(AgentLoopStatusEnum.enum.COMPLETED));

        const execution = agentLoopService.getExecution('user1', executionId);
        expect(execution?.status).toBe(AgentLoopStatusEnum.enum.COMPLETED);
        expect(execution?.history).toHaveLength(2);
        expect(execution?.history[1]?.iteration).toBe(2);
    });

    it('refuses to resume an old deterministic loop without a verifier', async () => {
        const def: AgentLoopDefinition = {
            id: 'loop-deterministic-resume',
            trigger: AgentLoopTriggerEnum.enum.MANUAL,
            goal: 'Review result',
            verifiabilityCriteria: 'Must be complete',
            judgeMode: AgentLoopJudgeModeEnum.enum.DETERMINISTIC_TEST,
            maxIterations: 2,
            createdAt: Date.now(),
            updatedAt: Date.now(),
        };
        const executionId = 'saved-deterministic-exec';
        const saved = {
            id: executionId, loopId: def.id, status: AgentLoopStatusEnum.enum.FAILED,
            currentIteration: 1, history: [], createdAt: 1000, updatedAt: 1000,
        };
        seedExecution(saved);
        (agentLoopService as any).executionOwners.set(executionId, 'user1');

        await expect(agentLoopService.resumeLoop(def, executionId, { userId: 'user1' }))
            .rejects.toThrow('no verifier is configured');
        expect(agentLoopService.getExecution('user1', executionId)).toBe(saved);
        expect(maestroBatchingService.executeBatch).not.toHaveBeenCalled();
    });

    it('should halt immediately when TypeSafe judgment classifies a keyword-matching error as non-transient', async () => {
        const def: AgentLoopDefinition = {
            id: 'loop-test-typesafe-refine',
            trigger: AgentLoopTriggerEnum.enum.MANUAL,
            goal: 'Logical Policy Failure',
            verifiabilityCriteria: 'Criteria',
            judgeMode: AgentLoopJudgeModeEnum.enum.LLM_EVALUATION,
            maxIterations: 1,
            createdAt: Date.now(),
            updatedAt: Date.now(),
        };

        const context = { userId: 'user1', projectId: 'proj1' } as any;

        // An error string containing 'network' (which heuristic flags as transient),
        // but Jev resolves it as logical (e.g. network policy rejection).
        vi.mocked(judgeTransientError).mockResolvedValueOnce(false);

        vi.mocked(maestroBatchingService.executeBatch).mockResolvedValueOnce([
            { success: false, error: 'Network policy rejected: caller unauthorized', data: { taskId: 'task-1' } }
        ]);

        const executionId = await agentLoopService.startLoop(def, context);

        await vi.waitFor(() => expect(agentLoopService.getExecution('user1', executionId)?.status)
            .toBe(AgentLoopStatusEnum.enum.FAILED));

        const execution = agentLoopService.getExecution('user1', executionId);
        expect(execution).toBeDefined();
        // Because JEV classified it as non-transient, executeBatch was called only once (no retry backoff)
        expect(maestroBatchingService.executeBatch).toHaveBeenCalledTimes(1);
        expect(execution?.status).toBe(AgentLoopStatusEnum.enum.FAILED);
        expect(mockGenerateContent).not.toHaveBeenCalled();
        expect(execution?.history[0]?.feedback).toContain('Network policy rejected: caller unauthorized');
    });

    it('should retry evaluation when evaluation error is classified as transient by resolveTransient', async () => {
        const def: AgentLoopDefinition = {
            id: 'loop-test-eval-retry',
            trigger: AgentLoopTriggerEnum.enum.MANUAL,
            goal: 'Eval Retry Task',
            verifiabilityCriteria: 'Must pass evaluation',
            judgeMode: AgentLoopJudgeModeEnum.enum.LLM_EVALUATION,
            maxIterations: 2,
            createdAt: Date.now(),
            updatedAt: Date.now(),
        };

        const context = { userId: 'user1', projectId: 'proj1' } as any;

        vi.mocked(maestroBatchingService.executeBatch).mockResolvedValue([
            { success: true, message: 'Action result', data: { taskId: 'task-1' } }
        ]);

        // First evaluation attempt fails with a transient 503 error, retry succeeds
        mockGenerateContent
            .mockRejectedValueOnce(new Error('503 Service Unavailable'))
            .mockResolvedValueOnce({
                response: {
                    text: () => JSON.stringify({ passed: true, feedback: 'PASS on retry' })
                }
            });

        const executionId = await agentLoopService.startLoop(def, context);

        await vi.waitFor(() => expect(agentLoopService.getExecution('user1', executionId)?.status)
            .toBe(AgentLoopStatusEnum.enum.COMPLETED), { timeout: 3000 });

        const execution = agentLoopService.getExecution('user1', executionId);
        expect(execution).toBeDefined();
        expect(execution?.status).toBe(AgentLoopStatusEnum.enum.COMPLETED);
        expect(execution?.history[0]?.passed).toBe(true);
        expect(execution?.history[0]?.feedback).toBe('PASS on retry');
    });
});
