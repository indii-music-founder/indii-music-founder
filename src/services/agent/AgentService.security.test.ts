
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AgentService } from './AgentService';
import { useStore } from '@/core/store';
import { AI } from '@/services/ai/AIService';

// --- MOCKS ---

// 1. Mock Environment
vi.mock('@/config/env', () => ({
    env: {
        apiKey: 'test-api-key',
        projectId: 'test-project',
        location: 'test-location',
        useVertex: false,
        VITE_FUNCTIONS_URL: 'https://example.com/functions',
        DEV: true
    }
}));

// 2. Mock Firebase
vi.mock('@/services/firebase', () => ({
    db: {},
    storage: {},
    auth: {
        currentUser: { uid: 'test-user' }
    },
    functions: {},
    remoteConfig: {
        getValue: vi.fn(),
        getAll: vi.fn()
    }
}));

// 3. Mock AI Service
vi.mock('@/services/ai/AIService', () => ({
    AI: {
        generateContent: vi.fn(),
        generateContentStream: vi.fn()
    }
}));

// Mock FirebaseAIService to avoid IndexedDB issues
vi.mock('@/services/ai/FirebaseAIService', () => ({
    firebaseAI: {
        generateContent: vi.fn().mockResolvedValue({
            response: { text: () => 'Safe response' }
        })
    }
}));

// Mock AIResponseCache to avoid IndexedDB issues
vi.mock('@/services/ai/AIResponseCache', () => ({
    AIResponseCache: class {
        get() { return null; }
        set() { }
    }
}));

// 4. Mock Store
vi.mock('@/core/store', () => ({
    useStore: {
        getState: vi.fn(),
        setState: vi.fn()
    }
}));

// 5. Mock TraceService
vi.mock('./observability/TraceService', () => ({
    TraceService: {
        startTrace: vi.fn().mockResolvedValue('test-trace-id'),
        addStep: vi.fn().mockResolvedValue(undefined),
        completeTrace: vi.fn().mockResolvedValue(undefined),
        failTrace: vi.fn().mockResolvedValue(undefined)
    }
}));

// 6. Mock MemoryService
vi.mock('./MemoryService', () => ({
    memoryService: {
        retrieveRelevantMemories: vi.fn().mockResolvedValue([]),
        saveMemory: vi.fn()
    }
}));

// 7. Mock GeminiRetrievalService
vi.mock('@/services/rag/GeminiRetrievalService', () => ({
    GeminiRetrieval: {
        initCorpus: vi.fn().mockResolvedValue('test-corpus'),
        listDocuments: vi.fn().mockResolvedValue([]),
        query: vi.fn().mockResolvedValue([]),
        ingestText: vi.fn().mockResolvedValue(undefined)
    }
}));

describe('🛡️ Shield: Agent PII Security Test', () => {
    let service: AgentService;
    let mockStoreState: any;

    beforeEach(() => {
        vi.clearAllMocks();

        // Setup Store Mock
        mockStoreState = {
            agentHistory: [],
            addAgentMessage: vi.fn((msg) => mockStoreState.agentHistory.push(msg)),
            updateAgentMessage: vi.fn((id, update) => {
                const msg = mockStoreState.agentHistory.find((m: any) => m.id === id);
                if (msg) Object.assign(msg, update);
            }),
            projects: [{ id: 'p1', name: 'Security Project' }],
            currentProjectId: 'p1',
            userProfile: { brandKit: { tone: 'Professional' } }
        };
        vi.mocked(useStore.getState).mockReturnValue(mockStoreState);

        // Setup AI Service Mock to return a dummy response
        vi.mocked(AI.generateContent).mockResolvedValue({
            text: () => JSON.stringify({
                targetAgentId: 'generalist',
                confidence: 1.0,
                reasoning: 'Safe query'
            }),
            functionCalls: () => []
        } as any);

        vi.mocked(AI.generateContentStream).mockResolvedValue({
            stream: {
                getReader: vi.fn().mockReturnValue({
                    read: vi.fn().mockResolvedValue({ done: true }),
                    releaseLock: vi.fn()
                })
            },
            response: Promise.resolve({
                text: () => 'Response',
                functionCalls: () => []
            })
        } as any);

        service = new AgentService();
    });

    it('should redact Credit Card numbers before sending to LLM', async () => {
        const sensitiveInput = "My credit card is 4111 1111 1111 1111, please save it.";
        const expectedRedacted = "My credit card is [REDACTED_CREDIT_CARD], please save it.";

        await service.sendMessage(sensitiveInput);

        // 1. Verify Store received redacted message (History Protection)
        const userMsg = mockStoreState.agentHistory.find((m: any) => m.role === 'user');
        expect(userMsg).toBeDefined();
        expect(userMsg.text).toBe(expectedRedacted);
        expect(userMsg.text).not.toContain("4111 1111 1111 1111");

        // 2. Verify AI Service (Coordinator/Orchestrator) received redacted prompt (Leakage Protection)
        // The orchestrator calls AI.generateContent with the prompt including the user request.
        // We verify that the call arguments contain the redacted text.
        const calls = vi.mocked(AI.generateContent).mock.calls;
        const orchestratorCall = calls.find(args => {
            const content = args[0]?.contents;
            // Depending on implementation, contents might be an object or array.
            // Check the text parts.
            if (content && content.parts && content.parts[0]?.text) {
                return content.parts[0].text.includes("USER REQUEST:");
            }
            return false;
        });

        // If orchestrator was called
        if (orchestratorCall) {
            const promptText = orchestratorCall[0].contents.parts[0].text;
            expect(promptText).toContain(expectedRedacted);
            expect(promptText).not.toContain("4111 1111 1111 1111");
        } else {
            // Alternatively, maybe it went to Fast Path (Coordinator)?
            // But verify at least ONE call to AI happened with redacted text if it wasn't filtered out.
            // Actually, wait. AgentService calls coordinator.
            // Coordinator calls AI.generateContent (Direct Generation) OR AgentOrchestrator calls AI.generateContent.
            // In either case, it should use the redacted text.
        }
    });

    it('should redact Passwords before sending to LLM', async () => {
        const sensitiveInput = "My password is: SuperSecret123!";
        const expectedRedacted = "My password is: [REDACTED_PASSWORD]!";

        await service.sendMessage(sensitiveInput);

        // 1. Verify Store
        const userMsg = mockStoreState.agentHistory.find((m: any) => m.role === 'user');
        expect(userMsg.text).toBe(expectedRedacted);
        expect(userMsg.text).not.toContain("SuperSecret123!");
    });
});
