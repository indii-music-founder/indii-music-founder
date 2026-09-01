import { describe, it, expect, vi, beforeEach } from 'vitest';
import { agentLoopService } from './AgentLoopService';
import { maestroBatchingService } from '../MaestroBatchingService';
import { AgentLoopDefinition, AgentLoopTriggerEnum, AgentLoopJudgeModeEnum, AgentLoopStatusEnum } from '@indii/shared';

// Mock dependencies
vi.mock('../MaestroBatchingService', () => ({
    maestroBatchingService: {
        executeBatch: vi.fn(),
    }
}));

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

    it('should run a deterministic test loop and complete immediately', async () => {
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

        vi.mocked(maestroBatchingService.executeBatch).mockResolvedValueOnce([
            { success: true, text: 'Action taken' } as any
        ]);

        const executionId = await agentLoopService.startLoop(def, context);
        
        // Wait for async loop to finish
        await new Promise(resolve => setTimeout(resolve, 50));

        const execution = agentLoopService.getExecution(executionId);
        expect(execution).toBeDefined();
        expect(execution?.status).toBe(AgentLoopStatusEnum.enum.COMPLETED);
        expect(execution?.history).toHaveLength(1);
        expect(execution?.history[0]?.output).toBe('Action taken');
        expect(execution?.history[0]?.passed).toBe(true);
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
            .mockResolvedValueOnce([{ success: true, text: 'Found 1 venue' } as any])
            .mockResolvedValueOnce([{ success: true, text: 'Found 3 venues' } as any]);

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

        // Second iteration
        expect(execution?.history[1]?.passed).toBe(true);
        expect(execution?.history[1]?.feedback).toBe('PASS');
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
            { success: true, text: 'Still failing' } as any
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
            judgeMode: AgentLoopJudgeModeEnum.enum.DETERMINISTIC_TEST,
            maxIterations: 2,
            createdAt: Date.now(),
            updatedAt: Date.now(),
        };

        const context = { userId: 'user1', projectId: 'proj1' } as any;

        // First attempt fails with 429 rate limit, second attempt succeeds
        vi.mocked(maestroBatchingService.executeBatch)
            .mockResolvedValueOnce([{ success: false, error: 'Rate limit 429: RESOURCE_EXHAUSTED' } as any])
            .mockResolvedValueOnce([{ success: true, text: 'Success after retry' } as any]);

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
            { success: false, error: 'Connection timeout after 30000ms' } as any
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
            judgeMode: AgentLoopJudgeModeEnum.enum.DETERMINISTIC_TEST,
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
            { success: true, text: 'Resumed output' } as any
        ]);

        const resumed = await agentLoopService.resumeLoop(def, executionId, context);
        expect(resumed.id).toBe(executionId);

        // Wait for loop completion
        await new Promise(resolve => setTimeout(resolve, 100));

        const execution = agentLoopService.getExecution(executionId);
        expect(execution?.status).toBe(AgentLoopStatusEnum.enum.COMPLETED);
        expect(execution?.history).toHaveLength(2);
        expect(execution?.history[1]?.iteration).toBe(2);
    });
});
