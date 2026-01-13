
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as admin from 'firebase-admin';
import firebaseFunctionsTest from 'firebase-functions-test';

// Initialize test environment
const testEnv = firebaseFunctionsTest();

// Mocks must be defined before imports
const mockTransaction = {
    get: vi.fn(),
    set: vi.fn(),
    update: vi.fn()
};

const mockFirestore = {
    collection: vi.fn(),
    runTransaction: vi.fn((callback) => callback(mockTransaction))
};

const mockInngestSend = vi.fn();

vi.mock('firebase-admin', () => ({
    initializeApp: vi.fn(),
    firestore: vi.fn(() => mockFirestore),
    auth: vi.fn(),
    storage: vi.fn()
}));

// Mock firebase-functions/v1 to bypass secrets validation
const mockBuilder = {
    https: {
        onCall: vi.fn((handler) => handler),
        onRequest: vi.fn((handler) => handler)
    },
    runWith: vi.fn().mockReturnThis()
};

vi.mock('firebase-functions/v1', () => ({
    runWith: vi.fn(() => mockBuilder),
    https: {
        onCall: vi.fn((handler) => handler),
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

// Mock Firestore FieldValue
(admin.firestore as any).FieldValue = {
    serverTimestamp: vi.fn(),
    increment: vi.fn((n) => n)
};

// Fix Inngest Mock to be a Class
vi.mock('inngest', () => ({
    Inngest: class MockInngest {
        constructor() { }
        send = mockInngestSend;
    }
}));

// Mock GoogleAuth to prevent actual credential lookups
vi.mock('google-auth-library', () => ({
    GoogleAuth: vi.fn()
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
        constructor(apiKey: string) { }
    }
}));

// Mock Stripe config to ensure it doesn't fail on process.env access
vi.mock('../stripe/config', () => ({
    stripe: {}
}));


describe('triggerLongFormVideoJob (Ledger Quota Checks)', () => {
    let triggerLongFormVideoJob: any;
    let wrappedFunction: any;

    beforeEach(async () => {
        vi.clearAllMocks();

        // Reset Firestore Mocks
        const mockCollection = vi.fn();
        const mockDoc = vi.fn();

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

        // Import the function dynamically to ensure mocks are applied
        const mod = await import('../index');
        triggerLongFormVideoJob = mod.triggerLongFormVideoJob;
        // Since we mocked firebase-functions to return the handler directly, we don't need to wrap it
        // wrappedFunction = testEnv.wrap(triggerLongFormVideoJob);
        wrappedFunction = triggerLongFormVideoJob;
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
        const mockDoc = vi.fn((path) => {
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

        // Setup generic mocks
        mockFirestore.collection.mockImplementation(() => ({
            doc: vi.fn(() => ({
                get: vi.fn(),
                collection: vi.fn(() => ({ doc: vi.fn() })),
                set: vi.fn()
            }))
        }));

        const result = await wrappedFunction(data, context);

        expect(result.success).toBe(true);
        expect(mockTransaction.update).toHaveBeenCalled(); // Should update usage
        expect(mockInngestSend).toHaveBeenCalled();
    });
});
