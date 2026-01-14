import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BaseAgent } from '../BaseAgent';
import { AI } from '../../ai/AIService';
import { AI_MODELS } from '@/core/config/ai-models';
import { WrappedResponse, StreamChunk } from '@/shared/types/ai.dto';

// Mock the entire AI service
vi.mock('../../ai/AIService', () => ({
    AI: {
        generateContentStream: vi.fn()
    }
}));

// Mock dependencies
vi.mock('../AgentService', () => ({
    agentService: {
        runAgent: vi.fn().mockResolvedValue({ role: 'model', text: 'Task executing', timestamp: Date.now() })
    }
}));

vi.mock('../registry', () => ({
    agentRegistry: {
        getAsync: vi.fn()
    }
}));

// A dummy agent for testing
class TestAgent extends BaseAgent {
    constructor() {
        super({
            id: 'generalist',
            name: 'Test Agent',
            description: 'Agent for testing streaming',
            systemPrompt: 'You are a test agent.',
            color: 'bg-blue-500',
            category: 'specialist',
            tools: []
        });
    }
}

describe('Agent Streaming', () => {
    let agent: TestAgent;

    beforeEach(() => {
        vi.clearAllMocks();
        agent = new TestAgent();
    });

    it('should stream tokens to onProgress', async () => {
        const tokens = ['Hello', ' world', '!'];

        // Mock the stream
        const mockStream = new ReadableStream<StreamChunk>({
            start(controller) {
                tokens.forEach(t => controller.enqueue({
                    text: () => t,
                    functionCalls: () => []
                }));
                controller.close();
            }
        });

        // Mock the final response
        const mockResponse: WrappedResponse = {
            response: {} as any,
            text: () => tokens.join(''),
            functionCalls: () => [],
            usage: () => undefined
        };

        (AI.generateContentStream as any).mockResolvedValue({
            stream: mockStream,
            response: Promise.resolve(mockResponse)
        });

        const progressHistory: any[] = [];
        const onProgress = vi.fn((p) => progressHistory.push(p));

        const result = await agent.execute('Say hello', {}, onProgress);

        expect(result.text).toBe('Hello world!');

        // Check for token progress events
        const tokenEvents = progressHistory.filter(p => p.type === 'token');
        expect(tokenEvents).toHaveLength(3);
        expect(tokenEvents[0].content).toBe('Hello');
        expect(tokenEvents[1].content).toBe(' world');
        expect(tokenEvents[2].content).toBe('!');
    });

    it('should handle tool calls after streaming', async () => {
        const tokens = ['Analyzing', '...'];

        const mockStream = new ReadableStream<StreamChunk>({
            start(controller) {
                tokens.forEach(t => controller.enqueue({
                    text: () => t,
                    functionCalls: () => []
                }));
                controller.close();
            }
        });

        const mockResponse: WrappedResponse = {
            response: {
                candidates: [
                    {
                        content: {
                            parts: [
                                { functionCall: { name: 'save_memory', args: { content: 'test' } } }
                            ]
                        }
                    }
                ]
            } as any,
            text: () => 'I will save this.',
            functionCalls: () => [{ name: 'save_memory', args: { content: 'test' } }],
            usage: () => undefined
        };

        (AI.generateContentStream as any).mockResolvedValue({
            stream: mockStream,
            response: Promise.resolve(mockResponse)
        });

        // Mock the tool execution (BaseAgent handles superpowers internally)
        // We'll just verify the progress reported 'tool' or 'thought' about tool
        const progressHistory: any[] = [];
        const onProgress = vi.fn((p) => progressHistory.push(p));

        await agent.execute('Save this', {}, onProgress);

        // Should see token events
        expect(progressHistory.some(p => p.type === 'token' && p.content === 'Analyzing')).toBe(true);

        // Should see tool call progress
        expect(progressHistory.some(p => p.type === 'tool' && p.toolName === 'save_memory')).toBe(true);
    });
});
