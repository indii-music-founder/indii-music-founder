import { describe, it, expect, vi, beforeEach } from 'vitest';
import { agentLoopService } from './AgentLoopService';
import { maestroBatchingService } from '../MaestroBatchingService';
import { FirebaseIntelligenceService } from '@/services/intelligence/FirebaseIntelligenceService';
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
});
