import { describe, expect, it, vi, beforeEach } from 'vitest';
import { AgentOptimizer } from './AgentOptimizer';

const mockGetExecutionsByUser = vi.hoisted(() => vi.fn());

vi.mock('../WorkflowStateService', () => ({
    workflowStateService: {
        getExecutionsByUser: mockGetExecutionsByUser,
    },
}));

describe('AgentOptimizer', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('counts legacy lowercase failed statuses without carrying metrics into later analyses', async () => {
        const optimizer = new AgentOptimizer();
        mockGetExecutionsByUser
            .mockResolvedValueOnce([
                {
                    id: 'exec-1',
                    steps: {
                        first: { agentId: 'marketing', status: 'failed' },
                        second: { agentId: 'marketing', status: 'STEP_COMPLETE' },
                    },
                },
            ])
            .mockResolvedValueOnce([]);

        const firstRun = await optimizer.analyzePerformance('user-1');
        const secondRun = await optimizer.analyzePerformance('user-1');

        expect(firstRun).toHaveLength(1);
        expect(firstRun[0]!.agentId).toBe('marketing');
        expect(firstRun[0]!.description).toContain('50% failure rate');
        expect(secondRun).toHaveLength(0);
    });

    it('reports shield-trigger suggestions even when an agent has no workflow executions yet', async () => {
        const optimizer = new AgentOptimizer();
        optimizer.recordShieldTrigger('security', [{
            category: 'prompt_injection',
            pattern: 'ignore previous instructions',
            severity: 'high',
            message: 'Blocked prompt injection attempt.',
        }]);
        mockGetExecutionsByUser.mockResolvedValue([]);

        const suggestions = await optimizer.analyzePerformance('user-1');

        expect(suggestions).toHaveLength(1);
        expect(suggestions[0]!.agentId).toBe('security');
        expect(suggestions[0]!.type).toBe('tool_clarification');
    });
});
