
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { orchestrationService } from './OrchestrationService';
import { maestroBatchingService } from './MaestroBatchingService';

// Mock dependecies
vi.mock('./MaestroBatchingService', () => ({
    maestroBatchingService: {
        executeBatch: vi.fn()
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

    it('should route campaign launch to the correct workflow', async () => {
        const mockResults = [
            { success: true, text: 'Brand Audit result' },
            { success: true, text: 'Publicist result' },
            { success: true, text: 'Marketing result' },
            { success: true, text: 'Social result' }
        ];

        vi.mocked(maestroBatchingService.executeBatch).mockResolvedValue(mockResults);

        const result = await orchestrationService.executeOrchestratedWorkflow(
            'Launch my summer campaign',
            mockContext as any
        );

        expect(result).toContain('Workflow Report: Campaign Launch');
        expect(result).toContain('Step: BRAND');
        expect(maestroBatchingService.executeBatch).toHaveBeenCalled();
    });

    it('should route merch drop to the correct workflow', async () => {
        const mockResults = [
            { success: true, text: 'Creative design' },
            { success: true, text: 'Marketing copy' },
            { success: true, text: 'Social teaser' }
        ];

        vi.mocked(maestroBatchingService.executeBatch).mockResolvedValue(mockResults);

        const result = await orchestrationService.executeOrchestratedWorkflow(
            'Plan a new merch drop',
            mockContext as any
        );

        expect(result).toContain('Workflow Report: AI Merch Drop');
        expect(result).toContain('Step: CREATIVE');
    });

    it('should throw error if no project is active', async () => {
        await expect(orchestrationService.executeOrchestratedWorkflow(
            'launch campaign',
            { userId: '123' } as any
        )).rejects.toThrow('A project must be active to launch a campaign.');
    });

    it('should return null for unknown intents', async () => {
        const result = await orchestrationService.executeOrchestratedWorkflow(
            'Hello assistant',
            mockContext as any
        );
        expect(result).toBeNull();
    });
});
