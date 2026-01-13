import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BaseAgent } from '../BaseAgent';
import { AI } from '../../ai/AIService';
import { WrappedResponse, StreamChunk } from '@/shared/types/ai.dto';
import { agentService } from '../AgentService';

// Mock AI
vi.mock('../../ai/AIService', () => ({
    AI: {
        generateContentStream: vi.fn()
    }
}));

// Mock AgentService
vi.mock('../AgentService', () => ({
    agentService: {
        runAgent: vi.fn()
    }
}));

// Mock Firebase Auth
vi.mock('@/services/firebase', () => ({
    auth: {
        currentUser: { uid: 'test-user' }
    },
    db: {}
}));

class ManagerAgent extends BaseAgent {
    constructor() {
        super({
            id: 'generalist',
            name: 'Manager',
            description: 'Agent for testing collaboration',
            systemPrompt: 'You are a manager.',
            category: 'manager',
            color: 'bg-blue-500',
            tools: [],
            functions: {}
        });
    }
}

describe('Agent Collaboration', () => {
    let agent: ManagerAgent;

    beforeEach(() => {
        vi.clearAllMocks();
        agent = new ManagerAgent();
    });

    it('should delegate a task using delegate_task', async () => {
        // 1. Mock the first agent call (which will decide to delegate)
        const mockStream = new ReadableStream<StreamChunk>({
            start(controller) {
                controller.close();
            }
        });

        const mockResponse: WrappedResponse = {
            response: {} as any,
            text: () => 'Delegating...',
            functionCalls: () => [{ name: 'delegate_task', args: { targetAgentId: 'marketing', task: 'Create a plan' } }],
            usage: vi.fn().mockReturnValue({
                promptTokenCount: 10,
                candidatesTokenCount: 20,
                totalTokenCount: 30
            })
        };

        (AI.generateContentStream as any).mockResolvedValue({
            stream: mockStream,
            response: Promise.resolve(mockResponse)
        });

        // 2. Mock the specialist response
        (agentService.runAgent as any).mockResolvedValue({
            text: 'Here is the marketing plan.'
        });

        const result = await agent.execute('Help with marketing', { traceId: 'parent-trace-123' });

        // Verify delegation call
        expect(agentService.runAgent).toHaveBeenCalledWith(
            'marketing',
            'Create a plan',
            expect.any(Object),
            'parent-trace-123',
            undefined
        );

        expect(result.text).toContain('marketing plan');
    });

    it('should consult multiple experts in parallel using consult_experts', async () => {
        // 1. Mock the first agent call (which will decide to consult experts)
        const mockStream = new ReadableStream<StreamChunk>({
            start(controller) {
                controller.close();
            }
        });

        const mockResponse: WrappedResponse = {
            response: {} as any,
            text: () => 'Consulting experts...',
            functionCalls: () => [{
                name: 'consult_experts',
                args: {
                    consultations: [
                        { targetAgentId: 'producer', task: 'Analyze audio' },
                        { targetAgentId: 'marketing', task: 'Draft tweet' }
                    ]
                }
            }],
            usage: vi.fn().mockReturnValue({
                promptTokenCount: 10,
                candidatesTokenCount: 20,
                totalTokenCount: 30
            })
        };

        (AI.generateContentStream as any).mockResolvedValue({
            stream: mockStream,
            response: Promise.resolve(mockResponse)
        });

        // 2. Mock specialist responses
        (agentService.runAgent as any).mockImplementation(async (id: string) => {
            if (id === 'producer') return { text: 'Audio is fine.' };
            if (id === 'marketing') return { text: 'Tweet drafted.' };
            return { text: 'Unknown' };
        });

        const result = await agent.execute('Analyze and market this track', { traceId: 'main-trace' });

        // Verify parallel calls
        expect(agentService.runAgent).toHaveBeenCalledTimes(2);

        // Check results aggregation
        expect((result.data as any).success).toBe(true);
        expect((result.data as any).data.results).toHaveLength(2);
        expect((result.data as any).data.results[0].response.text).toBe('Audio is fine.');
        expect((result.data as any).data.results[1].response.text).toBe('Tweet drafted.');
    });
});
