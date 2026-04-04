import { describe, it, expect, vi, beforeEach } from 'vitest';
import { orchestrationService } from './OrchestrationService';
import { maestroBatchingService } from './MaestroBatchingService';
import { workflowStateService } from './WorkflowStateService';
import type { WorkflowExecution, WorkflowStepExecution } from './types';

// Mock dependencies
vi.mock('./MaestroBatchingService', () => ({
    maestroBatchingService: {
        executeBatch: vi.fn()
    }
}));

vi.mock('./WorkflowStateService', () => ({
    workflowStateService: {
        createExecution: vi.fn(),
        markStepExecuting: vi.fn().mockResolvedValue(undefined),
        advanceStep: vi.fn(),
        failStep: vi.fn(),
        getExecution: vi.fn(),
        cancelExecution: vi.fn().mockResolvedValue(undefined),
    }
}));

describe('OrchestrationService', () => {
    const mockContext = {
        projectId: 'test-project',
        userId: 'test-user'
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should route campaign launch to the correct workflow with state tracking', async () => {
        const mockExecution: WorkflowExecution = {
            id: 'exec-1',
            workflowId: 'CAMPAIGN_LAUNCH',
            userId: 'test-user',
            status: 'planned',
            currentStepIndex: 0,
            steps: [
                { stepIndex: 0, agentId: 'brand', prompt: 'Analyze brand', status: 'planned' } as WorkflowStepExecution,
                { stepIndex: 1, agentId: 'publicist', prompt: 'Generate press release', status: 'planned' } as WorkflowStepExecution,
                { stepIndex: 2, agentId: 'marketing', prompt: 'Marketing strategy', status: 'planned' } as WorkflowStepExecution,
                { stepIndex: 3, agentId: 'social', prompt: 'Social drop posts', status: 'planned' } as WorkflowStepExecution,
            ],
            createdAt: 1000,
            updatedAt: 1000,
        };

        vi.mocked(workflowStateService.createExecution).mockResolvedValue(mockExecution);
        vi.mocked(workflowStateService.getExecution).mockResolvedValue(mockExecution);
        vi.mocked(workflowStateService.advanceStep).mockResolvedValue(mockExecution);

        vi.mocked(maestroBatchingService.executeBatch).mockResolvedValue([
            { success: true, text: 'Step result' },
        ]);

        const result = await orchestrationService.executeOrchestratedWorkflow(
            'Launch my summer campaign',
            mockContext as unknown as Parameters<typeof orchestrationService.executeOrchestratedWorkflow>[1]
        );

        expect(result).toContain('Workflow Report: Campaign Launch');
        expect(result).toContain('Step 1: BRAND');
        expect(workflowStateService.createExecution).toHaveBeenCalled();
        expect(workflowStateService.markStepExecuting).toHaveBeenCalled();
        expect(workflowStateService.advanceStep).toHaveBeenCalled();
    });

    it('should persist failure on the exact step and halt', async () => {
        const mockExecution: WorkflowExecution = {
            id: 'exec-2',
            workflowId: 'AI_MERCH_DROP',
            userId: 'test-user',
            status: 'planned',
            currentStepIndex: 0,
            steps: [
                { stepIndex: 0, agentId: 'creative', prompt: 'Generate designs', status: 'planned' } as WorkflowStepExecution,
                { stepIndex: 1, agentId: 'marketing', prompt: 'Product description', status: 'planned' } as WorkflowStepExecution,
                { stepIndex: 2, agentId: 'social', prompt: 'Teaser campaign', status: 'planned' } as WorkflowStepExecution,
            ],
            createdAt: 1000,
            updatedAt: 1000,
        };

        vi.mocked(workflowStateService.createExecution).mockResolvedValue(mockExecution);
        vi.mocked(workflowStateService.getExecution).mockResolvedValue(mockExecution);
        vi.mocked(workflowStateService.failStep).mockResolvedValue({
            ...mockExecution,
            status: 'failed' as const,
            steps: [
                { ...mockExecution.steps[0]!, status: 'failed' as const, error: 'Generation failed' },
                mockExecution.steps[1]!,
                mockExecution.steps[2]!,
            ],
        });

        // First step fails
        vi.mocked(maestroBatchingService.executeBatch).mockResolvedValue([
            { success: false, error: 'Generation failed' },
        ]);

        const result = await orchestrationService.executeOrchestratedWorkflow(
            'Plan a new merch drop',
            mockContext as unknown as Parameters<typeof orchestrationService.executeOrchestratedWorkflow>[1]
        );

        expect(result).toContain('FAILED');
        expect(result).toContain('exec-2'); // Execution ID for resumption
        expect(result).toContain('Remaining steps preserved');
        expect(workflowStateService.failStep).toHaveBeenCalledWith('test-user', 'exec-2', 0, 'Generation failed');
        // Step 2 and 3 were never attempted
        expect(workflowStateService.advanceStep).not.toHaveBeenCalled();
    });

    it('should throw error if no project is active', async () => {
        await expect(orchestrationService.executeOrchestratedWorkflow(
            'launch campaign',
            { userId: '123' } as unknown as Parameters<typeof orchestrationService.executeOrchestratedWorkflow>[1]
        )).rejects.toThrow('A project must be active to launch a campaign.');
    });

    it('should return null for unknown intents', async () => {
        const result = await orchestrationService.executeOrchestratedWorkflow(
            'Hello assistant',
            mockContext as unknown as Parameters<typeof orchestrationService.executeOrchestratedWorkflow>[1]
        );
        expect(result).toBeNull();
    });

    it('should require userId for workflow execution', async () => {
        await expect(orchestrationService.executeWorkflow(
            'CAMPAIGN_LAUNCH',
            { projectId: 'test' } as unknown as Parameters<typeof orchestrationService.executeWorkflow>[1]
        )).rejects.toThrow('userId is required');
    });
});
