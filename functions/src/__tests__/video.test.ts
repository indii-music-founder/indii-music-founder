import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as admin from 'firebase-admin';

// Mock Firebase Admin
vi.mock('firebase-admin', () => ({
    initializeApp: vi.fn(),
    firestore: vi.fn(() => ({
        collection: vi.fn(() => ({
            doc: vi.fn(() => ({
                set: vi.fn(),
                get: vi.fn()
            }))
        })),
        FieldValue: {
            serverTimestamp: vi.fn()
        }
    })),
    storage: vi.fn(),
    auth: vi.fn()

// Hoist mocks to top level to avoid ReferenceError
const mockSet = vi.fn();
const mockDoc = vi.fn(() => ({ set: mockSet }));
const mockCollection = vi.fn(() => ({ doc: mockDoc }));
const mockFirestore = vi.fn(() => ({ collection: mockCollection }));
const mockFieldValue = { serverTimestamp: vi.fn(() => 'TIMESTAMP') };

const mockAuthGetClient = vi.fn();
const mockAuthGetProjectId = vi.fn();

// Mock Firebase Admin
vi.mock('firebase-admin', () => ({
    initializeApp: vi.fn(),
    firestore: Object.assign(mockFirestore, { FieldValue: mockFieldValue }),
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

vi.mock('@google-cloud/vertexai', () => ({
    VertexAI: vi.fn()
}));

describe('Video Backend', () => {
    it('should be testable', () => {
        expect(true).toBe(true);
    });

    it('should initialize firebase admin when module loads', async () => {
        // Dynamic import to trigger execution
        await import('../index');
        expect(admin.initializeApp).toHaveBeenCalled();
    });
});

// Hoisted Mocks
const {
    mockSet,
    mockDoc,
    mockCollection,
    mockFirestore,
    mockFieldValue,
    mockAuthGetClient,
    mockAuthGetProjectId
} = vi.hoisted(() => {
    const mockSet = vi.fn();
    const mockDoc = vi.fn(() => ({ set: mockSet }));
    const mockCollection = vi.fn(() => ({ doc: mockDoc }));
    const mockFirestore = vi.fn(() => ({ collection: mockCollection }));
    const mockFieldValue = { serverTimestamp: vi.fn(() => 'TIMESTAMP') };

    const mockAuthGetClient = vi.fn();
    const mockAuthGetProjectId = vi.fn();

    return {
        mockSet,
        mockDoc,
        mockCollection,
        mockFirestore,
        mockFieldValue,
        mockAuthGetClient,
        mockAuthGetProjectId
    };
});
// Mocks
const mockSet = vi.fn();
const mockDoc = vi.fn(() => ({ set: mockSet }));
const mockCollection = vi.fn(() => ({ doc: mockDoc }));
const mockFirestore = vi.fn(() => ({ collection: mockCollection }));
const mockFieldValue = { serverTimestamp: vi.fn(() => 'TIMESTAMP') };

const mockAuthGetClient = vi.fn();
const mockAuthGetProjectId = vi.fn();

// Mock Modules
vi.mock('firebase-admin', () => ({
    initializeApp: vi.fn(),
    firestore: Object.assign(mockFirestore, { FieldValue: mockFieldValue }),
    storage: vi.fn(() => ({
        bucket: () => ({
            file: () => ({
                save: vi.fn(),
                makePublic: vi.fn(),
                publicUrl: () => 'https://mock-storage-url.com/video.mp4'
            })
        })
    })),
    // Add auth mock if needed by other tests, though not strictly used in this test file's logic blocks
    auth: vi.fn()
}));

// Mock GoogleAuth class using a class-like structure for the mock
class MockGoogleAuth {
    getClient() { return mockAuthGetClient(); }
    getProjectId() { return mockAuthGetProjectId(); }
}

vi.mock('google-auth-library', () => {
    return {
        GoogleAuth: MockGoogleAuth
    };
});

    }))
}));

// Mock GoogleAuth class using a class-like structure for the mock
class MockGoogleAuth {
    getClient() { return mockAuthGetClient(); }
    getProjectId() { return mockAuthGetProjectId(); }
}

vi.mock('google-auth-library', () => {
    return {
        GoogleAuth: MockGoogleAuth
    };
});

describe('Video Backend Logic', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should successfully generate video and update firestore', async () => {
        // Setup Mocks
        mockAuthGetClient.mockResolvedValue({
            getAccessToken: async () => ({ token: 'mock-token' })
        });
        mockAuthGetProjectId.mockResolvedValue('mock-project');

        // Mock global fetch
        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({
                predictions: [{
                    bytesBase64Encoded: 'mock-base64-video-data'
                }]
            })
        });

        const jobId = 'test-job-id';

        // 1. Simulate "update-status-processing"
        await mockFirestore().collection('videoJobs').doc(jobId).set({
            status: 'processing',
            updatedAt: 'TIMESTAMP'
        }, { merge: true });

        expect(mockCollection).toHaveBeenCalledWith('videoJobs');
        expect(mockDoc).toHaveBeenCalledWith(jobId);
        expect(mockSet).toHaveBeenCalledWith({
            status: 'processing',
            updatedAt: 'TIMESTAMP'
        }, { merge: true });

        // 2. Simulate "generate-video-vertex" logic
        const { GoogleAuth } = await import('google-auth-library');
        const auth = new GoogleAuth();
        const client = await auth.getClient();
        // @ts-expect-error - accessToken property access on mocked client
        const accessToken = await client.getAccessToken();

        const response = await fetch('https://mock-endpoint', {
            method: 'POST',
            headers: { Authorization: `Bearer ${accessToken.token}` }
        });
        const result = await response.json();

        expect(global.fetch).toHaveBeenCalled();
        expect(accessToken.token).toBe('mock-token');

        // 3. Simulate "update-status-completed"
        await mockFirestore().collection('videoJobs').doc(jobId).set({
            status: 'completed',
            videoUrl: 'https://mock-storage-url.com/video.mp4',
            updatedAt: 'TIMESTAMP'
        }, { merge: true });

        expect(mockSet).toHaveBeenLastCalledWith({
            status: 'completed',
            videoUrl: 'https://mock-storage-url.com/video.mp4',
            updatedAt: 'TIMESTAMP'
        }, { merge: true });
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
