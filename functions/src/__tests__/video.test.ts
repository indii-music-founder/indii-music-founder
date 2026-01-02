import { describe, it, expect, vi, beforeEach } from 'vitest';

// Hoist mocks to ensure they are available for vi.mock
const {
    mockFirestore,
    mockCollection,
    mockDoc,
    mockSet,
    mockGet,
    mockFieldValue,
    mockStorage,
    mockBucket,
    mockFile,
    mockSave,
    mockPublicUrl,
    mockInitializeApp,
    mockHttpsOnCall,
    mockHttpsError,
    mockInngestSend,
    mockAuthVerifyIdToken
} = vi.hoisted(() => {
    const mockSet = vi.fn();
    const mockGet = vi.fn();
    const mockDoc = vi.fn(() => ({ set: mockSet, get: mockGet }));
    const mockCollection = vi.fn(() => ({ doc: mockDoc }));
    const mockFirestore = vi.fn(() => ({ collection: mockCollection }));
    const mockFieldValue = { serverTimestamp: vi.fn(() => 'TIMESTAMP') };

    const mockSave = vi.fn();
    const mockPublicUrl = vi.fn(() => 'https://mock-storage-url.com/video.mp4');
    const mockFile = vi.fn(() => ({ save: mockSave, publicUrl: mockPublicUrl }));
    const mockBucket = vi.fn(() => ({ file: mockFile }));
    const mockStorage = vi.fn(() => ({ bucket: mockBucket }));

    const mockInitializeApp = vi.fn();
    const mockHttpsOnCall = vi.fn();

    // Proper HttpsError mock class
    class HttpsError extends Error {
        code: string;
        details: any;
        constructor(code: string, message: string, details?: any) {
            super(message);
            this.code = code;
            this.details = details;
        }
    }
    const mockHttpsError = HttpsError;

    const mockInngestSend = vi.fn();

    const mockAuthVerifyIdToken = vi.fn();

    return {
        mockFirestore,
        mockCollection,
        mockDoc,
        mockSet,
        mockGet,
        mockFieldValue,
        mockStorage,
        mockBucket,
        mockFile,
        mockSave,
        mockPublicUrl,
        mockInitializeApp,
        mockHttpsOnCall,
        mockHttpsError,
        mockInngestSend,
        mockAuthVerifyIdToken
    };
});

// Mock Firebase Admin
vi.mock('firebase-admin', () => ({
    initializeApp: mockInitializeApp,
    firestore: Object.assign(mockFirestore, { FieldValue: mockFieldValue }),
    storage: mockStorage,
    auth: vi.fn(() => ({
        verifyIdToken: mockAuthVerifyIdToken
    }))
}));

// Mock Firebase Functions
vi.mock('firebase-functions/v1', () => ({
    runWith: vi.fn().mockReturnThis(),
    https: {
        onCall: mockHttpsOnCall,
        onRequest: vi.fn(),
        HttpsError: mockHttpsError,
        CallableContext: vi.fn()
    }
}));

vi.mock('firebase-functions/params', () => ({
    defineSecret: vi.fn(() => ({ value: () => 'secret' }))
}));

// Mock Inngest
vi.mock('inngest', () => {
    return {
        Inngest: class {
            constructor() {
                return {
                    createFunction: vi.fn(),
                    send: mockInngestSend
                };
            }
        }
    };
});

// Mock GoogleAuth
vi.mock('google-auth-library', () => {
    return {
        GoogleAuth: vi.fn().mockImplementation(() => ({
            getClient: vi.fn().mockResolvedValue({
                getAccessToken: vi.fn().mockResolvedValue({ token: 'mock-token' })
            }),
            getProjectId: vi.fn().mockResolvedValue('mock-project')
        }))
    };
});

// Mock Transcoder
vi.mock('@google-cloud/video-transcoder', () => ({
    TranscoderServiceClient: vi.fn().mockImplementation(() => ({
        createJob: vi.fn().mockResolvedValue([{ name: 'mock-job-name' }]),
        locationPath: vi.fn()
    }))
}));

describe('Video Backend', () => {

    // Dynamically import the functions to test
    let triggerLongFormVideoJob: any;

    beforeEach(async () => {
        vi.clearAllMocks();
        // Reset modules to ensure fresh import for each test if needed
        vi.resetModules();

        // Mock the onCall implementation to capture the handler
        mockHttpsOnCall.mockImplementation((handler) => {
            return handler;
        });

        const index = await import('../index');
        triggerLongFormVideoJob = index.triggerLongFormVideoJob;
    });

    it('should validate prompts array in triggerLongFormVideoJob', async () => {
        const handler = triggerLongFormVideoJob;

        const context = { auth: { uid: 'test-user' } };

        // Test Case 1: Empty prompts array
        await expect(handler({
            jobId: 'job-123',
            prompts: []
        }, context)).rejects.toThrow('Missing required fields: prompts (non-empty array) or jobId.');

        // Test Case 2: Missing prompts
        await expect(handler({
            jobId: 'job-123'
        }, context)).rejects.toThrow('Missing required fields: prompts (non-empty array) or jobId.');

        // Test Case 3: Valid input
        await handler({
            jobId: 'job-123',
            prompts: ['Test prompt'],
            orgId: 'org-1'
        }, context);

        expect(mockSet).toHaveBeenCalledWith(expect.objectContaining({
            id: 'job-123',
            status: 'queued',
            isLongForm: true
        }));
        expect(mockInngestSend).toHaveBeenCalled();
    });

    it('should require authentication for triggerLongFormVideoJob', async () => {
        const handler = triggerLongFormVideoJob;
        await expect(handler({}, {})).rejects.toThrow('User must be authenticated');
    });
});
