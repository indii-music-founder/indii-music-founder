import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BaseAgent } from '../BaseAgent';
import { GenAI as AI } from '../../ai/GenAI';
import { AI_MODELS } from '@/core/config/ai-models';
import { WrappedResponse, StreamChunk } from '@/shared/types/ai.dto';

// Mock the entire AI service
vi.mock('../../ai/GenAI', () => ({
    GenAI: {
        generateContentStream: vi.fn(),
        generateContent: vi.fn(),
        batchEmbedContents: vi.fn().mockResolvedValue({ embeddings: [] })
    }
}));

// Mock MembershipService for budget checks
vi.mock('@/services/MembershipService', () => ({
    MembershipService: {
        checkBudget: vi.fn().mockResolvedValue({ allowed: true }),
        recordSpend: vi.fn().mockResolvedValue(undefined)
    }
}));

import { GeneralistAgent } from '../specialists/GeneralistAgent';

vi.mock('@/core/store', () => ({
    useStore: {
        getState: vi.fn().mockReturnValue({
            agentHistory: [],
            addAgentMessage: vi.fn(),
            updateAgentMessage: vi.fn(),
            currentOrganizationId: 'org1',
            currentProjectId: 'proj1',
            uploadedImages: [],
            currentModule: 'testing'
        })
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
        getAsync: vi.fn(),
        get: vi.fn()
    }
}));

// A dummy agent for testing
class TestAgent extends GeneralistAgent {
    constructor() {
        super();
        this.id = 'generalist';
        this.name = 'Test Agent';
        this.description = 'Agent for testing streaming';
        this.systemPrompt = 'You are a test agent.';
        this.color = 'bg-blue-500';
        this.category = 'specialist';
        this.tools = [];
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
            response: {} as unknown as WrappedResponse['response'],
            text: () => tokens.join(''),
            functionCalls: () => [],
            usage: () => undefined
        };

        vi.mocked(AI.generateContentStream).mockResolvedValue({
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
            } as unknown as WrappedResponse['response'],
            text: () => 'I will save this.',
            functionCalls: () => [{ name: 'save_memory', args: { content: 'test' } }],
            usage: () => undefined
        };

        vi.mocked(AI.generateContentStream).mockResolvedValue({
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
