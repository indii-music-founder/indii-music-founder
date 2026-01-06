
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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

// Mock Firebase to avoid environment-dependent initialization during unit tests
vi.mock('@/services/firebase', () => ({
    db: {},
    storage: {},
    auth: {},
    functions: {},
    remoteConfig: {
        settings: {},
        defaultConfig: {},
        getValue: vi.fn(),
        getAll: vi.fn()
    }
}));

// Mock MemoryService to bypass Firestore and embedding calls
vi.mock('./MemoryService', () => ({
    memoryService: {
        retrieveRelevantMemories: vi.fn().mockResolvedValue([]),
        saveMemory: vi.fn()
    }
}));

// Mock AI Service to control responses and simulate tool usage
vi.mock('@/services/ai/AIService', () => ({
    AI: {
        generateContent: vi.fn().mockResolvedValue({
            text: () => '',
            functionCalls: () => []
        }),
        generateContentStream: vi.fn()
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
        (useStore.getState as any).mockReturnValue(mockStoreState);

        // Provide a default streaming response for the Generalist agent
        (AI.generateContentStream as any).mockImplementation(() => {
            const stream = {
                getReader: vi.fn().mockReturnValue({
                    read: vi.fn()
                        .mockResolvedValueOnce({ done: false, value: { text: () => '{"final_response":"Generalist fallback response"}' } })
                        .mockResolvedValueOnce({ done: true, value: undefined }),
                    releaseLock: vi.fn()
                })
            };

            return Promise.resolve({
                stream,
                response: Promise.resolve({
                    text: () => '{"final_response":"Generalist fallback response"}',
                    functionCalls: () => []
                })
            });
        });

        service = new AgentService();
    });

    describe('End-to-End Execution Pipeline', () => {
        it('should correctly orchestrate, execute, and return response for a specialist', async () => {
            // 1. Mock Orchestrator Decision
            (AI.generateContent as any).mockResolvedValueOnce({
                text: () => 'marketing'
            });

            // 2. Mock Specialist Execution (Thinking + Final Answer)
            (AI.generateContent as any).mockResolvedValueOnce({
                text: () => 'I have analyzed the market data.',
                functionCalls: () => []
            });

            await service.sendMessage('Analyze market trends');

            // Verify Orchestrator was called
            expect(AI.generateContent).toHaveBeenNthCalledWith(1, expect.objectContaining({
                contents: expect.objectContaining({ role: 'user' })
            }));

            // Verify Specialist was called with correct context stuffed into user prompt
            // BaseAgent injects system prompt into the user message content
            const secondCallArgs = (AI.generateContent as any).mock.calls[1][0];
            const promptText = secondCallArgs.contents[0].parts[0].text;
            expect(promptText).toContain('Campaign Manager');

            // Verify message history updated
            const lastMsg = mockStoreState.agentHistory[mockStoreState.agentHistory.length - 1];
            expect(lastMsg.role).toBe('model');
            expect(lastMsg.text).toBe('I have analyzed the market data.');
        });

        it('should handle tool execution cycles (Thinking -> Tool -> Response)', async () => {
            vi.clearAllMocks();

            // 1. Router Call
            (AI.generateContent as any).mockResolvedValueOnce({ text: () => 'finance' });

            // 2. BaseAgent Execution
            // Agent returns a tool call. BaseAgent executes it and returns the result immediately (One-Shot).
            (AI.generateContent as any).mockResolvedValueOnce({
                text: () => 'Thinking...',
                functionCalls: () => [{ name: 'analyze_budget', args: { amount: 1000, breakdown: 'Test' } }]
            });

            await service.sendMessage('Check this budget');

            // Verification:
            // 1. Router 
            // 2. Agent (Tool Call) -> BaseAgent executes tool -> Returns result
            // Total 2 calls to generateContent.
            expect(AI.generateContent).toHaveBeenCalledTimes(2);

            // Verify final response contains tool output
            const lastMsg = mockStoreState.agentHistory[mockStoreState.agentHistory.length - 1];
            expect(lastMsg.text).toContain('Tool: analyze_budget');
            expect(lastMsg.text).toContain('approved');
        });
    });

    describe('State & Concurrency (Stress Test)', () => {
        it('should prevent concurrent agent executions (Lock Mechanism)', async () => {
            // Mock a slow operation
            (AI.generateContent as any).mockImplementation(async () => {
                await new Promise(resolve => setTimeout(resolve, 50));
                return { text: () => 'slow response' };
            });

            // Fire two requests almost simultaneously
            const p1 = service.sendMessage('Request 1');
            const p2 = service.sendMessage('Request 2');

            await Promise.all([p1, p2]);

            // Only one should have triggered the AI
            // Logic: isProcessing check prevents 2nd call from proceeding past line 22
            expect(AI.generateContent).toHaveBeenCalledTimes(1);
        });

        it('should accumulate context correctly across multiple turns', async () => {
            // Seed store with history
            const { addAgentMessage } = useStore.getState();
            addAgentMessage({ id: '1', role: 'user', text: 'Prev User', timestamp: 100 });
            addAgentMessage({ id: '2', role: 'model', text: 'Prev Model', timestamp: 200 });

            (AI.generateContent as any).mockResolvedValueOnce({ text: () => 'marketing' }); // Router
            (AI.generateContent as any).mockResolvedValueOnce({ text: () => 'Response', functionCalls: () => [] }); // Agent

            await service.sendMessage('New Message');

            // Verify Context passed to Agent includes history
            const agentCall = (AI.generateContent as any).mock.calls[1][0];
            const historyString = agentCall.contents[0].parts[0].text;

            // We need to verify that ContextPipeline built the string correctly
            // The mock store has the messages, ContextPipeline reads them.
            expect(historyString).toContain('User: Prev User');
            expect(historyString).toContain('Assistant: Prev Model');
        });
    });

    describe('Edge Cases & Recovery', () => {
        it('should handle hallucinated tool calls gracefully', async () => {
            (AI.generateContent as any).mockResolvedValueOnce({ text: () => 'finance' });

            // Agent tries to call a non-existent tool
            (AI.generateContent as any).mockResolvedValueOnce({
                text: () => 'Thinking...',
                functionCalls: () => [{ name: 'make_money_fast', args: {} }]
            });

            await service.sendMessage('Get rich');

            const lastMsg = mockStoreState.agentHistory[mockStoreState.agentHistory.length - 1];
            expect(lastMsg.text).toContain("Error: Tool 'make_money_fast' not implemented");
        });
    });

    describe('Robustness & Error Handling', () => {
        it('should route to Generalist if Orchestrator hallucinations an invalid ID', async () => {
            (AI.generateContent as any).mockResolvedValue({
                text: () => 'super-mega-agent-9000'
            });

            const generalistSpy = vi.spyOn(agentRegistry, 'get');

            await service.sendMessage('Do something crazy');

            expect(generalistSpy).toHaveBeenCalledWith('generalist');
        });

        it('should gracefully handle agent execution failure', async () => {
            (AI.generateContent as any).mockResolvedValueOnce({ text: () => 'brand' });

            // Make brand agent crash inside BaseAgent logic
            (AI.generateContent as any).mockRejectedValueOnce(new Error('Simulated API Outage'));

            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { });

            await service.sendMessage('Verify this');

            // AgentService should receive the error text from BaseAgent's catch block
            const lastMsg = mockStoreState.agentHistory[mockStoreState.agentHistory.length - 1];
            expect(lastMsg.role).toBe('model'); // Not system, because BaseAgent handled it
            expect(lastMsg.text).toContain('Error executing task');
            expect(lastMsg.text).toContain('Simulated API Outage');

            consoleSpy.mockRestore();
        });
    });
});
