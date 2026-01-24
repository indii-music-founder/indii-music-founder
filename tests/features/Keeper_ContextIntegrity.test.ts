import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BaseAgent } from '@/services/agent/BaseAgent';
import { AgentConfig } from '@/services/agent/types';
import { AppErrorCode } from '@/shared/types/errors';

// ----------------------------------------------------------------------------
// MOCKS
// ----------------------------------------------------------------------------

// Mock the AI Service to capture prompts and simulate responses
const mockGenerateContentStream = vi.fn();

vi.mock('@/services/ai/AIService', () => ({
    AI: {
        generateContentStream: (...args: any[]) => mockGenerateContentStream(...args),
        // Add other methods if needed by BaseAgent
        generateSpeech: vi.fn(),
    }
}));

// Mock TokenUsageService to verify quota checks
const mockCheckQuota = vi.fn();
const mockTrackUsage = vi.fn();

vi.mock('@/services/ai/billing/TokenUsageService', () => ({
    TokenUsageService: {
        checkQuota: (...args: any[]) => mockCheckQuota(...args),
        trackUsage: (...args: any[]) => mockTrackUsage(...args),
    }
}));

// MOCK FIREBASE COMPLETELY
vi.mock('@/services/firebase', () => ({
    auth: { currentUser: { uid: 'test-user' } },
    functions: {},
    ai: { type: 'mock-ai-instance' },
    remoteConfig: {},
    db: {}
}));

// We also need to mock 'firebase/ai' entirely since we are testing FirebaseAIService
// which imports from 'firebase/ai'.
const mockGetGenerativeModel = vi.fn();

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

            // 3. Inspect the call to AI.generateContentStream
            expect(mockGenerateContentStream).toHaveBeenCalledTimes(1);
            const callArgs = mockGenerateContentStream.mock.calls[0][0];
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

            const callArgs = mockGenerateContentStream.mock.calls[0][0];
            const fullPrompt = callArgs.contents[0].parts[0].text;

            expect(fullPrompt).not.toContain('[...Older history truncated...]');
            expect(fullPrompt).toContain(smallHistory);
        });
    });

    describe('💰 Token Budget (Quota Check)', () => {
        let aiService: FirebaseAIService;
        let mockGenerateContent: any;

        beforeEach(async () => {
            vi.clearAllMocks();

            mockGenerateContent = vi.fn().mockResolvedValue({
                response: {
                    text: () => 'Response',
                    usageMetadata: { promptTokenCount: 5, candidatesTokenCount: 5 }
                }
            });

            // Mock getGenerativeModel return
            mockGetGenerativeModel.mockReturnValue({
                model: 'gemini-test',
                generateContent: mockGenerateContent
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
            expect(mockGenerateContent).not.toHaveBeenCalled();
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
