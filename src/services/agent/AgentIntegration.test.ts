
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AgentService } from './AgentService';
import { agentRegistry } from './registry';
import { useStore } from '@/core/store';
import { AI } from '@/services/ai/AIService';

// Provide safe environment defaults to avoid failing validation during tests
vi.mock('@/config/env', () => ({
    env: {
        apiKey: 'test-api-key',
        projectId: 'test-project',
        location: 'test-location',
        useVertex: false,
        googleMapsApiKey: 'maps-key',
        VITE_FUNCTIONS_URL: 'https://example.com/functions',
        VITE_RAG_PROXY_URL: 'https://example.com/rag',
        VITE_GOOGLE_MAPS_API_KEY: 'maps-key',
        DEV: true,
        skipOnboarding: true
    }
}));

// Mock Gemini Retrieval to suppress API key warnings and network calls
vi.mock('@/services/rag/GeminiRetrievalService', () => ({
    GeminiRetrieval: {
        initCorpus: vi.fn().mockResolvedValue('test-corpus'),
        listDocuments: vi.fn().mockResolvedValue([]),
        query: vi.fn().mockResolvedValue([]),
        ingestText: vi.fn().mockResolvedValue(undefined),
        createDocument: vi.fn().mockResolvedValue({ name: 'doc' })
    }
}));

// Mock Firebase
vi.mock('@/services/firebase', () => ({
    db: {},
    storage: {},
    auth: {
        currentUser: { uid: 'test-user' }
    },
    functions: {},
    remoteConfig: {
        settings: {},
        defaultConfig: {},
        getValue: vi.fn(),
        getAll: vi.fn()
    }
}));

// Mock MemoryService
vi.mock('./MemoryService', () => ({
    memoryService: {
        retrieveRelevantMemories: vi.fn().mockResolvedValue([]),
        saveMemory: vi.fn()
    }
}));

// Mock AI Service
vi.mock('@/services/ai/AIService', () => ({
    AI: {
        generateContent: vi.fn().mockResolvedValue({
            text: () => '',
            functionCalls: () => []
        }),
        generateContentStream: vi.fn(),
        generateSpeech: vi.fn()
    }
}));

// Mock TraceService to avoid noisy errors and Firestore dependency
vi.mock('./observability/TraceService', () => ({
    TraceService: {
        startTrace: vi.fn().mockResolvedValue('test-trace-id'),
        addStep: vi.fn().mockResolvedValue(undefined),
        completeTrace: vi.fn().mockResolvedValue(undefined),
        failTrace: vi.fn().mockResolvedValue(undefined)
    }
}));

// Mock Store
vi.mock('@/core/store', () => ({
    useStore: {
        getState: vi.fn(),
        setState: vi.fn()
    }
}));

describe('Agent Architecture Integration (Hardened)', () => {
    let service: AgentService;
    let mockStoreState: any;

    beforeEach(() => {
        vi.clearAllMocks();

        // Setup complex store state
        mockStoreState = {
            agentHistory: [],
            projects: [{ id: 'p1', name: 'Integration Project', type: 'creative' }],
            currentProjectId: 'p1',
            userProfile: { brandKit: { tone: 'Professional' } },
            addAgentMessage: vi.fn((msg) => mockStoreState.agentHistory.push(msg)),
            updateAgentMessage: vi.fn((id, update) => {
                const msg = mockStoreState.agentHistory.find((m: any) => m.id === id);
                if (msg) Object.assign(msg, update);
            })
        };
        vi.mocked(useStore.getState).mockReturnValue(mockStoreState);

        // Provide a default streaming response for the Generalist agent
        vi.mocked(AI.generateContentStream).mockImplementation(() => {
            const stream = {
                getReader: vi.fn().mockReturnValue({
                    read: vi.fn()
                        .mockResolvedValueOnce({ done: false, value: { text: () => '{"final_response":"Generalist fallback response"}' } })
                        .mockResolvedValueOnce({ done: true, value: undefined }),
                    releaseLock: vi.fn()
                })
            };

            return Promise.resolve({
                stream: stream as any,
                response: Promise.resolve({
                    text: () => '{"final_response":"Generalist fallback response"}',
                    functionCalls: () => []
                }) as any
            });
        });

        service = new AgentService();
    });

    describe('End-to-End Execution Pipeline', () => {
        it('should correctly orchestrate, execute, and return response for a specialist', async () => {
            // 1. Mock Orchestrator Decision (JSON)
            vi.mocked(AI.generateContent).mockResolvedValueOnce({
                text: () => JSON.stringify({
                    targetAgentId: 'marketing',
                    confidence: 1.0,
                    reasoning: 'Marketing task detected'
                })
            } as any);

            // 2. Mock Specialist Execution
            vi.mocked(AI.generateContentStream).mockImplementationOnce(() => {
                const stream = {
                    getReader: vi.fn().mockReturnValue({
                        read: vi.fn()
                            .mockResolvedValueOnce({ done: false, value: { text: () => 'I have analyzed the market data.' } })
                            .mockResolvedValueOnce({ done: true, value: undefined }),
                        releaseLock: vi.fn()
                    })
                };

                return Promise.resolve({
                    stream: stream as any,
                    response: Promise.resolve({
                        text: () => 'I have analyzed the market data.',
                        functionCalls: () => []
                    }) as any
                });
            });

            await service.sendMessage('Analyze market trends');

            // Verify Orchestrator was called
            expect(AI.generateContent).toHaveBeenCalled();

            // Verify message history updated
            const lastMsg = mockStoreState.agentHistory[mockStoreState.agentHistory.length - 1];
            expect(lastMsg.role).toBe('model');
            expect(lastMsg.text).toBe('I have analyzed the market data.');
        });

        it('should handle tool execution cycles (Thinking -> Tool -> Response)', async () => {
            // 1. Router Call (JSON)
            vi.mocked(AI.generateContent).mockResolvedValueOnce({
                text: () => JSON.stringify({
                    targetAgentId: 'finance',
                    confidence: 1.0,
                    reasoning: 'Finance task'
                })
            } as any);

            // 2. BaseAgent Execution (Tool Call)
            vi.mocked(AI.generateContentStream).mockImplementationOnce(() => {
                const stream = {
                    getReader: vi.fn().mockReturnValue({
                        read: vi.fn().mockResolvedValue({ done: true }),
                        releaseLock: vi.fn()
                    })
                };

                return Promise.resolve({
                    stream: stream as any,
                    response: Promise.resolve({
                        text: () => 'Thinking...',
                        functionCalls: () => [{ name: 'analyze_budget', args: { amount: 1000, breakdown: 'Test' } }]
                    }) as any
                });
            });

            await service.sendMessage('Check this budget');

            // Verify final response contains tool output
            const lastMsg = mockStoreState.agentHistory[mockStoreState.agentHistory.length - 1];
            expect(lastMsg.text).toContain('Tool: analyze_budget');
        });
    });

    describe('State & Concurrency', () => {
        it('should prevent concurrent agent executions', async () => {
            vi.mocked(AI.generateContent).mockImplementation(async () => {
                await new Promise(resolve => setTimeout(resolve, 50));
                return { text: () => 'slow response' } as any;
            });

            const p1 = service.sendMessage('Request 1');
            const p2 = service.sendMessage('Request 2');

            await Promise.all([p1, p2]);

            // Only one should have triggered the coordinator
            expect(AI.generateContent).toHaveBeenCalledTimes(1);
        });
    });

    describe('Robustness & Error Handling', () => {
        it('should route to Generalist if Orchestrator hallucinations an invalid ID', async () => {
            vi.mocked(AI.generateContent).mockResolvedValue({
                text: () => JSON.stringify({
                    targetAgentId: 'super-mega-agent-9000',
                    confidence: 1.0,
                    reasoning: 'Hallucination'
                })
            } as any);

            const generalistSpy = vi.spyOn(agentRegistry, 'getAsync');

            await service.sendMessage('Do something crazy');

            expect(generalistSpy).toHaveBeenCalledWith('generalist');
            generalistSpy.mockRestore();
        });

        it('should gracefully handle agent execution failure', async () => {
            // 1. Orchestrator routes to brand
            vi.mocked(AI.generateContent).mockResolvedValueOnce({
                text: () => JSON.stringify({
                    targetAgentId: 'brand',
                    confidence: 1.0,
                    reasoning: 'Brand task'
                })
            } as any);

            // 2. Execution fails
            vi.mocked(AI.generateContentStream).mockRejectedValueOnce(new Error('Simulated API Outage'));

            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { });

            await service.sendMessage('Verify this');

            const lastMsg = mockStoreState.agentHistory[mockStoreState.agentHistory.length - 1];
            expect(lastMsg.role).toBe('model');
            expect(lastMsg.text).toContain('Error executing task');
            expect(lastMsg.text).toContain('Simulated API Outage');

            consoleSpy.mockRestore();
        });
    });
});
