import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AutonomousIntelligence as AI } from '../../intelligence/AutonomousIntelligence';
import { WrappedResponse, StreamChunk } from '@/shared/types/ai.dto';

// Mock the entire Intelligence service
vi.mock('../../intelligence/AutonomousIntelligence', () => ({
    AutonomousIntelligence: {
        generateContentStream: vi.fn(),
        generateContent: vi.fn(),
        batchEmbedContents: vi.fn().mockResolvedValue([])
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
import { useStore } from '@/core/store';
import { MembershipService } from '@/services/MembershipService';

vi.mock('@/core/store', () => ({
    useStore: {
        getState: vi.fn().mockReturnValue({
            agentHistory: [],
            addAgentMessage: vi.fn(),
            updateAgentMessage: vi.fn(),
            currentOrganizationId: 'org1',
            currentProjectId: 'proj1',
            uploadedImages: [],
            currentModule: 'debug',
            userProfile: { id: 'test-user', uid: 'test-user', email: 'test@example.com' }
        } as any)
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

import { ModelArmor } from '../governance/ModelArmor';

describe('Agent Streaming', () => {
    let agent: TestAgent;

    beforeEach(() => {
        // Reset all mocks to ensure return value queues (mockResolvedValueOnce) are cleared
        vi.resetAllMocks();
        
        // Restore ModelArmor and MembershipService mocks after resetAllMocks
        vi.mocked(ModelArmor.scanInput).mockResolvedValue({ allowed: true });
        vi.mocked(ModelArmor.scanOutput).mockResolvedValue({ allowed: true });
        vi.mocked(MembershipService.checkBudget).mockResolvedValue({ allowed: true, remainingBudget: 100, requiresApproval: false });
        vi.mocked(MembershipService.recordSpend).mockResolvedValue(true as any);
        
        // Restore essential store mocks
        vi.mocked(useStore.getState).mockReturnValue({
            agentHistory: [],
            addAgentMessage: vi.fn(),
            updateAgentMessage: vi.fn(),
            currentOrganizationId: 'org1',
            currentProjectId: 'proj1',
            uploadedImages: [],
            currentModule: 'debug',
            userProfile: { id: 'test-user', uid: 'test-user', email: 'test@example.com' }
        } as any);


        // Restore default mocks that were defined in vi.mock
        vi.mocked(AI.batchEmbedContents).mockResolvedValue([]);
        vi.mocked(AI.generateContent).mockResolvedValue({} as any);
        
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
            response: {
                text: () => tokens.join(''),
                functionCalls: () => [],
                candidates: []
            } as unknown as WrappedResponse['response'],
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
        expect(tokenEvents.map(p => p.content).join('')).toBe('Hello world!');
    });

    it('should handle tool calls after streaming', { timeout: 60000 }, async () => {
        const tokens = ['Analyzing', '...'];

        (agent as any).functions = {
            save_memory: vi.fn().mockResolvedValue({ status: 'success' })
        };

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
                ],
                text: () => 'I will save this.',
                functionCalls: () => [{ name: 'save_memory', args: { content: 'test' } }]
            } as unknown as WrappedResponse['response'],
            text: () => 'I will save this.',
            functionCalls: () => [{ name: 'save_memory', args: { content: 'test' } }],
            usage: () => undefined
        };

        vi.mocked(AI.generateContentStream)
            .mockResolvedValueOnce({
                stream: mockStream,
                response: Promise.resolve(mockResponse)
            })
            .mockResolvedValueOnce({
                stream: new ReadableStream({
                    start(controller) {
                        controller.enqueue({ text: () => 'Done', functionCalls: () => [] });
                        controller.close();
                    }
                }),
                response: Promise.resolve({
                    response: {
                        text: () => 'Done',
                        functionCalls: () => []
                    },
                    text: () => 'Done',
                    functionCalls: () => [],
                    usage: () => undefined
                } as unknown as WrappedResponse)
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
