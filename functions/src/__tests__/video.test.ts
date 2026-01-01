import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as admin from 'firebase-admin';
import { generateVideoLogic } from '../lib/video';

// Hoist mocks to avoid ReferenceError
const mocks = vi.hoisted(() => ({
    firestore: {
        collection: vi.fn(),
        doc: vi.fn(),
        set: vi.fn(),
        get: vi.fn(),
        FieldValue: {
            serverTimestamp: vi.fn(() => 'TIMESTAMP')
        }
    },
    storage: {
        bucket: vi.fn(),
        file: vi.fn(),
        save: vi.fn(),
        getSignedUrl: vi.fn(() => Promise.resolve(['https://mock-storage-url.com/video.mp4'])),
        publicUrl: vi.fn(() => 'https://mock-storage-url.com/video.mp4')
    },
    auth: {
        getClient: vi.fn(),
        getProjectId: vi.fn()
    }
}));


// Mock Firebase Admin
vi.mock('firebase-admin', () => ({
    initializeApp: vi.fn(),
    firestore: Object.assign(
        vi.fn(() => ({
            collection: mocks.firestore.collection
        })),
        { FieldValue: mocks.firestore.FieldValue }
    ),
    storage: vi.fn(() => ({
        bucket: mocks.storage.bucket
    })),
    auth: vi.fn()
}));

// Connect mocks
mocks.firestore.collection.mockReturnValue({ doc: mocks.firestore.doc });
mocks.firestore.doc.mockReturnValue({ set: mocks.firestore.set, get: mocks.firestore.get });
mocks.storage.bucket.mockReturnValue({ file: mocks.storage.file });
mocks.storage.file.mockReturnValue({
    save: mocks.storage.save,
    getSignedUrl: mocks.storage.getSignedUrl,
    publicUrl: mocks.storage.publicUrl
});


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
    getClient() { return mocks.auth.getClient(); }
    getProjectId() { return mocks.auth.getProjectId(); }
}

vi.mock('google-auth-library', () => {
    return {
        GoogleAuth: class MockGoogleAuth {
            getClient() { return mocks.auth.getClient(); }
            getProjectId() { return mocks.auth.getProjectId(); }
        }
    };
});

describe('Video Backend', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Reset default returns
        mocks.firestore.collection.mockReturnValue({ doc: mocks.firestore.doc });
        mocks.firestore.doc.mockReturnValue({ set: mocks.firestore.set, get: mocks.firestore.get });
        mocks.storage.bucket.mockReturnValue({ file: mocks.storage.file });
        mocks.storage.file.mockReturnValue({
            save: mocks.storage.save,
            getSignedUrl: mocks.storage.getSignedUrl,
            publicUrl: mocks.storage.publicUrl
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
        mocks.auth.getClient.mockResolvedValue({
            getAccessToken: async () => ({ token: 'mock-token' })
        });
        mocks.auth.getProjectId.mockResolvedValue('mock-project');

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
        expect(mocks.firestore.collection).toHaveBeenCalledWith('videoJobs');
        expect(mocks.firestore.doc).toHaveBeenCalledWith('test-job-id');

        // Verify status updates
        // Processing
        expect(mocks.firestore.set).toHaveBeenCalledWith({
            status: 'processing',
            updatedAt: 'TIMESTAMP'
        }, { merge: true });

        // Completed
        expect(mocks.firestore.set).toHaveBeenCalledWith({
            status: 'completed',
            videoUrl: 'https://mock-storage-url.com/video.mp4',
            progress: 100,
            updatedAt: 'TIMESTAMP'
        }, { merge: true });

        // 3. Check Google Auth and Fetch calls
        expect(mocks.auth.getClient).toHaveBeenCalled();
        expect(global.fetch).toHaveBeenCalled();
    });
});
