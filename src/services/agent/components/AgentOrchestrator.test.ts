import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AgentOrchestrator } from './AgentOrchestrator';
import { agentRegistry } from '../registry';
import { TraceService } from '../observability/TraceService';

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

// Mock Trace Service
vi.mock('../observability/TraceService', () => ({
    TraceService: {
        startTrace: vi.fn(),
        addStep: vi.fn(),
        completeTrace: vi.fn(),
        failTrace: vi.fn()
    }
}));

// Mock Firebase Auth (implicitly used)
vi.mock('@/services/firebase', () => ({
    auth: {
        currentUser: { uid: 'test-user' }
    }
}));

describe('AgentOrchestrator', () => {
    let orchestrator: AgentOrchestrator;
    const mockAgents = [
        { id: 'legal', name: 'Legal Agent', description: 'Legal stuff', color: 'bg-red-500', category: 'specialist' },
        { id: 'music', name: 'Music Agent', description: 'Music stuff', color: 'bg-blue-500', category: 'specialist' }
    ];

    beforeEach(() => {
        vi.clearAllMocks();
        orchestrator = new AgentOrchestrator();
        (agentRegistry.getAll as any).mockReturnValue(mockAgents);
        (TraceService.startTrace as any).mockResolvedValue('mock-trace-id');
    });

    it('should route to specialist with high confidence', async () => {
        const { AI } = await import('@/services/ai/AIService');
        (AI.generateContent as any).mockResolvedValue({
            text: () => JSON.stringify({
                targetAgentId: 'legal',
                confidence: 0.9,
                reasoning: 'User clearly asked for a contract.'
            })
        });

        const context = { activeModule: 'dashboard' };
        const result = await orchestrator.determineAgent(context as any, 'Draft a contract');

        expect(result).toBe('legal');
        expect(TraceService.addStep).toHaveBeenCalledWith(
            'mock-trace-id',
            'routing',
            expect.objectContaining({
                selectedAgent: 'legal',
                confidence: 0.9
            })
        );
    });

    it('should fallback to generalist with low confidence', async () => {
        const { AI } = await import('@/services/ai/AIService');
        (AI.generateContent as any).mockResolvedValue({
            text: () => JSON.stringify({
                targetAgentId: 'legal',
                confidence: 0.5, // Below 0.7 threshold
                reasoning: 'User mentioned a word related to legal but context is vague.'
            })
        });

        const context = { activeModule: 'dashboard' };
        const result = await orchestrator.determineAgent(context as any, 'maybe something about law?');

        expect(result).toBe('generalist');
        expect(TraceService.addStep).toHaveBeenCalledWith(
            'mock-trace-id',
            'routing',
            expect.objectContaining({
                selectedAgent: 'generalist',
                confidence: 0.5
            })
        );
    });

    it('should fallback to generalist on JSON parse error', async () => {
        const { AI } = await import('@/services/ai/AIService');
        (AI.generateContent as any).mockResolvedValue({
            text: () => 'Not a valid JSON'
        });

        const context = { activeModule: 'dashboard' };
        const result = await orchestrator.determineAgent(context as any, 'random query');

        expect(result).toBe('generalist');

        expect(TraceService.addStep).toHaveBeenCalledWith(
            'mock-trace-id',
            'routing',
            expect.objectContaining({
                selectedAgent: 'generalist',
                reasoning: 'JSON Parse Error, fallback to generalist'
            })
        );
    });

    it('should sanitize input before routing', async () => {
        const { AI } = await import('@/services/ai/AIService');
        (AI.generateContent as any).mockResolvedValue({
            text: () => JSON.stringify({ targetAgentId: 'generalist', confidence: 1, reasoning: 'fallback' })
        });

        const context = { activeModule: 'dashboard' };
        const unsafeInput = 'Hello <script>alert(1)</script>';
        await orchestrator.determineAgent(context as any, unsafeInput);

        const callArgs = (AI.generateContent as any).mock.calls[0][0];
        const prompt = callArgs.contents.parts[0].text;

        expect(prompt).toContain('Hello');
        expect(prompt).not.toContain('<script>');
    });
});
