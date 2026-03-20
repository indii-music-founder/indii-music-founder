
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ----------------------------------------------------------------------------
// Mocks - MUST BE HOISTED
// ----------------------------------------------------------------------------

// Mock @/services/firebase to prevent real Firebase initialization
vi.mock('@/services/firebase', () => ({
    serverTimestamp: vi.fn(),
    auth: {
        currentUser: { uid: 'keeper-test-user', getIdToken: vi.fn().mockResolvedValue('test-token') },
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

// Mock Firebase Modules
vi.mock('firebase/app', () => ({
  serverTimestamp: vi.fn(),
    initializeApp: vi.fn(() => ({
  serverTimestamp: vi.fn(),})),
    getApp: vi.fn(() => ({
  serverTimestamp: vi.fn(),})),
    getApps: vi.fn(() => [])
}));

vi.mock('firebase/auth', async (importOriginal) => {
    return {
    serverTimestamp: vi.fn(),
        getAuth: vi.fn(() => ({
  serverTimestamp: vi.fn(),
            currentUser: { uid: 'keeper-test-user', getIdToken: vi.fn().mockResolvedValue('test-token') },
            onAuthStateChanged: vi.fn(() => () => { })
        })),
        initializeAuth: vi.fn(() => ({
  serverTimestamp: vi.fn(),
            currentUser: { uid: 'keeper-test-user', getIdToken: vi.fn().mockResolvedValue('test-token') },
            onAuthStateChanged: vi.fn(() => () => { })
        })),
        onAuthStateChanged: vi.fn(),
        browserLocalPersistence: {},
        browserSessionPersistence: {},
        indexedDBLocalPersistence: {}
    };
});

vi.mock('firebase/firestore', async (importOriginal) => {
    return {
    serverTimestamp: vi.fn(),
        Timestamp: {
            now: () => ({
  serverTimestamp: vi.fn(), toMillis: () => Date.now(), seconds: Math.floor(Date.now() / 1000), nanoseconds: 0 }),
            fromDate: (date: Date) => ({ toMillis: () => date.getTime(), seconds: Math.floor(date.getTime() / 1000), nanoseconds: 0 }),
            fromMillis: (ms: number) => ({ toMillis: () => ms, seconds: Math.floor(ms / 1000), nanoseconds: 0 })
        },
        getFirestore: vi.fn(() => ({
  serverTimestamp: vi.fn(),})),
        initializeFirestore: vi.fn(() => ({
  serverTimestamp: vi.fn(),})),
        persistentLocalCache: vi.fn(),
        persistentMultipleTabManager: vi.fn(),
        doc: vi.fn(),
        setDoc: vi.fn(),
        getDoc: vi.fn(),
        collection: vi.fn(),
        onSnapshot: vi.fn(),
        writeBatch: vi.fn(() => ({
  serverTimestamp: vi.fn(), commit: vi.fn() })),
        addDoc: vi.fn(),
        updateDoc: vi.fn(),
        deleteDoc: vi.fn(),
        query: vi.fn(),
        where: vi.fn(),
        limit: vi.fn(),
        orderBy: vi.fn(),
        getDocs: vi.fn().mockResolvedValue({ docs: [] })
    }
});

vi.mock('firebase/storage', () => ({
  serverTimestamp: vi.fn(),
    getStorage: vi.fn(() => ({
  serverTimestamp: vi.fn(),}))
}));

vi.mock('firebase/functions', () => ({
  serverTimestamp: vi.fn(),
    getFunctions: vi.fn(() => ({
  serverTimestamp: vi.fn(),})),
    connectFunctionsEmulator: vi.fn(),
    httpsCallable: vi.fn()
}));

vi.mock('firebase/app-check', () => ({
  serverTimestamp: vi.fn(),
    initializeAppCheck: vi.fn(),
    ReCaptchaEnterpriseProvider: vi.fn()
}));

vi.mock('firebase/remote-config', () => ({
  serverTimestamp: vi.fn(),
    getRemoteConfig: vi.fn(() => ({
  serverTimestamp: vi.fn(),}))
}));

vi.mock('firebase/ai', () => ({
  serverTimestamp: vi.fn(),
    getAI: vi.fn(),
    VertexAIBackend: vi.fn()
}));

// Mock store to prevent window.location access during initialization
vi.mock('@/core/store', () => ({
  serverTimestamp: vi.fn(),
    useStore: {
        getState: () => ({
  serverTimestamp: vi.fn(),
            currentOrganizationId: 'keeper-org',
            uploadedImages: [],
            currentModule: 'dashboard'
        })
    }
}));

// Mock OrganizationService
vi.mock('@/services/OrganizationService', () => ({
  serverTimestamp: vi.fn(),
    OrganizationService: {
        getCurrentOrgId: vi.fn(() => 'keeper-org')
    }
}));

// Mock MembershipService (Budget Checks)
vi.mock('@/services/MembershipService', () => ({
  serverTimestamp: vi.fn(),
    MembershipService: {
        checkBudget: vi.fn().mockResolvedValue({ allowed: true }),
        trackUsage: vi.fn().mockResolvedValue(true),
        recordSpend: vi.fn().mockResolvedValue(true)
    }
}));

// Mock AI Service (Capture Prompts)
const mockGenerateContent = vi.fn().mockResolvedValue({
    response: {
        text: () => 'I have processed the context.',
        candidates: [{ content: { parts: [{ text: 'I have processed the context.' }] } }],
        usageMetadata: { promptTokenCount: 500, candidatesTokenCount: 10, totalTokenCount: 510 }
    }
});

vi.mock('@/services/ai/GenAI', () => ({
  serverTimestamp: vi.fn(),
    GenAI: {
        generateContent: (...args: any[]) => mockGenerateContent(...args),
        getGenerativeModel: () => ({
  serverTimestamp: vi.fn(),
            generateContent: mockGenerateContent
        }),
        generateSpeech: vi.fn() // Needed because BaseAgent uses it in 'speak' tool
    }
}));

// Mock Electron API
const mockSaveHistory = vi.fn().mockResolvedValue({ success: true });
const mockDeleteHistory = vi.fn().mockResolvedValue({ success: true });

// ----------------------------------------------------------------------------
// Test Suite - Dynamic Imports Required for BaseAgent/SessionService to pick up mocks
// ----------------------------------------------------------------------------

import { BaseAgent } from '@/services/agent/BaseAgent';
import { AgentMessage } from '@/core/store/slices/agent';
import { sessionService } from '@/services/agent/SessionService';

describe('📚 Keeper: End-to-End Context & Persistence', () => {
    let agent: BaseAgent;

    beforeEach(() => {
        vi.clearAllMocks();
        mockSaveHistory.mockClear();
        mockDeleteHistory.mockClear();

        // Stub Window for Electron
        vi.stubGlobal('window', {
            electronAPI: {
                agent: {
                    saveHistory: mockSaveHistory,
                    deleteHistory: mockDeleteHistory
                }
            }
        });

        // Initialize Agent
        agent = new BaseAgent({
            id: 'keeper',
            name: 'Keeper',
            description: 'The Guardian of Context',
            systemPrompt: 'You are Keeper. You never forget.',
            category: 'specialist',
            color: 'green',
            tools: []
        });
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('should truncate massive history before sending to AI, but persist full history to disk', async () => {
        // 1. Create a "Massive" History
        // 100 messages * ~200 tokens each = ~20,000 tokens.
        // BaseAgent SAFE_TOKEN_LIMIT is 15,000.
        // We expect truncation.

        const massiveHistory: AgentMessage[] = Array.from({ length: 100 }, (_, i) => ({
            id: `msg-${i}`,
            role: i % 2 === 0 ? 'user' : 'model',
            text: `History item ${i}. ` + 'x'.repeat(500), // ~150 tokens
            timestamp: Date.now() + (i * 1000)
        }));

        const context = {
            userId: 'keeper-test-user',
            orgId: 'keeper-org',
            projectId: 'project-alpha',
            chatHistory: massiveHistory
        };

        // 2. Execute Agent (Simulate "New Message" processing)
        await agent.execute('What do you remember?', context as any);

        // 3. ASSERTION: Context Window (RAM/AI)
        expect(mockGenerateContent).toHaveBeenCalledTimes(1);
        const aiCallArgs = mockGenerateContent.mock.calls[0]![0];

        // Extract the prompt parts
        const promptText = aiCallArgs[0].parts[0].text;

        // Check 3.1: System Prompt must be present (Mission)
        expect(promptText).toContain('You are Keeper. You never forget.');

        // Check 3.2: Truncation
        expect(promptText).toContain('History item 0.'); // Anchor
        expect(promptText).toContain('History item 99.'); // Recency

        // 4. ASSERTION: Persistence (Disk)
        const newHistory = [
            ...massiveHistory,
            { id: 'msg-new', role: 'user', text: 'What do you remember?', timestamp: Date.now() },
            { id: 'msg-response', role: 'model', text: 'I have processed the context.', timestamp: Date.now() }
        ];

        const sessionUpdates = {
            id: 'session-keeper-1',
            messages: newHistory,
            updatedAt: Date.now()
        };

        // Act: Save to "Disk"
        await sessionService.updateSession('session-keeper-1', sessionUpdates as any);

        // Assert: Electron API was called with the FULL history (no truncation on disk!)
        expect(mockSaveHistory).toHaveBeenCalledTimes(1);
        const saveCallArgs = mockSaveHistory.mock.calls[0];

        const savedSessionId = saveCallArgs![0];
        const savedData = saveCallArgs![1];

        expect(savedSessionId).toBe('session-keeper-1');
        expect(savedData.messages).toHaveLength(102); // 100 + 2
        expect(savedData.messages[50].text).toContain('History item 50'); // Middle message still exists on disk
    });
});
