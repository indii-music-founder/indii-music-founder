
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AgentService } from './AgentService';
import { agentRegistry } from './registry';
import { useStore } from '@/core/store';
import { GenAI as AI } from '@/services/ai/GenAI';

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

// Mock VideoTools to prevent real execution if not mocked at service level
vi.mock('@/services/agent/tools/VideoTools', () => ({
    VideoTools: {
        generate_video: vi.fn().mockResolvedValue({ success: true, data: { id: 'mock-video' } }),
        generate_motion_brush: vi.fn().mockResolvedValue({ success: true, data: { url: 'mock-url' } }),
        batch_edit_videos: vi.fn().mockResolvedValue({ success: true }),
        extend_video: vi.fn().mockResolvedValue({ success: true }),
        generate_video_chain: vi.fn().mockResolvedValue({ success: true }),
        interpolate_sequence: vi.fn().mockResolvedValue({ success: true }),
        update_keyframe: vi.fn().mockResolvedValue({ success: true })
    }
}));

// Mock AudioIntelligence (required for MarketingAgent)
vi.mock('@/services/audio/AudioIntelligenceService', () => ({
    audioIntelligence: {
        analyze: vi.fn().mockResolvedValue({ semantic: { mood: [], genre: [], marketingHooks: {} }, technical: {} }),
        init: vi.fn().mockResolvedValue(true)
    }
}));

// Mock MembershipService (required for BaseAgent budget checks)
vi.mock('@/services/MembershipService', () => ({
    MembershipService: {
        checkBudget: vi.fn().mockResolvedValue({ allowed: true, remainingBudget: 100 }),
        recordSpend: vi.fn().mockResolvedValue(undefined)
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
    getFirebaseAI: vi.fn().mockReturnValue({}),
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
        saveMemory: vi.fn().mockResolvedValue(undefined)
    }
}));

// Mock AI Service
vi.mock('@/services/ai/GenAI', () => ({
    GenAI: {
        generateContent: vi.fn().mockResolvedValue({
            response: {
                text: () => '',
                functionCalls: () => []
            }
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

// Mock MembershipService
vi.mock('@/services/MembershipService', () => ({
    MembershipService: {
        checkBudget: vi.fn().mockResolvedValue({ allowed: true }),
        recordSpend: vi.fn().mockResolvedValue(true),
        getCurrentUserId: vi.fn().mockResolvedValue('test-user'),
        getCurrentTier: vi.fn().mockResolvedValue('free')
    }
}));

// Mock VideoGenerationService to prevent accidental API calls
vi.mock('@/services/video/VideoGenerationService', () => ({
    VideoGeneration: {
        generateVideo: vi.fn().mockResolvedValue([{ id: 'mock-video-job', url: '', prompt: 'mock prompt' }]),
        generateLongFormVideo: vi.fn().mockResolvedValue([{ id: 'mock-long-video-job', url: '', prompt: 'mock prompt' }]),
        waitForJob: vi.fn().mockResolvedValue({ status: 'completed', url: 'http://mock-url' }),
        subscribeToJob: vi.fn(() => () => { })
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
            sessions: { 's1': { id: 's1', participants: ['generalist'] } },
            activeSessionId: 's1',
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
            // Force specialist execution (BaseAgent uses AI.generateContent)
            mockStoreState.sessions['s1'].participants = ['marketing'];

            // 1. Mock Specialist Execution (WorkflowCoordinator bypasses LLM routing for 'Analyze...')
            vi.mocked(AI.generateContent).mockResolvedValueOnce({
                response: {
                    text: () => 'I have analyzed the market data.',
                    candidates: [{
                        content: {
                            parts: [{ text: 'I have analyzed the market data.' }]
                        }
                    }],
                    usageMetadata: { totalTokenCount: 100 }
                }
            } as any);

            await service.sendMessage('Analyze market trends');

            // Verify Specialist was called (only once, no orchestrator call)
            expect(AI.generateContent).toHaveBeenCalledTimes(1);

            // Verify message history updated
            const lastMsg = mockStoreState.agentHistory[mockStoreState.agentHistory.length - 1];
            expect(lastMsg.role).toBe('model');
            expect(lastMsg.text).toBe('I have analyzed the market data.');
        });

        it('should handle tool execution cycles (Thinking -> Tool -> Response)', async () => {
            // Use GeneralistAgent (default, streaming)

            // 1. Stream Iteration 1: Tool Call (save_memory)
            const stream1 = {
                stream: {
                    getReader: () => ({
                        read: async () => ({ done: true, value: undefined }),
                        releaseLock: () => { }
                    }),
                    [Symbol.asyncIterator]: async function* () {
                        yield {
                            text: () => 'Saving to memory...',
                            functionCalls: () => [{ name: 'save_memory', args: { data: 'Budget approved' } }],
                            thoughtSignature: 'thought-1'
                        };
                    }
                },
                response: Promise.resolve({
                    text: () => 'Saving to memory...',
                    functionCalls: () => [{ name: 'save_memory', args: { data: 'Budget approved' } }],
                    usage: () => ({ totalTokenCount: 100 })
                })
            };

            // 2. Stream Iteration 2: Final Response
            const stream2 = {
                stream: {
                    getReader: () => ({
                        read: async () => ({ done: true, value: undefined }),
                        releaseLock: () => { }
                    }),
                    [Symbol.asyncIterator]: async function* () {
                        yield {
                            text: () => 'Memory saved successfully.',
                            functionCalls: () => [],
                            thoughtSignature: 'thought-2'
                        };
                    }
                },
                response: Promise.resolve({
                    text: () => 'Memory saved successfully.',
                    functionCalls: () => [],
                    usage: () => ({ totalTokenCount: 50 })
                })
            };

            vi.mocked(AI.generateContentStream)
                .mockResolvedValueOnce(stream1 as any)
                .mockResolvedValueOnce(stream2 as any);

            await service.sendMessage('Save this budget');

            // Verify final response
            const lastMsg = mockStoreState.agentHistory[mockStoreState.agentHistory.length - 1];
            expect(lastMsg.text).toBe('Memory saved successfully.');
        });
    });

    describe('State & Concurrency', () => {
        it('should prevent concurrent agent executions', async () => {
            vi.mocked(AI.generateContentStream).mockImplementation(async () => {
                await new Promise(resolve => setTimeout(resolve, 50));
                // Return a valid stream structure to avoid errors during execution
                return {
                    stream: {
                        getReader: () => ({
                            read: async () => ({ done: true, value: undefined }),
                            releaseLock: () => { }
                        }),
                        [Symbol.asyncIterator]: async function* () { yield { text: () => 'slow response' }; }
                    } as any,
                    response: Promise.resolve({
                        text: () => 'slow response',
                        functionCalls: () => []
                    }) as any
                };
            });

            const p1 = service.sendMessage('Request 1');
            const p2 = service.sendMessage('Request 2');

            await Promise.all([p1, p2]);

            // Only one should have triggered the coordinator/agent
            expect(AI.generateContentStream).toHaveBeenCalledTimes(1);
        });
    });

    describe('Robustness & Error Handling', () => {
        it('should route to Generalist if Orchestrator hallucinations an invalid ID', async () => {
            // 1. Orchestrator hallucination
            vi.mocked(AI.generateContent).mockResolvedValueOnce({
                response: {
                    text: () => JSON.stringify({
                        thought: 'Hallucination',
                        callAgentId: 'super-mega-agent-9000',
                        task: 'Do something crazy',
                        complete: true
                    })
                }
            } as any);

            // 2. Generalist Fallback
            vi.mocked(AI.generateContent).mockResolvedValueOnce({
                response: {
                    text: () => 'I am generalist.'
                }
            } as any);

            const generalistSpy = vi.spyOn(agentRegistry, 'getAsync');

            await service.sendMessage('Do something crazy');

            expect(generalistSpy).toHaveBeenCalledWith('generalist');
            generalistSpy.mockRestore();
        });

        it('should gracefully handle agent execution failure', async () => {
            // 1. Error simulation - Use PERMISSION_DENIED to trigger fatal exit in GeneralistAgent
            const error = new Error('PERMISSION_DENIED: Simulated Verification Failure');

            // Mock rejection for both methods
            vi.mocked(AI.generateContent).mockRejectedValue(error);
            vi.mocked(AI.generateContentStream).mockRejectedValue(error);

            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { });

            await service.sendMessage('Verify this');

            const lastMsg = mockStoreState.agentHistory[mockStoreState.agentHistory.length - 1];
            expect(lastMsg.role).toBe('model');

            // GeneralistAgent catches errors and returns "Fatal Error: ..."
            expect(lastMsg.text).toMatch(/(Error|PERMISSION_DENIED)/);

            consoleSpy.mockRestore();
        });

    });
});
