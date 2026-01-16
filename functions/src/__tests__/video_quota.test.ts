import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as admin from 'firebase-admin';

// Use vi.hoisted to define mocks
const mocks = vi.hoisted(() => {
    const mockSet = vi.fn();
    const mockGet = vi.fn();
    const mockUpdate = vi.fn();

    // Create a chainable mock object for Firestore
    const mockDoc = vi.fn(() => ({
        set: mockSet,
        get: mockGet,
        update: mockUpdate,
        collection: vi.fn(() => ({ doc: mockDoc })) // Nested collections
    }));

    const mockCollection = vi.fn(() => ({
        doc: mockDoc,
        add: vi.fn()
    }));

    const mockRunTransaction = vi.fn(async (cb) => cb({
        get: mockGet,
        set: mockSet,
        update: mockUpdate
    }));

    return {
        firestore: {
            collection: mockCollection,
            runTransaction: mockRunTransaction,
            doc: mockDoc,
            set: mockSet,
            get: mockGet,
            update: mockUpdate
        },
        inngest: {
            send: vi.fn()
        },
        secrets: {
            value: vi.fn(() => 'mock-secret-value')
        }
    };
});

// Mock firebase-admin
vi.mock('firebase-admin', () => {
    return {
        initializeApp: vi.fn(),
        firestore: Object.assign(
            vi.fn(() => ({
                collection: mocks.firestore.collection,
                runTransaction: mocks.firestore.runTransaction
            })),
            {
                FieldValue: {
                    serverTimestamp: vi.fn(() => 'TIMESTAMP'),
                    increment: vi.fn((n) => n)
                }
            }
        ),
        storage: vi.fn(() => ({
            bucket: () => ({
                file: () => ({
                    save: vi.fn(),
                    makePublic: vi.fn(),
                    publicUrl: () => 'https://mock-storage-url.com/video.mp4'
                })
            })
        })),
        auth: vi.fn()
    };
});

// Mock inngest
vi.mock('inngest', () => ({
    Inngest: class {
        constructor() {
            return { send: mocks.inngest.send };
        }
    }
}));

// Mock inngest/express
vi.mock('inngest/express', () => ({
    serve: vi.fn(() => vi.fn())
}));

// Mock firebase-functions
vi.mock('firebase-functions/v1', () => ({
    runWith: vi.fn().mockReturnThis(),
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

// Mock firebase-functions/params
vi.mock('firebase-functions/params', () => ({
    defineSecret: vi.fn(() => ({ value: mocks.secrets.value }))
}));

// MOCK STRIPE CONFIG to avoid importing client-side files
vi.mock('../stripe/config', () => ({
    default: {
        'free': {},
        'pro_monthly': { monthly: 'price_mock' }
    }
}));
// Mock Subscription functions to avoid Stripe/Type import issues
vi.mock('../subscription/getSubscription', () => ({ getSubscription: vi.fn() }));
vi.mock('../subscription/createCheckoutSession', () => ({ createCheckoutSession: vi.fn() }));
vi.mock('../subscription/getCustomerPortal', () => ({ getCustomerPortal: vi.fn() }));
vi.mock('../subscription/cancelSubscription', () => ({ cancelSubscription: vi.fn() }));
vi.mock('../subscription/resumeSubscription', () => ({ resumeSubscription: vi.fn() }));
vi.mock('../subscription/getUsageStats', () => ({ getUsageStats: vi.fn() }));
vi.mock('../subscription/trackUsage', () => ({ trackUsage: vi.fn() }));

// Import functions AFTER mocks
import { triggerLongFormVideoJob } from '../index';

describe('Video Quota & Circuit Breaker Tests', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should BLOCK video generation when daily limit is reached (The "Circuit Breaker")', async () => {
        const context: any = { auth: { uid: 'broke_user_123', token: {} } };
        const data = {
            jobId: 'job-quota-fail',
            prompts: ['A cinematic shot of a robot accountant'],
            orgId: 'personal', // Defaults to 'free' tier
            totalDuration: '10', // Passed as string to satisfy Zod
            startImage: 'data:image/png;base64,mockbase64'
        };

        // Mock Firestore Transaction Get to return HIGH usage
        // usageDoc.exists = true, data() => { videosGenerated: 5 } (Limit is 5 for free)
        mocks.firestore.get.mockResolvedValueOnce({
            exists: true,
            data: () => ({ videosGenerated: 5 })
        });

        // The implementation checks: currentUsage >= limits.maxVideoGenerationsPerDay
        // Free tier limit is 5.

        await expect(triggerLongFormVideoJob(data, context))
            .rejects.toThrow('Daily video generation limit reached for free tier (5/day)');

        // Verify transaction was attempted
        expect(mocks.firestore.runTransaction).toHaveBeenCalled();
    });

    it('should BLOCK video generation when duration exceeds tier limit', async () => {
        const context: any = { auth: { uid: 'long_movie_user', token: {} } };
        const data = {
            jobId: 'job-duration-fail',
            prompts: ['A 20 hour movie'],
            orgId: 'personal',
            totalDuration: '600', // Passed as string (600s = 10 mins > 8 mins limit)
            startImage: 'data:image/png;base64,mockbase64'
        };

        await expect(triggerLongFormVideoJob(data, context))
            .rejects.toThrow('Video duration 600s exceeds free tier limit of 480s.');
    });

    it('should ALLOW generation when under limit', async () => {
        const context: any = { auth: { uid: 'rich_user', token: {} } };
        const data = {
            jobId: 'job-success',
            prompts: ['A short clip'],
            orgId: 'personal',
            totalDuration: '10', // Passed as string
            startImage: 'data:image/png;base64,mockbase64'
        };

        // Mock usage low
        mocks.firestore.get.mockResolvedValueOnce({
            exists: true,
            data: () => ({ videosGenerated: 4 })
        });

        const result = await triggerLongFormVideoJob(data, context);
        expect(result).toEqual({ success: true, message: "Long form video generation started." });
    });
});
