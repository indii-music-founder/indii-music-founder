import { describe, it, expect, vi, beforeEach } from 'vitest';
import { agentLoopService } from './AgentLoopService';
import { maestroBatchingService } from '../MaestroBatchingService';
import { judgeTransientError } from '@/config/typesafeJudgments';
import { AgentLoopDefinition, AgentLoopTriggerEnum, AgentLoopJudgeModeEnum, AgentLoopStatusEnum } from '@indii/shared';
import { executionTokenBudget } from '../governance/ExecutionTokenBudget';

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

describe('AgentLoopService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
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
        
        // Wait for async loop to finish
        await new Promise(resolve => setTimeout(resolve, 100));

        const execution = agentLoopService.getExecution(executionId);
        expect(execution).toBeDefined();
        expect(execution?.status).toBe(AgentLoopStatusEnum.enum.COMPLETED);
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
            maxIterations: 1,
            createdAt: Date.now(),
            updatedAt: Date.now(),
        };
        vi.mocked(maestroBatchingService.executeBatch).mockResolvedValueOnce([
            { success: true, message: 'Action result', data: { taskId: 'task-1' } },
        ]);
        mockGenerateContent.mockResolvedValueOnce({ response: { text: () => JSON.stringify(verdict) } });

        const executionId = await agentLoopService.startLoop(def, { userId: 'user1', projectId: 'proj1' });
        await new Promise(resolve => setTimeout(resolve, 50));

        const execution = agentLoopService.getExecution(executionId);
        expect(execution?.status).toBe(AgentLoopStatusEnum.enum.FAILED);
        expect(execution?.history[0]).toMatchObject({ passed: false, feedback: 'Evaluation returned an invalid verdict.' });
        expect(mockGenerateContent).toHaveBeenCalledTimes(1);
    });

    it('rejects a malformed verdict after a transient judge retry', async () => {
        const def: AgentLoopDefinition = {
            id: 'loop-invalid-retry-verdict',
            trigger: AgentLoopTriggerEnum.enum.MANUAL,
            goal: 'Review action',
            verifiabilityCriteria: 'Must be complete',
            judgeMode: AgentLoopJudgeModeEnum.enum.LLM_EVALUATION,
            maxIterations: 1,
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
        await new Promise(resolve => setTimeout(resolve, 800));

        const execution = agentLoopService.getExecution(executionId);
        expect(execution?.status).toBe(AgentLoopStatusEnum.enum.FAILED);
        expect(execution?.history[0]).toMatchObject({ passed: false, feedback: 'Evaluation returned an invalid verdict.' });
        expect(mockGenerateContent).toHaveBeenCalledTimes(2);
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
        await new Promise(resolve => setTimeout(resolve, 50));

        expect(agentLoopService.getExecution(executionId)?.status).toBe(AgentLoopStatusEnum.enum.FAILED);
        expect(mockGenerateContent).not.toHaveBeenCalled();
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
        
        // Wait for async loop to finish
        await new Promise(resolve => setTimeout(resolve, 100));

        const execution = agentLoopService.getExecution(executionId);
        expect(execution).toBeDefined();
        expect(execution?.status).toBe(AgentLoopStatusEnum.enum.FAILED);
        expect(execution?.history).toHaveLength(2); // maxIterations = 2
    });

    it('should retry on transient infrastructure errors before counting as failed', async () => {
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

        // First attempt fails with 429 rate limit, second attempt succeeds
        vi.mocked(maestroBatchingService.executeBatch)
            .mockResolvedValueOnce([{ success: false, error: 'Rate limit 429: RESOURCE_EXHAUSTED', data: { taskId: 'task-1' } }])
            .mockResolvedValueOnce([{ success: true, message: 'Success after retry', data: { taskId: 'task-2' } }]);
        mockGenerateContent.mockResolvedValueOnce({
            response: { text: () => JSON.stringify({ passed: true, feedback: 'PASS' }) }
        });

        const executionId = await agentLoopService.startLoop(def, context);

        // Wait for backoff retry and completion
        await new Promise(resolve => setTimeout(resolve, 1500));

        const execution = agentLoopService.getExecution(executionId);
        expect(execution).toBeDefined();
        expect(execution?.status).toBe(AgentLoopStatusEnum.enum.COMPLETED);
        expect(execution?.currentIteration).toBe(1); // Succeeded on iteration 1 (did not burn iteration)
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

        // Wait for retries to exhaust
        await new Promise(resolve => setTimeout(resolve, 2500));

        const execution = agentLoopService.getExecution(executionId);
        expect(execution).toBeDefined();
        expect(execution?.status).toBe(AgentLoopStatusEnum.enum.FAILED);
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
        (agentLoopService as any).executionStore.set(executionId, {
            id: executionId,
            loopId: def.id,
            status: AgentLoopStatusEnum.enum.FAILED,
            currentIteration: 2,
            history: [
                { iteration: 1, prompt: 'p1', output: 'o1', feedback: 'f1', passed: false, timestamp: 1000 }
            ],
            createdAt: 1000,
            updatedAt: 1000,
        });

        vi.mocked(maestroBatchingService.executeBatch).mockResolvedValueOnce([
            { success: true, message: 'Resumed output', data: { taskId: 'task-1' } }
        ]);
        mockGenerateContent.mockResolvedValueOnce({
            response: { text: () => JSON.stringify({ passed: true, feedback: 'PASS' }) }
        });

        const resumed = await agentLoopService.resumeLoop(def, executionId, context);
        expect(resumed.id).toBe(executionId);

        // Wait for loop completion
        await new Promise(resolve => setTimeout(resolve, 100));

        const execution = agentLoopService.getExecution(executionId);
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
        (agentLoopService as any).executionStore.set(executionId, saved);

        await expect(agentLoopService.resumeLoop(def, executionId, { userId: 'user1' }))
            .rejects.toThrow('no verifier is configured');
        expect(agentLoopService.getExecution(executionId)).toBe(saved);
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

        mockGenerateContent.mockResolvedValueOnce({
            response: {
                text: () => JSON.stringify({ passed: false, feedback: 'Request was blocked by network policy.' })
            }
        });

        const executionId = await agentLoopService.startLoop(def, context);

        // Wait for loop execution
        await new Promise(resolve => setTimeout(resolve, 100));

        const execution = agentLoopService.getExecution(executionId);
        expect(execution).toBeDefined();
        // Because JEV classified it as non-transient, executeBatch was called only once (no retry backoff)
        expect(maestroBatchingService.executeBatch).toHaveBeenCalledTimes(1);
        expect(execution?.status).toBe(AgentLoopStatusEnum.enum.FAILED);
        expect(execution?.history[0]?.feedback).toBe('Request was blocked by network policy.');
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

        // Wait for backoff retry and evaluation
        await new Promise(resolve => setTimeout(resolve, 800));

        const execution = agentLoopService.getExecution(executionId);
        expect(execution).toBeDefined();
        expect(execution?.status).toBe(AgentLoopStatusEnum.enum.COMPLETED);
        expect(execution?.history[0]?.passed).toBe(true);
        expect(execution?.history[0]?.feedback).toBe('PASS on retry');
    });
});
