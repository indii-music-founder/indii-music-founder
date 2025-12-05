import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AgentOrchestrator } from './AgentOrchestrator';
import { agentRegistry } from '../registry';

// Mock AI Service
vi.mock('@/services/ai/AIService', () => ({
    AI: {
        generateContent: vi.fn(),
    },
}));

// Mock Registry
vi.mock('../registry', () => ({
    agentRegistry: {
        getAll: vi.fn(),
    }
}));

describe('AgentOrchestrator', () => {
    let orchestrator: AgentOrchestrator;
    const mockAgents = [
        { id: 'test-agent', name: 'Test Agent', description: 'A test agent.', color: 'bg-red-500', category: 'specialist' },
        { id: 'another-agent', name: 'Another Agent', description: 'Another test agent.', color: 'bg-blue-500', category: 'manager' }
    ];

    beforeEach(() => {
        vi.clearAllMocks();
        orchestrator = new AgentOrchestrator();
        (agentRegistry.getAll as any).mockReturnValue(mockAgents);
    });

    it('should use agents from the registry', async () => {
        const { AI } = await import('@/services/ai/AIService');
        (AI.generateContent as any).mockResolvedValue({
            text: () => 'test-agent'
        });

        const context = { currentModule: 'dashboard' };
        await orchestrator.determineAgent(context as any, 'help me');

        const callArgs = (AI.generateContent as any).mock.calls[0][0];
        const prompt = callArgs.contents.parts[0].text;

        expect(prompt).toContain('Test Agent');
        expect(prompt).toContain('Another Agent');
        expect(prompt).toContain('A test agent.');
    });

    it('should fallback to generalist if routing fails', async () => {
        const { AI } = await import('@/services/ai/AIService');
        (AI.generateContent as any).mockResolvedValue({
            text: () => 'unknown-agent'
        });

        const context = { currentModule: 'dashboard' };
        const result = await orchestrator.determineAgent(context as any, 'help me');

        expect(result).toBe('generalist');
    });
});
