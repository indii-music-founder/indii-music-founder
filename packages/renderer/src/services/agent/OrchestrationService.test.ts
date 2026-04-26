import { describe, it, expect, vi, beforeEach } from 'vitest';
import { orchestrationService } from './OrchestrationService';
import { maestroBatchingService } from './MaestroBatchingService';
import { workflowStateService } from './WorkflowStateService';
import { WORKFLOW_REGISTRY } from './WorkflowRegistry';
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
        skipStep: vi.fn(),
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
            steps: {
                'brand_analysis': { stepId: 'brand_analysis', agentId: 'brand', prompt: 'Analyze brand', status: 'planned' } as WorkflowStepExecution,
                'press_release': { stepId: 'press_release', agentId: 'publicist', prompt: 'Generate press release', status: 'planned' } as WorkflowStepExecution,
                'marketing_strategy': { stepId: 'marketing_strategy', agentId: 'marketing', prompt: 'Marketing strategy', status: 'planned' } as WorkflowStepExecution,
                'social_drafts': { stepId: 'social_drafts', agentId: 'social', prompt: 'Social drop posts', status: 'planned' } as WorkflowStepExecution,
            },
            edges: WORKFLOW_REGISTRY['CAMPAIGN_LAUNCH']!.edges,
            createdAt: 1000,
            updatedAt: 1000,
        };

        vi.mocked(workflowStateService.createExecution).mockResolvedValue(mockExecution);
        vi.mocked(workflowStateService.getExecution)
            .mockResolvedValueOnce(mockExecution) // Loop 1: Start
            .mockResolvedValue({
                ...mockExecution,
                steps: {
                    'brand_analysis': { stepId: 'brand_analysis', agentId: 'brand', prompt: 'Analyze brand', status: 'step_complete' } as WorkflowStepExecution,
                    'press_release': { stepId: 'press_release', agentId: 'publicist', prompt: 'Generate press release', status: 'step_complete' } as WorkflowStepExecution,
                    'marketing_strategy': { stepId: 'marketing_strategy', agentId: 'marketing', prompt: 'Marketing strategy', status: 'step_complete' } as WorkflowStepExecution,
                    'social_drafts': { stepId: 'social_drafts', agentId: 'social', prompt: 'Social drop posts', status: 'step_complete' } as WorkflowStepExecution,
                }
            }); // Subsequent loops

        vi.mocked(workflowStateService.advanceStep).mockResolvedValue(mockExecution);

        vi.mocked(maestroBatchingService.executeBatch).mockResolvedValue([
            { success: true, text: 'Step result' },
        ]);

        const result = await orchestrationService.executeOrchestratedWorkflow(
            'Launch my summer campaign',
            mockContext as unknown as Parameters<typeof orchestrationService.executeOrchestratedWorkflow>[1]
        );

        expect(result).toContain('Workflow Report: Campaign Launch');
        expect(result).toContain('Step: brand_analysis [BRAND]');
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
            steps: {
                'design_concepts': { stepId: 'design_concepts', agentId: 'creative', prompt: 'Generate designs', status: 'planned' } as WorkflowStepExecution,
                'pricing_strategy': { stepId: 'pricing_strategy', agentId: 'marketing', prompt: 'Product description', status: 'planned' } as WorkflowStepExecution,
                'teaser_campaign': { stepId: 'teaser_campaign', agentId: 'social', prompt: 'Teaser campaign', status: 'planned' } as WorkflowStepExecution,
            },
            edges: WORKFLOW_REGISTRY['AI_MERCH_DROP']!.edges,
            createdAt: 1000,
            updatedAt: 1000,
        };

        vi.mocked(workflowStateService.createExecution).mockResolvedValue(mockExecution);
        vi.mocked(workflowStateService.getExecution).mockResolvedValue(mockExecution);
        vi.mocked(workflowStateService.failStep).mockResolvedValue({
            ...mockExecution,
            status: 'failed' as const,
            steps: {
                'design_concepts': { ...mockExecution.steps['design_concepts']!, status: 'failed' as const, error: 'Generation failed' },
                'pricing_strategy': mockExecution.steps['pricing_strategy']!,
                'teaser_campaign': mockExecution.steps['teaser_campaign']!,
            },
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
        expect(result).toContain('Workflow execution halted.');
        expect(workflowStateService.failStep).toHaveBeenCalledWith('test-user', 'exec-2', 'design_concepts', 'Generation failed');
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

    it('should route "deploy protocol" to INDII_GROWTH_PROTOCOL', async () => {
        const mockExecution: WorkflowExecution = {
            id: 'exec-3',
            workflowId: 'INDII_GROWTH_PROTOCOL',
            userId: 'test-user',
            status: 'planned',
            steps: {
                'video_generation': { stepId: 'video_generation', agentId: 'workflow', prompt: 'Trigger Node recipe', status: 'planned' } as WorkflowStepExecution,
                'ad_deployment': { stepId: 'ad_deployment', agentId: 'marketing', prompt: 'Deploy all creative', status: 'planned' } as WorkflowStepExecution,
            },
            edges: WORKFLOW_REGISTRY['INDII_GROWTH_PROTOCOL']!.edges,
            createdAt: 1000,
            updatedAt: 1000,
        };

        vi.mocked(workflowStateService.createExecution).mockResolvedValue(mockExecution);
        vi.mocked(workflowStateService.getExecution)
            .mockResolvedValueOnce(mockExecution)
            .mockResolvedValue({
                ...mockExecution,
                steps: {
                    'video_generation': { stepId: 'video_generation', agentId: 'workflow', prompt: 'Trigger Node recipe', status: 'step_complete' } as WorkflowStepExecution,
                    'ad_deployment': { stepId: 'ad_deployment', agentId: 'marketing', prompt: 'Deploy all creative', status: 'step_complete' } as WorkflowStepExecution,
                }
            });
        vi.mocked(workflowStateService.advanceStep).mockResolvedValue(mockExecution);

        vi.mocked(maestroBatchingService.executeBatch).mockResolvedValue([
            { success: true, text: 'Step result' },
        ]);

        const result = await orchestrationService.executeOrchestratedWorkflow(
            'Deploy protocol for my new track',
            mockContext as unknown as Parameters<typeof orchestrationService.executeOrchestratedWorkflow>[1]
        );

        expect(result).toContain('Workflow Report: indii Growth Protocol');
        expect(result).toContain('Step: video_generation [WORKFLOW]');
        expect(workflowStateService.createExecution).toHaveBeenCalledWith(
            'test-user',
            'INDII_GROWTH_PROTOCOL',
            expect.any(Array),
            expect.any(Array),
            'test-project'
        );
    });

    it('should require userId for workflow execution', async () => {
        await expect(orchestrationService.executeWorkflow(
            'CAMPAIGN_LAUNCH',
            { projectId: 'test' } as unknown as Parameters<typeof orchestrationService.executeWorkflow>[1]
        )).rejects.toThrow('userId is required');
    });

    it('should process steps in parallel when dependencies are met', async () => {
        // Register a custom workflow with parallel steps
        WORKFLOW_REGISTRY['PARALLEL_WORKFLOW'] = {
            id: 'PARALLEL_WORKFLOW',
            name: 'Parallel Workflow',
            description: 'Test parallel execution',
            steps: [
                { id: 'step1', agentId: 'agent1', prompt: 'prompt1', priority: 'HIGH' },
                { id: 'step2a', agentId: 'agent2', prompt: 'prompt2a', priority: 'HIGH' },
                { id: 'step2b', agentId: 'agent3', prompt: 'prompt2b', priority: 'HIGH' },
                { id: 'step3', agentId: 'agent4', prompt: 'prompt3', priority: 'HIGH' }
            ],
            edges: [
                { from: 'step1', to: 'step2a' },
                { from: 'step1', to: 'step2b' },
                { from: 'step2a', to: 'step3' },
                { from: 'step2b', to: 'step3' }
            ]
        };

        const mockExecution: WorkflowExecution = {
            id: 'exec-parallel',
            workflowId: 'PARALLEL_WORKFLOW',
            userId: 'test-user',
            status: 'planned',
            steps: {
                'step1': { stepId: 'step1', agentId: 'agent1', prompt: 'prompt1', status: 'planned' } as WorkflowStepExecution,
                'step2a': { stepId: 'step2a', agentId: 'agent2', prompt: 'prompt2a', status: 'planned' } as WorkflowStepExecution,
                'step2b': { stepId: 'step2b', agentId: 'agent3', prompt: 'prompt2b', status: 'planned' } as WorkflowStepExecution,
                'step3': { stepId: 'step3', agentId: 'agent4', prompt: 'prompt3', status: 'planned' } as WorkflowStepExecution,
            },
            edges: WORKFLOW_REGISTRY['PARALLEL_WORKFLOW']!.edges,
            createdAt: 1000,
            updatedAt: 1000,
        };

        vi.mocked(workflowStateService.createExecution).mockResolvedValue(mockExecution);
        vi.mocked(workflowStateService.getExecution)
            .mockResolvedValueOnce(mockExecution) // Loop 1: step1
            .mockResolvedValueOnce({
                ...mockExecution,
                steps: {
                    ...mockExecution.steps,
                    'step1': { ...mockExecution.steps['step1']!, status: 'step_complete' }
                }
            }) // Loop 2: step2a and step2b
            .mockResolvedValueOnce({
                ...mockExecution,
                steps: {
                    ...mockExecution.steps,
                    'step1': { ...mockExecution.steps['step1']!, status: 'step_complete' },
                    'step2a': { ...mockExecution.steps['step2a']!, status: 'step_complete' },
                    'step2b': { ...mockExecution.steps['step2b']!, status: 'step_complete' }
                }
            }) // Loop 3: step3
            .mockResolvedValue({
                ...mockExecution,
                steps: {
                    ...mockExecution.steps,
                    'step1': { ...mockExecution.steps['step1']!, status: 'step_complete' },
                    'step2a': { ...mockExecution.steps['step2a']!, status: 'step_complete' },
                    'step2b': { ...mockExecution.steps['step2b']!, status: 'step_complete' },
                    'step3': { ...mockExecution.steps['step3']!, status: 'step_complete' }
                }
            }); // Final loop and completion check

        vi.mocked(workflowStateService.advanceStep).mockResolvedValue(mockExecution);
        vi.mocked(maestroBatchingService.executeBatch).mockResolvedValue([
            { success: true, text: 'Result' },
            { success: true, text: 'Result' }
        ]);

        await orchestrationService.executeWorkflow(
            'PARALLEL_WORKFLOW',
            mockContext as unknown as Parameters<typeof orchestrationService.executeWorkflow>[1]
        );

        // maestroBatchingService should be called 3 times (step1; step2a+step2b; step3)
        expect(maestroBatchingService.executeBatch).toHaveBeenCalledTimes(3);
        
        // Check second call was parallel
        const secondCallArgs = vi.mocked(maestroBatchingService.executeBatch).mock.calls[1]?.[0];
        expect(secondCallArgs).toBeDefined();
        if (secondCallArgs) {
            expect(secondCallArgs.length).toBe(2);
            expect(secondCallArgs[0]?.agentId).toBe('agent2');
            expect(secondCallArgs[1]?.agentId).toBe('agent3');
        }
    });

    it('should skip step when edge condition evaluates to false', async () => {
        // Register custom workflow with conditional edge
        WORKFLOW_REGISTRY['CONDITIONAL_WORKFLOW'] = {
            id: 'CONDITIONAL_WORKFLOW',
            name: 'Conditional Workflow',
            description: 'Test conditional skipping',
            steps: [
                { id: 'step1', agentId: 'agent1', prompt: 'prompt1', priority: 'HIGH' },
                { id: 'step2', agentId: 'agent2', prompt: 'prompt2', priority: 'HIGH' },
                { id: 'step3', agentId: 'agent3', prompt: 'prompt3', priority: 'HIGH' }
            ],
            edges: [
                { from: 'step1', to: 'step2', condition: () => false }, // Should skip step2
                { from: 'step2', to: 'step3' } // step3 should run after step2 is skipped
            ]
        };

        const mockExecution: WorkflowExecution = {
            id: 'exec-cond',
            workflowId: 'CONDITIONAL_WORKFLOW',
            userId: 'test-user',
            status: 'planned',
            steps: {
                'step1': { stepId: 'step1', agentId: 'agent1', prompt: 'prompt1', status: 'planned' } as WorkflowStepExecution,
                'step2': { stepId: 'step2', agentId: 'agent2', prompt: 'prompt2', status: 'planned' } as WorkflowStepExecution,
                'step3': { stepId: 'step3', agentId: 'agent3', prompt: 'prompt3', status: 'planned' } as WorkflowStepExecution,
            },
            edges: WORKFLOW_REGISTRY['CONDITIONAL_WORKFLOW']!.edges,
            createdAt: 1000,
            updatedAt: 1000,
        };

        vi.mocked(workflowStateService.createExecution).mockResolvedValue(mockExecution);
        vi.mocked(workflowStateService.getExecution)
            .mockResolvedValueOnce(mockExecution) // Loop 1: step1
            .mockResolvedValueOnce({
                ...mockExecution,
                steps: {
                    ...mockExecution.steps,
                    'step1': { ...mockExecution.steps['step1']!, status: 'step_complete' }
                }
            }) // Loop 2: evaluates step2 (skips)
            .mockResolvedValueOnce({
                ...mockExecution,
                steps: {
                    ...mockExecution.steps,
                    'step1': { ...mockExecution.steps['step1']!, status: 'step_complete' },
                    'step2': { ...mockExecution.steps['step2']!, status: 'skipped' }
                }
            }) // Loop 3: step3 runs
            .mockResolvedValue({
                ...mockExecution,
                steps: {
                    ...mockExecution.steps,
                    'step1': { ...mockExecution.steps['step1']!, status: 'step_complete' },
                    'step2': { ...mockExecution.steps['step2']!, status: 'skipped' },
                    'step3': { ...mockExecution.steps['step3']!, status: 'step_complete' }
                }
            });

        vi.mocked(workflowStateService.advanceStep).mockResolvedValue(mockExecution);
        vi.mocked(workflowStateService.skipStep).mockResolvedValue(mockExecution);
        vi.mocked(maestroBatchingService.executeBatch).mockResolvedValue([
            { success: true, text: 'Result' }
        ]);

        const result = await orchestrationService.executeWorkflow(
            'CONDITIONAL_WORKFLOW',
            mockContext as unknown as Parameters<typeof orchestrationService.executeWorkflow>[1]
        );

        expect(workflowStateService.skipStep).toHaveBeenCalledWith('test-user', 'exec-cond', 'step2', 'Graph condition evaluated to false');
        expect(result).toContain('(SKIPPED)');
        expect(result).toContain('Conditional path not taken.');
    });
});
