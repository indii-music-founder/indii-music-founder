import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as admin from 'firebase-admin';
import { generateVideoLogic } from '../lib/video';

// Hoist mocks to avoid ReferenceError
const { mockSet, mockDoc, mockCollection, mockFirestore, mockFieldValue, mockAuthGetClient, mockAuthGetProjectId, mockStorageBucket, mockFile, mockSave, mockGetSignedUrl, mockPublicUrl } = vi.hoisted(() => {
    const mockSet = vi.fn();
    const mockDoc = vi.fn(() => ({ set: mockSet, get: vi.fn() }));
    const mockCollection = vi.fn(() => ({ doc: mockDoc }));
    const mockFirestore = vi.fn(() => ({ collection: mockCollection }));
    const mockFieldValue = { serverTimestamp: vi.fn(() => 'TIMESTAMP') };

    const mockAuthGetClient = vi.fn();
    const mockAuthGetProjectId = vi.fn();

    const mockSave = vi.fn();
    const mockGetSignedUrl = vi.fn(() => Promise.resolve(['https://mock-storage-url.com/video.mp4']));
    const mockPublicUrl = vi.fn(() => 'https://mock-storage-url.com/video.mp4');
    const mockFile = vi.fn(() => ({
        save: mockSave,
        getSignedUrl: mockGetSignedUrl,
        publicUrl: mockPublicUrl
    }));
    const mockStorageBucket = vi.fn(() => ({ file: mockFile }));

    return {
        mockSet, mockDoc, mockCollection, mockFirestore, mockFieldValue,
        mockAuthGetClient, mockAuthGetProjectId,
        mockStorageBucket, mockFile, mockSave, mockGetSignedUrl, mockPublicUrl
    };
});

// Mock Firebase Admin
vi.mock('firebase-admin', () => ({
    initializeApp: vi.fn(),
    firestore: Object.assign(
        vi.fn(() => ({
            collection: mockCollection
        })),
        { FieldValue: mockFieldValue }
    ),
    storage: vi.fn(() => ({
        bucket: mockStorageBucket
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

// Mock GoogleAuth class
class MockGoogleAuth {
    getClient() { return mockAuthGetClient(); }
    getProjectId() { return mockAuthGetProjectId(); }
}

vi.mock('google-auth-library', () => {
    return {
        GoogleAuth: class MockGoogleAuth {
            getClient() { return mockAuthGetClient(); }
            getProjectId() { return mockAuthGetProjectId(); }
        }
    };
});

describe('Video Backend', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Reset default returns
        mockCollection.mockReturnValue({ doc: mockDoc });
        mockDoc.mockReturnValue({ set: mockSet, get: vi.fn() });
        mockStorageBucket.mockReturnValue({ file: mockFile });
        mockFile.mockReturnValue({
            save: mockSave,
            getSignedUrl: mockGetSignedUrl,
            publicUrl: mockPublicUrl
        });
    });

    it('should be testable', () => {
        expect(true).toBe(true);
    });

    it('should initialize firebase admin when module loads', async () => {
        // Dynamic import to trigger execution
        await import('../index');
        expect(admin.initializeApp).toHaveBeenCalled();
    });

    it('should successfully generate video and update firestore (Simulated)', async () => {
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

        // Mock step.run to execute the callback immediately
        const mockStep = {
            run: vi.fn(async (name, callback) => {
                return await callback();
            })
        };

        const event = {
            data: {
                jobId: 'test-job-id',
                prompt: 'test prompt',
                userId: 'test-user',
                options: {}
            }
        };

        // Invoke the logic directly
        const result = await generateVideoLogic({ event, step: mockStep });

        // Assertions
        // 1. Check if video generation succeeded
        expect(result).toEqual({ success: true, videoUrl: 'https://mock-storage-url.com/video.mp4' });

        // 2. Check if Firestore was updated correctly
        expect(mockCollection).toHaveBeenCalledWith('videoJobs');
        expect(mockDoc).toHaveBeenCalledWith('test-job-id');

        // Verify status updates
        // Processing
        expect(mockSet).toHaveBeenCalledWith({
            status: 'processing',
            updatedAt: 'TIMESTAMP'
        }, { merge: true });

        // Completed
        expect(mockSet).toHaveBeenCalledWith({
            status: 'completed',
            videoUrl: 'https://mock-storage-url.com/video.mp4',
            progress: 100,
            updatedAt: 'TIMESTAMP'
        }, { merge: true });

        // 3. Check Google Auth and Fetch calls
        expect(mockAuthGetClient).toHaveBeenCalled();
        expect(global.fetch).toHaveBeenCalled();
    });
});
