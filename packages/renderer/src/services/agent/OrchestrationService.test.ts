import { beforeEach, describe, expect, it, vi } from 'vitest';

const { createExecution, getExecution, resumeExecution } = vi.hoisted(() => ({
    createExecution: vi.fn(),
    getExecution: vi.fn(),
    resumeExecution: vi.fn(),
}));
vi.mock('./WorkflowStateService', () => ({ workflowStateService: { createExecution, getExecution, resumeExecution } }));
vi.mock('@/utils/logger', () => ({ logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() } }));

import { OrchestrationService } from './OrchestrationService';

describe('OrchestrationService', () => {
    const service = new OrchestrationService();
    const context = { projectId: 'project-1', userId: 'test-user' } as Parameters<typeof service.executeWorkflowWithStatus>[1];

    beforeEach(() => vi.clearAllMocks());

    it('returns queued until server-owned persisted state reports completion', async () => {
        createExecution.mockResolvedValue({ id: 'exec-1', status: 'PLANNED' });
        const result = await service.executeWorkflowWithStatus('CAMPAIGN_LAUNCH', context);
        expect(result).toEqual({
            executionId: 'exec-1',
            report: expect.stringContaining('was queued'),
            completed: false,
        });
        expect(createExecution).toHaveBeenCalledOnce();
        expect(result.report).not.toContain('completed');
    });

    it('never runs steps locally after persisting the execution', async () => {
        createExecution.mockResolvedValue({ id: 'exec-2', status: 'PLANNED' });
        await service.executeWorkflow('AI_MERCH_DROP', context);
        expect(createExecution).toHaveBeenCalledOnce();
        expect(getExecution).not.toHaveBeenCalled();
    });

    it('only resumes failed executions through the owner callable', async () => {
        getExecution.mockResolvedValue({ id: 'exec-3', workflowId: 'CAMPAIGN_LAUNCH', status: 'FAILED' });
        resumeExecution.mockResolvedValue(undefined);
        await expect(service.resumeWorkflow('exec-3', context)).resolves.toContain('Resume requested');
        expect(resumeExecution).toHaveBeenCalledWith('test-user', 'exec-3');
    });

    it('refuses campaign starts without a project', async () => {
        await expect(service.executeOrchestratedWorkflow('launch campaign', { userId: 'test-user' } as never)).rejects.toThrow('project must be active');
    });
});
