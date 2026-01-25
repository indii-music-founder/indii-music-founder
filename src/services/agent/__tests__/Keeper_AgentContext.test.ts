import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { agentService } from '../AgentService';
import { ContextManager } from '@/services/ai/context/ContextManager';
import { useStore } from '@/core/store';
import { BaseAgent } from '../BaseAgent';

// ------------------------------------------------------------------
// Mocks
// ------------------------------------------------------------------

// 0. Mock Firebase Firestore (prevent crash in real services)
vi.mock('firebase/firestore', () => ({
    getFirestore: vi.fn(),
    initializeFirestore: vi.fn(),
    persistentLocalCache: vi.fn(),
    persistentMultipleTabManager: vi.fn(),
    doc: vi.fn(),
    getDoc: vi.fn(),
    setDoc: vi.fn(),
    updateDoc: vi.fn(),
    addDoc: vi.fn(),
    arrayUnion: vi.fn(),
    serverTimestamp: vi.fn(),
    collection: vi.fn(),
    Timestamp: {
        now: () => ({ toMillis: () => Date.now() }),
        fromMillis: (ms: number) => ({ toMillis: () => ms })
    }
}));

// 1. Mock AI Service
const mockGenerateContent = vi.fn().mockResolvedValue({
    text: () => 'Response',
    usage: () => ({ promptTokenCount: 100, candidatesTokenCount: 10, totalTokenCount: 110 }),
    functionCalls: () => [],
    thoughtSignature: 'test-signature'
});

vi.mock('@/services/ai/AIService', () => ({
    AI: {
        generateContent: (...args: any[]) => mockGenerateContent(...args),
        getGenerativeModel: () => ({ generateContent: mockGenerateContent }),
        generateSpeech: vi.fn()
    }
}));

// 2. Mock Membership Service
vi.mock('@/services/MembershipService', () => ({
    MembershipService: {
        checkBudget: vi.fn().mockResolvedValue({ allowed: true }),
        recordSpend: vi.fn().mockResolvedValue(true)
    }
}));

// 3. Mock ContextManager (Context Window Check)
vi.mock('@/services/ai/context/ContextManager', () => ({
    ContextManager: {
        truncateContext: vi.fn().mockReturnValue([{ role: 'user', parts: [{ text: 'TRUNCATED' }] }]),
        estimateTokens: vi.fn().mockReturnValue(10),
        estimateContextTokens: vi.fn().mockReturnValue(100)
    }
}));

// 4. Mock SessionService (Persistence Check)
const mockUpdateSession = vi.fn().mockResolvedValue(true);
const mockCreateSession = vi.fn().mockResolvedValue('session-123');

vi.mock('@/services/agent/SessionService', () => ({
    sessionService: {
        updateSession: mockUpdateSession,
        createSession: mockCreateSession,
        getSessionsForUser: vi.fn().mockResolvedValue([])
    }
}));

// 5. Mock ContextPipeline
vi.mock('../components/ContextPipeline', () => ({
    ContextPipeline: class {
        buildContext = vi.fn().mockResolvedValue({
            chatHistory: Array(10).fill({ role: 'user', text: 'test' }),
            chatHistoryString: 'History',
            userId: 'test-user',
            projectId: 'test-project'
        });
    }
}));

// 6. Mock WorkflowCoordinator
vi.mock('../WorkflowCoordinator', () => ({
    coordinator: {
        handleUserRequest: vi.fn().mockResolvedValue('DELEGATED_TO_AGENT')
    }
}));

// 7. Mock AgentOrchestrator
vi.mock('../components/AgentOrchestrator', () => ({
    AgentOrchestrator: class {
        determineAgent = vi.fn().mockResolvedValue('generalist');
    }
}));

// 8. Mock AgentRegistry to return a real BaseAgent
vi.mock('../registry', () => ({
    agentRegistry: {
        warmup: vi.fn(),
        getAsync: vi.fn().mockImplementation(async (id) => {
            return new BaseAgent({
                id,
                name: 'Test Agent',
                description: 'A test agent',
                systemPrompt: 'You are test.',
                category: 'specialist',
                color: 'blue',
                tools: []
            });
        }),
        get: vi.fn(), // Legacy
    }
}));

// ------------------------------------------------------------------
// Tests
// ------------------------------------------------------------------

describe('📚 Keeper: Context & Persistence Integration', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Setup initial store state
        useStore.setState({
            agentHistory: [],
            sessions: {
                'session-123': {
                    id: 'session-123',
                    title: 'Test Session',
                    createdAt: Date.now(),
                    updatedAt: Date.now(),
                    messages: [],
                    participants: ['indii']
                }
            },
            activeSessionId: 'session-123'
        });
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('should truncate context AND persist history during message flow', async () => {
        // Execute Integration Flow
        await agentService.sendMessage('Hello Keeper');

        // 1. Verify Context Truncation (Context Window)
        // Chain: AgentService -> AgentExecutor -> BaseAgent -> ContextManager.truncateContext
        expect(ContextManager.truncateContext).toHaveBeenCalled();
        const truncateArgs = (ContextManager.truncateContext as any).mock.calls[0];

        // Assert limit is passed correctly (15000)
        expect(truncateArgs[1]).toBe(15000);

        // Assert AI received the truncated context
        // mockGenerateContent was called by BaseAgent
        const aiCall = mockGenerateContent.mock.calls[0][0];
        const sentText = aiCall.contents[0].parts[0].text;
        expect(sentText).toContain('TRUNCATED');

        // 2. Verify Persistence (Local Storage)
        // Chain: AgentService -> Store.updateAgentMessage -> SessionService.updateSession

        // Wait for async state updates and persistence callbacks
        await new Promise(resolve => setTimeout(resolve, 200));

        // Assert Persistence was triggered
        expect(mockUpdateSession).toHaveBeenCalled();

        // Verify the payload contains the new messages
        // There might be multiple calls (streaming), find one with messages
        const calls = mockUpdateSession.mock.calls;
        const hasMessages = calls.some(call => call[1].messages && call[1].messages.length > 0);
        expect(hasMessages).toBe(true);

        // Verify the session ID
        expect(calls[0][0]).toBe('session-123');
    });
});
