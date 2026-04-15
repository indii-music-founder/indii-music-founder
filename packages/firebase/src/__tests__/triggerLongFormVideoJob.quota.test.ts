
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';
import firebaseFunctionsTest from 'firebase-functions-test';

// Initialize test environment
const testEnv = firebaseFunctionsTest();

// Mocks must be defined before imports
const mockTransaction = {
    get: vi.fn(),
    set: vi.fn(),
    update: vi.fn()
};

const mockDoc = vi.fn();

const mockFirestore = {
    collection: vi.fn(),
    runTransaction: vi.fn((callback) => callback(mockTransaction)),
    doc: mockDoc
};

const mockInngestSend = vi.fn();

// Build a firestore mock that works both as fn() and as namespace (admin.firestore.FieldValue)
const mockFirestoreFn = Object.assign(vi.fn(() => mockFirestore), {
    FieldValue: {
        serverTimestamp: vi.fn(() => 'mock-server-timestamp'),
        increment: vi.fn((n: number) => n),
        arrayUnion: vi.fn((...args: unknown[]) => args),
        arrayRemove: vi.fn((...args: unknown[]) => args),
        delete: vi.fn()
    },
    Timestamp: {
        now: vi.fn(() => ({ seconds: 0, nanoseconds: 0, toDate: () => new Date() })),
        fromDate: vi.fn((d: Date) => ({ seconds: Math.floor(d.getTime() / 1000), nanoseconds: 0, toDate: () => d }))
    }
});

vi.mock('firebase-admin', () => ({
    default: {
        initializeApp: vi.fn(),
        firestore: mockFirestoreFn,
        auth: vi.fn(),
        storage: vi.fn(),
        messaging: vi.fn(),
        apps: [{ name: '[DEFAULT]' }]
    },
    initializeApp: vi.fn(),
    firestore: mockFirestoreFn,
    auth: vi.fn(),
    storage: vi.fn(),
    messaging: vi.fn(),
    apps: [{ name: '[DEFAULT]' }]
}));

// Mock firebase-functions/v1 to bypass secrets validation
const mockOnCreateHandler = vi.fn((handler) => handler);
const mockOnFinalizeHandler = vi.fn((handler) => handler);

const mockScheduleBuilder = {
    timeZone: vi.fn().mockReturnValue({
        onRun: vi.fn((handler) => handler)
    })
};

const mockBuilder: Record<string, any> = {
    https: {
        onCall: vi.fn((handler) => handler),
        onRequest: vi.fn((handler) => handler)
    },
    pubsub: {
        schedule: vi.fn(() => mockScheduleBuilder)
    },
    firestore: {
        document: vi.fn(() => ({
            onCreate: mockOnCreateHandler,
            onUpdate: vi.fn((handler) => handler),
            onDelete: vi.fn((handler) => handler),
            onWrite: vi.fn((handler) => handler)
        }))
    },
    storage: {
        object: vi.fn(() => ({
            onFinalize: mockOnFinalizeHandler,
            onDelete: vi.fn((handler) => handler),
            onArchive: vi.fn((handler) => handler),
            onMetadataUpdate: vi.fn((handler) => handler)
        }))
    },
    runWith: vi.fn()
};
// Make runWith return the full builder (including pubsub, firestore, storage)
mockBuilder.runWith.mockReturnValue(mockBuilder);

vi.mock('firebase-functions/v1', () => ({
    ...mockBuilder,
    region: vi.fn(() => mockBuilder),
    runWith: vi.fn(() => mockBuilder),
    https: {
        onCall: vi.fn((handler) => handler),
        onRequest: vi.fn((handler) => handler),
        HttpsError: class extends Error {
            code: string;
            constructor(code: string, message: string) {
                super(message);
                this.code = code;
            }
        }
    },
    config: vi.fn(() => ({}))
}));

// FieldValue is now defined on mockFirestoreFn via Object.assign above

// Fix Inngest Mock to be a Class
vi.mock('inngest', () => ({
    Inngest: class MockInngest {
        constructor() { }
        send = mockInngestSend;
    }
}));

// Mock GoogleAuth to prevent actual credential lookups
vi.mock('google-auth-library', () => ({
    GoogleAuth: class {
        async getClient() {
            return { getAccessToken: async () => ({ token: 'mock-access-token' }) };
        }
        async getProjectId() {
            return 'mock-project-id';
        }
    }
}));

// Mock params to prevent secret lookup failure
vi.mock('firebase-functions/params', () => ({
    defineSecret: vi.fn(() => ({
        value: () => 'mock-secret'
    }))
}));

// Mock Stripe to prevent initialization error
vi.mock('stripe', () => ({
    default: class MockStripe {
        constructor(_apiKey: string) { }
    }
}));

// Mock Stripe config to ensure it doesn't fail on process.env access
vi.mock('../stripe/config', () => ({
    stripe: {}
}));

// Mock MCP module — initializes @modelcontextprotocol/sdk Server at load time which
// creates a listener and blocks when loaded in a vi.resetModules() context.
vi.mock('../mcp', () => ({
    mcpHttpHandler: vi.fn((req: unknown, res: unknown) => res)
}));

// Mock Orchestration module — calls admin.initializeApp() unconditionally at load time.
vi.mock('../orchestration', () => ({
    orchestrationListener: vi.fn()
}));

// Mock relay/email/analytics/devops modules that may have network-touching side effects.
vi.mock('../relay/relayCommandProcessor', () => ({ processRelayCommand: vi.fn() }));
vi.mock('../relay/telegramWebhook', () => ({ telegramWebhook: vi.fn() }));
vi.mock('../relay/telegramLink', () => ({ generateTelegramLinkCode: vi.fn(), getTelegramLinkStatus: vi.fn() }));
vi.mock('../email/sendEmail', () => ({ sendEmail: vi.fn() }));
vi.mock('../email/tokenManager', () => ({ emailExchangeToken: vi.fn(), emailRefreshToken: vi.fn(), emailRevokeToken: vi.fn() }));
vi.mock('../analytics/platformTokenExchange', () => ({ analyticsExchangeToken: vi.fn(), analyticsRefreshToken: vi.fn(), analyticsRevokeToken: vi.fn() }));
vi.mock('../devops/storageMaintenance', () => ({ cleanupOrphanedVideos: vi.fn(), trackStorageQuotas: vi.fn(), flagVideosForArchival: vi.fn() }));


describe('triggerLongFormVideoJob (Ledger Quota Checks)', () => {
    let triggerLongFormVideoJob: any;
    let wrappedFunction: any;

    // Import the barrel index ONCE per test file (beforeAll) rather than per test (beforeEach).
    // Under heavy shard parallelism, transpiling the 1461-line index.ts 3 times exceeds the
    // 30s hookTimeout. The handler reference is stable across tests — module state is reset
    // per-test by vi.clearAllMocks() + the Firestore mock re-init below.
    beforeAll(async () => {
        const mod = await import('../index');
        triggerLongFormVideoJob = mod.triggerLongFormVideoJob;
        wrappedFunction = triggerLongFormVideoJob;
    }, 60000);

    beforeEach(() => {
        vi.clearAllMocks();

        // Reset Firestore Mocks

        mockFirestore.collection.mockReturnValue({
            doc: mockDoc
        });

        mockDoc.mockReturnValue({
            get: vi.fn(), // Generic get
            set: vi.fn(),
            collection: vi.fn(() => ({
                doc: vi.fn()
            }))
        });
    });

    afterEach(() => {
        testEnv.cleanup();
    });

    it('💸 HALTS "Free Tier" user when daily limit is breached (The "Hard Limit")', async () => {
        const userId = 'user-broke';
        const context = { auth: { uid: userId } };
        const data = {
            jobId: 'job-123',
            prompts: ['A cat playing piano'],
            totalDuration: "5", // Fixed: Must be string
            startImage: 'data:image/png;base64,fake'
        };

        // 1. Mock Organization Lookup (Free Tier)
        const mockOrgGet = vi.fn().mockResolvedValue({
            exists: true,
            data: () => ({ plan: 'free' })
        });

        // 2. Mock Usage Lookup (At Limit)
        const mockUsageGet = vi.fn().mockResolvedValue({
            exists: true,
            data: () => ({ videosGenerated: 5 }) // Limit is 5
        });
        mockTransaction.get.mockImplementation(mockUsageGet);

        // Setup mock chain
        const _mockDoc = vi.fn((path) => {
            if (path === 'personal') return { get: mockOrgGet }; // Org check (simplified)
            return {
                get: mockOrgGet,
                collection: vi.fn(() => ({ doc: vi.fn() })),
                set: vi.fn()
            };
        });

        // We need to match the specific calls in the implementation
        // orgDoc lookup: collection('organizations').doc(orgId)
        // usageRef: collection('users').doc(userId).collection('usage').doc(today)
        // jobRef: collection('videoJobs').doc(jobId)

        mockFirestore.collection.mockImplementation((collectionName) => {
            if (collectionName === 'organizations') {
                return {
                    doc: vi.fn(() => ({
                        get: mockOrgGet
                    }))
                };
            }
            if (collectionName === 'users') {
                return {
                    doc: vi.fn(() => ({
                        collection: vi.fn(() => ({
                            doc: vi.fn() // usage doc ref
                        }))
                    }))
                };
            }
            if (collectionName === 'videoJobs') {
                return {
                    doc: vi.fn(() => ({
                        set: vi.fn()
                    }))
                };
            }
            return { doc: vi.fn() };
        });

        // Execute & Assert
        await expect(wrappedFunction(data, context)).rejects.toThrow(/Daily video generation limit reached/);

        expect(mockInngestSend).not.toHaveBeenCalled();
    });

    it('💸 blocks "Free Tier" users from "Pro" duration jobs (Subscription Gate)', async () => {
        const userId = 'user-ambitious';
        const context = { auth: { uid: userId } };

        // Free tier max is 8 minutes (480s)
        // User requests 10 minutes (600s)
        const data = {
            jobId: 'job-long-1',
            prompts: ['Epic movie'],
            totalDuration: "600", // Fixed: Must be string
            startImage: 'data:image/png;base64,fake',
            orgId: 'personal' // default free
        };

        // Mock Org (Personal = Free implied or mocked)
        // In the code: if orgId is personal, it skips org lookup and uses default 'free'
        // But let's mock the org lookup just in case specific logic changes

        mockFirestore.collection.mockImplementation((collectionName) => {
            if (collectionName === 'organizations') {
                return {
                    doc: vi.fn(() => ({
                        get: vi.fn().mockResolvedValue({ exists: false }) // Fallback to free
                    }))
                };
            }
            return {
                doc: vi.fn(() => ({
                    collection: vi.fn(() => ({ doc: vi.fn() })),
                    set: vi.fn()
                }))
            };
        });

        await expect(wrappedFunction(data, context)).rejects.toThrow(/Video duration 600s exceeds free tier limit of 480s/);

        expect(mockInngestSend).not.toHaveBeenCalled();
    });

    it('💸 allows generation and deducts credit when under limit', async () => {
        const userId = 'user-ok';
        const context = { auth: { uid: userId } };
        const data = {
            jobId: 'job-ok-1',
            prompts: ['Short clip'],
            totalDuration: "10", // Fixed: Must be string
            startImage: 'data:image/png;base64,fake'
        };

        // Mock Usage (2/5)
        const mockUsageGet = vi.fn().mockResolvedValue({
            exists: true,
            data: () => ({ videosGenerated: 2 })
        });
        mockTransaction.get.mockImplementation(mockUsageGet);

        // Setup generic mocks — must include create() as implementation uses doc().create()
        const mockDocInstance = {
            get: vi.fn().mockResolvedValue({ exists: false, data: () => null }),
            collection: vi.fn(() => ({ doc: vi.fn(() => mockDocInstance) })),
            set: vi.fn().mockResolvedValue(undefined),
            create: vi.fn().mockResolvedValue(undefined),
            update: vi.fn().mockResolvedValue(undefined)
        };
        mockFirestore.collection.mockImplementation(() => ({
            doc: vi.fn(() => mockDocInstance)
        }));

        const result = await wrappedFunction(data, context);

        expect(result.success).toBe(true);
        expect(mockTransaction.update).toHaveBeenCalled(); // Should update usage
        expect(mockInngestSend).toHaveBeenCalled();
    });
});
