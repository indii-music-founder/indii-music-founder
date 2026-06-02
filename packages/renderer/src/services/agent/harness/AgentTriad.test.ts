import { describe, expect, it, vi } from 'vitest';
import { AgentTriad, type AgentContext } from './AgentTriad';

const context: AgentContext = {
    workflowId: 'workflow-1',
    stepId: 'step-1',
    userId: 'user-1',
};

describe('AgentTriad', () => {
    it('fails explicitly when planner, generator, and evaluator agents are not configured', async () => {
        const triad = new AgentTriad();

        const result = await triad.executeTriadLoop(context, 'Build a campaign plan');

        expect(result.status).toBe('FAILED');
        expect(result.error).toContain('requires configured planner, generator, and evaluator agents');
    });

    it('retries generation with evaluator feedback until evaluation passes', async () => {
        const planner = {
            plan: vi.fn().mockResolvedValue('Use a staged release plan.'),
        };
        const generator = {
            generate: vi.fn()
                .mockResolvedValueOnce('Draft with missing audience notes.')
                .mockResolvedValueOnce('Draft with audience notes included.'),
        };
        const evaluator = {
            evaluate: vi.fn()
                .mockResolvedValueOnce({ passed: false, feedback: 'Add audience notes.' })
                .mockResolvedValueOnce({ passed: true }),
        };
        const triad = new AgentTriad({ planner, generator, evaluator });

        const result = await triad.executeTriadLoop(context, 'Build a campaign plan');

        expect(result.status).toBe('STEP_COMPLETE');
        expect(result.result).toBe('Draft with audience notes included.');
        expect(generator.generate).toHaveBeenLastCalledWith(
            context,
            'Build a campaign plan',
            'Use a staged release plan.',
            'Add audience notes.'
        );
    });
});
