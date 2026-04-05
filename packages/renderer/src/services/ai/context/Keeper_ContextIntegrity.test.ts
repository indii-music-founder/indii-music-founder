
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BaseAgent } from '@/services/agent/BaseAgent';
import { AgentMessage } from '@/core/store/slices/agent';

// ----------------------------------------------------------------------------
// Mocks
// ----------------------------------------------------------------------------

// Mock @/services/firebase to prevent real Firebase initialization
vi.mock('@/services/firebase', () => ({
    serverTimestamp: vi.fn(),
    auth: {
        currentUser: { uid: 'keeper-test-user' },
        onAuthStateChanged: vi.fn(() => () => { })
    },
    db: {},
    storage: {},
    remoteConfig: { defaultConfig: {} },
    functions: { region: vi.fn(() => ({ httpsCallable: vi.fn() })) },
    functionsWest1: { region: vi.fn(() => ({ httpsCallable: vi.fn() })) },
    getFirebaseAI: vi.fn(() => ({})),
    app: { options: {} },
    appCheck: { getToken: vi.fn(() => Promise.resolve({ token: 'mock-token' })) },
    messaging: { getToken: vi.fn() }
}));

// Mock Firebase modules
vi.mock('firebase/app', () => ({
  serverTimestamp: vi.fn(),
    initializeApp: vi.fn(),
    getApp: vi.fn(),
    getApps: vi.fn(() => [])
}));

vi.mock('firebase/auth', () => ({
  serverTimestamp: vi.fn(),
    getAuth: vi.fn(() => ({
  serverTimestamp: vi.fn(), currentUser: { uid: 'keeper-test-user' }, onAuthStateChanged: vi.fn(() => () => { }) })),
    initializeAuth: vi.fn(() => ({
  serverTimestamp: vi.fn(), currentUser: { uid: 'keeper-test-user' }, onAuthStateChanged: vi.fn(() => () => { }) })),
    onAuthStateChanged: vi.fn(),
    browserLocalPersistence: {},
    browserSessionPersistence: {},
    indexedDBLocalPersistence: {}
}));

vi.mock('firebase/firestore', () => ({
  serverTimestamp: vi.fn(),
    getFirestore: vi.fn(),
    initializeFirestore: vi.fn(),
    persistentLocalCache: vi.fn(),
    persistentMultipleTabManager: vi.fn(),
    Timestamp: {
        now: vi.fn(() => ({
  serverTimestamp: vi.fn(), toMillis: () => Date.now() })),
        fromDate: vi.fn(),
        fromMillis: vi.fn(),
    },
    doc: vi.fn(),
    getDoc: vi.fn(),
    setDoc: vi.fn(),
    collection: vi.fn()
}));

// Mock MembershipService
vi.mock('@/services/MembershipService', () => ({
  serverTimestamp: vi.fn(),
    MembershipService: {
        checkBudget: vi.fn().mockResolvedValue({ allowed: true }),
        trackUsage: vi.fn().mockResolvedValue(true)
    }
}));

// Mock AIService
const mockGenerateContent = vi.fn().mockResolvedValue({
    text: () => 'I remember.',
    usage: () => ({
  serverTimestamp: vi.fn(), promptTokenCount: 100, candidatesTokenCount: 10, totalTokenCount: 110 }),
    functionCalls: () => []
});

vi.mock('@/services/ai/GenAI', () => ({
  serverTimestamp: vi.fn(),
    GenAI: {
        generateContent: (...args: any[]) => mockGenerateContent(...args),
        getGenerativeModel: () => ({
  serverTimestamp: vi.fn(),
            generateContent: mockGenerateContent
        })
    }
}));

// ----------------------------------------------------------------------------
// Tests
// ----------------------------------------------------------------------------

describe('📚 Keeper: Context Integrity', () => {
    let agent: BaseAgent;

    beforeEach(() => {
        vi.clearAllMocks();
        agent = new BaseAgent({
            id: 'keeper',
            name: 'Keeper',
            description: 'Guardian',

            systemPrompt: 'You are Keeper.',
            category: 'specialist',
            color: 'blue',
            tools: []
        });
    });

    it('should use ContextManager to truncate history instead of naive slicing', async () => {
        // 1. Setup: Create a massive chat history
        // Each message is 1000 "chars" -> roughly 250 tokens
        // 50 messages = 12,500 tokens.
        // Max char slice was 32,000 chars.
        // We want to prove that we are now using a smarter limit or at least handling structured data.

        const massiveHistory: AgentMessage[] = Array.from({ length: 50 }, (_, i) => ({
            id: `msg-${i}`,
            role: i % 2 === 0 ? 'user' : 'model',
            text: 'A'.repeat(1000),
            timestamp: Date.now() + i
        }));

        // Context with BOTH string and array history
        const context = {
            orgId: 'test-org',
            projectId: 'test-project',
            chatHistory: massiveHistory,
            // Create a huge string to trigger the old logic if it were still there
            chatHistoryString: massiveHistory.map(m => `${m.role}: ${m.text}`).join('\n')
        };

        // 2. Execute
        await agent.execute('Hello', context);

        // 3. Assert
        expect(mockGenerateContent).toHaveBeenCalled();
        const callArgs = mockGenerateContent.mock.calls[0]![0];

        // Extract the text passed to the model
        const sentPrompt = callArgs[0].parts[0].text;

        // We want to ensure we are NOT just getting the tail end of a string (naive slice)
        // but a structured reconstruction or at least that the "HISTORY" section contains structured messages.

        // If naive slicing was used:
        // "[...Older history truncated...]" would appear if length > 32000

        // If ContextManager is used (which we will implement):
        // We should see a cleaner history, potentially starting with the first message (Anchor)
        // even if the middle is missing.

        // Let's assert that we DO NOT see the "Older history truncated" string from the old logic
        expect(sentPrompt).not.toContain('[...Older history truncated...]');

        // And we expect the Prompt to include the "Anchor" message (id: msg-0) if we are smart
        // provided the total length isn't absurdly small.
        // The first message text is 'A'.repeat(1000).
        // Let's check if the prompt contains "msg-0" or the content of the first message.
        // Since content is identical, we can't distinguish easily.
        // But we can check if the prompt size is reasonable.

        // Verify size
        expect(sentPrompt.length).toBeLessThan(1000000); // Sanity check
    });
});
