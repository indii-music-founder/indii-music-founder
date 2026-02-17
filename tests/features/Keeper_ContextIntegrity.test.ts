import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BaseAgent } from '@/services/agent/BaseAgent';
import { AgentConfig } from '@/services/agent/types';
import { AppException } from '@/shared/types/errors';

// ----------------------------------------------------------------------------
// MOCKS
// ----------------------------------------------------------------------------

// Mock the AI Service to capture prompts and simulate responses
// Mock the AI Service to capture prompts and simulate responses
const { mockGenerateContentStream, mockGenerateContent, mockCheckQuota, mockTrackUsage } = vi.hoisted(() => ({
    mockGenerateContentStream: vi.fn(),
    mockGenerateContent: vi.fn(),
    mockCheckQuota: vi.fn(),
    mockTrackUsage: vi.fn(),
}));

vi.mock('@/services/ai/AIService', () => ({
    AI: {
        generateContentStream: (...args: any[]) => mockGenerateContentStream(...args),
        generateContent: (...args: any[]) => mockGenerateContent(...args),
        generateSpeech: vi.fn(),
    }
}));

// Mock TokenUsageService to verify quota checks
vi.mock('@/services/ai/billing/TokenUsageService', () => ({
    TokenUsageService: {
        checkQuota: (...args: any[]) => mockCheckQuota(...args),
        trackUsage: (...args: any[]) => mockTrackUsage(...args),
        checkRateLimit: vi.fn().mockResolvedValue(true),
    }
}));

// Mock env config to provide fake API key for fallback mode
vi.mock('@/config/env', () => ({
    env: {
        apiKey: 'test-api-key-for-keeper',
        VITE_API_KEY: 'test-api-key-for-keeper',
        DEV: true
    },
    firebaseConfig: {
        apiKey: 'test-firebase-key',
        authDomain: 'test.firebaseapp.com',
        projectId: 'test-project',
        storageBucket: 'test.appspot.com',
        messagingSenderId: '123',
        appId: '1:123:web:abc'
    }
}));

// MOCK FIREBASE COMPLETELY
vi.mock('@/services/firebase', () => ({
    auth: { currentUser: { uid: 'test-user' } },
    functions: {},
    ai: { type: 'mock-ai-instance' },
    remoteConfig: {},
    db: {},
    getFirebaseAI: vi.fn().mockReturnValue({ type: 'mock-ai-instance' })
}));

// We also need to mock 'firebase/ai' entirely since we are testing FirebaseAIService
// which imports from 'firebase/ai'.
const mockGetGenerativeModel = vi.fn().mockReturnValue({
    generateContent: (...args: any[]) => mockGenerateContent(...args).then((res: any) => res || { response: { text: () => 'Mock response', functionCalls: () => [], usageMetadata: {} } }),
    generateContentStream: (...args: any[]) => mockGenerateContentStream(...args) || { stream: (async function* () { yield { text: () => 'Mock' }; })(), response: Promise.resolve({}) }
});

vi.mock('firebase/ai', () => ({
    getGenerativeModel: (...args: any[]) => mockGetGenerativeModel(...args),
    getLiveGenerativeModel: vi.fn(),
}));

// Mock other firebase modules
vi.mock('firebase/functions', () => ({
    httpsCallable: vi.fn()
}));
vi.mock('firebase/remote-config', () => ({
    fetchAndActivate: vi.fn().mockResolvedValue(true),
    getValue: vi.fn().mockReturnValue({ asString: () => 'mock-model' })
}));

vi.mock('@/services/MembershipService', () => ({
    MembershipService: {
        checkBudget: vi.fn().mockResolvedValue({ allowed: true, remainingBudget: 100, requiresApproval: false }),
        checkQuota: vi.fn().mockResolvedValue({ allowed: true, currentUsage: 0, maxAllowed: 100 }),
        incrementUsage: vi.fn().mockResolvedValue(undefined),
    }
}));

vi.mock('@/services/ai/context/ContextManager', () => ({
    ContextManager: {
        truncateContext: vi.fn().mockImplementation((history) => history),
    }
}));

vi.mock('@/services/agent/context/AgentExecutionContext', () => ({
    ExecutionContextFactory: {
        fromAgentContext: vi.fn().mockResolvedValue({
            rollback: vi.fn(),
            commit: vi.fn(),
            hasUncommittedChanges: vi.fn().mockReturnValue(false),
            getChangeSummary: vi.fn().mockReturnValue('No changes'),
        })
    }
}));

vi.mock('@/services/agent/ToolExecutionContext', () => ({
    ToolExecutionContext: class {
        constructor() { }
    }
}));

// Mock Google Gen AI SDK
vi.mock('@google/genai', () => ({
    GoogleGenAI: class {
        models = {
            generateContent: (...args: any[]) => {
                console.log('MOCK: GoogleGenAI.generateContent called');
                return Promise.resolve(mockGenerateContent(...args)).then((res: any) => res || {
                    candidates: [{ content: { parts: [{ text: 'Mock response' }], role: 'model' } }],
                    usageMetadata: { totalTokenCount: 10 },
                    text: 'Mock response'
                });
            },
            generateContentStream: (...args: any[]) => {
                console.log('MOCK: GoogleGenAI.generateContentStream called');
                return Promise.resolve(mockGenerateContent(...args)).then((res: any) => {
                    if (res && res.response) {
                        return {
                            candidates: res.response.candidates || [],
                            usageMetadata: res.response.usageMetadata,
                            text: typeof res.response.text === 'function' ? res.response.text() : res.response.text,
                            functionCalls: typeof res.response.functionCalls === 'function' ? res.response.functionCalls() : res.response.functionCalls
                        };
                    }
                    return res || {
                        candidates: [{ content: { parts: [{ text: 'Mock response' }], role: 'model' } }],
                        usageMetadata: { totalTokenCount: 10 },
                        text: 'Mock response'
                    };
                });
            },
            generateContentStream: (...args: any[]) => {
                return mockGenerateContentStream(...args) || {
                    stream: (async function* () { yield { text: () => 'Mock stream token' }; })(),
                    response: Promise.resolve({})
                };
            }
        };

        constructor() { }

        constructor() { }
        getGenerativeModel() {
            return {
                generateContent: this.models.generateContent,
                generateContentStream: this.models.generateContentStream
            };
        }
    }
}));

// Import FirebaseAIService directly to test logic.
import { FirebaseAIService } from '@/services/ai/FirebaseAIService';

// ----------------------------------------------------------------------------
// TESTS
// ----------------------------------------------------------------------------

describe('📚 Keeper: Context Integrity', () => {

    describe('🐘 The Elephant Test (Context Truncation)', () => {
        let agent: BaseAgent;

        beforeEach(() => {
            vi.clearAllMocks();

            // Setup a basic agent
            const config: AgentConfig = {
                id: 'keeper-test-agent' as any,
                name: 'Keeper Test Agent',
                description: 'A test agent for memory verification',
                color: '#000000',
                category: 'specialist',
                systemPrompt: 'You are a test agent.',
                tools: []
            };
            agent = new BaseAgent(config);

            // Default mock response
            mockGenerateContent.mockResolvedValue({
                response: {
                    text: () => 'Response',
                    usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 10, totalTokenCount: 20 },
                    functionCalls: () => []
                }
            });

            mockGenerateContentStream.mockResolvedValue({
                stream: new ReadableStream({
                    start(controller) {
                        controller.close();
                    }
                }),
                response: Promise.resolve({
                    text: () => 'Response',
                    usage: () => ({ promptTokenCount: 10, candidatesTokenCount: 10, totalTokenCount: 20 }),
                    functionCalls: () => []
                })
            });
        });

        it('should truncate massive chat history to prevent context overflow', async () => {
            // 1. Create a massive history string (e.g., 50k chars)
            // MAX_HISTORY_CHARS is 32000 in BaseAgent.ts
            const massiveHistory = 'A'.repeat(50000);

            // 2. Execute agent with this history
            await agent.execute('Test Task', {
                chatHistoryString: massiveHistory,
                projectId: 'test-project',
                orgId: 'test-org'
            });

            // 3. Inspect the call to AI.generateContent
            expect(mockGenerateContent).toHaveBeenCalledTimes(1);
            const callArgs = mockGenerateContent.mock.calls[0][0];
            const promptParts = callArgs.contents[0].parts;
            const textPart = promptParts.find((p: any) => p.text && p.text.includes('# HISTORY'));

            expect(textPart).toBeDefined();
            const fullPrompt = textPart.text;

            // 4. Verify Truncation
            // Should contain the marker
            expect(fullPrompt).toContain('[...Older history truncated...]');

            // Should NOT contain the full 50k 'A's
            // It should contain roughly 32k 'A's plus the marker
            // Let's count the 'A's in the history section
            const historySectionMatch = fullPrompt.match(/# HISTORY\n(.*?)(\n#|$)/s);
            const historyContent = historySectionMatch ? historySectionMatch[1] : '';

            expect(historyContent.length).toBeLessThan(50000);
            expect(historyContent.length).toBeGreaterThan(30000); // Should be around 32k
        });

        it('should NOT truncate small chat history', async () => {
            const smallHistory = 'A'.repeat(1000);

            await agent.execute('Test Task', {
                chatHistoryString: smallHistory,
                projectId: 'test-project',
                orgId: 'test-org'
            });

            const callArgs = mockGenerateContent.mock.calls[0][0];
            const fullPrompt = callArgs.contents[0].parts[0].text;

            expect(fullPrompt).not.toContain('[...Older history truncated...]');
            expect(fullPrompt).toContain(smallHistory);
        });
    });

    describe('💰 Token Budget (Quota Check)', () => {
        let aiService: FirebaseAIService;
        let modelGenerateContent: any;

        beforeEach(async () => {
            vi.clearAllMocks();

            modelGenerateContent = vi.fn().mockResolvedValue({
            mockGenerateContent.mockResolvedValue({
                response: {
                    text: () => 'Response',
                    usageMetadata: { promptTokenCount: 5, candidatesTokenCount: 5 }
                }
            });

            // Mock getGenerativeModel return
            mockGetGenerativeModel.mockReturnValue({
                model: 'gemini-test',
                generateContent: modelGenerateContent
            });

            aiService = new FirebaseAIService();

            // FIX: The issue in previous run was "Cannot read properties of null (reading 'model')"
            // This is because rawGenerateContent accesses `this.model!.model`.
            // Even though we spyOn bootstrap, we must manually set `this.model` to satisfy Typescript/Runtime.
            // Since `model` is private, we use Object.defineProperty or rely on the mocked bootstrap side effect (which we skipped).
            // But we can't easily set private property without casting or defineProperty.

            // Instead of bypassing bootstrap, let's allow it to run but mock the internals it calls.
            // bootstrap calls `fetchAndActivate` (mocked) and `getGenerativeModel` (mocked).
            // So calling bootstrap() should work and set this.model.

            await aiService.bootstrap();
        });

        it('should block request if TokenUsageService throws QuotaExceeded', async () => {
            // Setup: Mock Quota Exceeded
            mockCheckQuota.mockRejectedValue(new Error('AI Quota Exceeded'));

            // Action & Assert
            await expect(aiService.chat([], 'Hello'))
                .rejects
                .toThrow('AI Quota Exceeded');

            expect(mockCheckQuota).toHaveBeenCalledWith('test-user');

            // Ensure AI was NOT called
            expect(modelGenerateContent).not.toHaveBeenCalled();
        });

        it('should allow request if TokenUsageService passes', async () => {
            // Setup: Quota OK
            mockCheckQuota.mockResolvedValue(true);

            // Action
            await aiService.chat([], 'Hello');

            // Assert
            expect(mockCheckQuota).toHaveBeenCalledWith('test-user');

            // AI should be called
            expect(mockGenerateContent).toHaveBeenCalled();

            // Track usage should be called
            expect(mockTrackUsage).toHaveBeenCalled();
        });
    });
});
