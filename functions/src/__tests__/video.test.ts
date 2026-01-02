import { describe, it, expect, vi, beforeEach } from 'vitest';

// Hoist mocks using vi.hoisted to ensure they are available for vi.mock
const mocks = vi.hoisted(() => {
    const mockSet = vi.fn();
    const mockDoc = vi.fn(() => ({ set: mockSet }));
    const mockCollection = vi.fn(() => ({ doc: mockDoc }));
    const mockFirestore = vi.fn(() => ({ collection: mockCollection }));
    const mockFieldValue = { serverTimestamp: vi.fn(() => 'TIMESTAMP') };
    const mockAuthGetClient = vi.fn();
    const mockAuthGetProjectId = vi.fn();

    // Define MockGoogleAuth inside the factory to avoid hoisting issues
    class MockGoogleAuth {
        getClient() { return mockAuthGetClient(); }
        getProjectId() { return mockAuthGetProjectId(); }
    }

    return {
        mockSet,
        mockDoc,
        mockCollection,
        mockFirestore,
        mockFieldValue,
        mockAuthGetClient,
        mockAuthGetProjectId,
        MockGoogleAuth
    };
});

// Hoist mocks to avoid reference errors
const mocks = vi.hoisted(() => {
    const mockSet = vi.fn();
    const mockDoc = vi.fn(() => ({ set: mockSet }));
    const mockCollection = vi.fn(() => ({ doc: mockDoc }));
    const mockFirestore = vi.fn(() => ({ collection: mockCollection }));
    const mockFieldValue = { serverTimestamp: vi.fn(() => 'TIMESTAMP') };
    const mockStorage = vi.fn(() => ({
        bucket: () => ({
            file: () => ({
                save: vi.fn(),
                getSignedUrl: vi.fn().mockResolvedValue(['https://signed-url.com/video.mp4'])
            })
        })
    }));
    const mockAuthGetClient = vi.fn();
    const mockAuthGetProjectId = vi.fn();

    return {
        mockSet,
        mockDoc,
        mockCollection,
        mockFirestore,
        mockFieldValue,
        mockStorage,
        mockAuthGetClient,
        mockAuthGetProjectId
    }
});

// Mock Firebase Admin
vi.mock('firebase-admin', () => ({
    initializeApp: vi.fn(),
    firestore: Object.assign(mocks.mockFirestore, { FieldValue: mocks.mockFieldValue }),
    storage: mocks.mockStorage,
    storage: vi.fn(() => ({
        bucket: () => ({
            file: () => ({
                save: vi.fn(),
                makePublic: vi.fn(),
                publicUrl: () => 'https://mock-storage-url.com/video.mp4',
                getSignedUrl: vi.fn().mockResolvedValue(['https://signed-url.com/video.mp4'])
            })
        })
    })),
    auth: vi.fn()
}));

// Mock Inngest
vi.mock('inngest', () => {
    return {
        Inngest: vi.fn().mockImplementation(() => ({
            createFunction: vi.fn(),
            send: vi.fn()
        }))
    };
});

// Mock firebase-functions
vi.mock('firebase-functions/v1', () => ({
    runWith: vi.fn().mockReturnThis(),
    https: {
        onCall: vi.fn(),
        onRequest: vi.fn()
    }
}));

vi.mock('firebase-functions/params', () => ({
    defineSecret: vi.fn(() => ({ value: () => 'secret' }))
}));

vi.mock('@google-cloud/vertexai', () => ({
    VertexAI: vi.fn()
}));

// Mock GoogleAuth class using a class-like structure for the mock
class MockGoogleAuth {
    getClient() { return mocks.mockAuthGetClient(); }
    getProjectId() { return mocks.mockAuthGetProjectId(); }
}

vi.mock('google-auth-library', () => {
    return {
        GoogleAuth: MockGoogleAuth
    };
});

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
vi.mock('google-auth-library', () => {
    return {
        GoogleAuth: mocks.MockGoogleAuth
    };
});

// Import after mocks are set up
import * as videoLib from '../lib/video';

describe('Video Backend Logic', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should successfully generate video and update firestore', async () => {
        // Import logic
        const { generateVideoLogic } = await import('../lib/video');

    it('should successfully generate video and update firestore (Unit Test for Lib)', async () => {
        // Setup Mocks
        mocks.mockAuthGetClient.mockResolvedValue({
            getAccessToken: async () => ({ token: 'mock-token' })
        });
        mocks.mockAuthGetProjectId.mockResolvedValue('mock-project');

        // Mock global fetch
        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({
                predictions: [{
                    bytesBase64Encoded: 'mock-base64-video-data'
                }]
            })
        });

        // Mock Step Context
        const mockStep = {
            run: vi.fn(async (name, callback) => await callback())
        };

        const mockEvent = {
            data: {
                jobId: 'test-job-id',
                prompt: 'test prompt',
                userId: 'test-user',
                options: { duration: '5s' }
            }
        };

        // Execute Logic
        await generateVideoLogic({ event: mockEvent, step: mockStep });

        // Assertions

        // 1. Status: Processing
        expect(mocks.mockSet).toHaveBeenCalledWith({
            status: 'processing',
            updatedAt: 'TIMESTAMP'
        }, { merge: true });

        // 2. Vertex AI Call
        expect(global.fetch).toHaveBeenCalledWith(
            expect.stringContaining('aiplatform.googleapis.com'),
            expect.objectContaining({
                method: 'POST',
                headers: expect.objectContaining({
                    'Authorization': 'Bearer mock-token'
                })
            })
        );

        // 3. Status: Completed
        // The logic sets videoUrl to the result of the second step.
        // The second step returns the result of getSignedUrl which is mocked to return the array.
        // Wait, getSignedUrl returns [url]. The logic destructures it: const [signedUrl] = ...
        // So the return value is the string.

        expect(mocks.mockSet).toHaveBeenLastCalledWith({
            status: 'completed',
            videoUrl: 'https://signed-url.com/video.mp4',
            progress: 100,
            updatedAt: 'TIMESTAMP'
        }, { merge: true });
        const input = {
            jobId: 'test-job-id',
            userId: 'user-123',
            prompt: 'test prompt',
            orgId: 'org-123',
            options: {
                duration: '5s' as const,
                aspectRatio: '16:9' as const
            }
        };

        const updateStatusMock = vi.fn();

        const videoUrl = await videoLib.generateVideoWithVeo(input, updateStatusMock);

        expect(updateStatusMock).toHaveBeenCalledWith('processing');
        expect(global.fetch).toHaveBeenCalled();
        expect(videoUrl).toBe('https://signed-url.com/video.mp4');
        expect(updateStatusMock).toHaveBeenLastCalledWith('completed', { videoUrl: 'https://signed-url.com/video.mp4', progress: 100 });
    });
});
