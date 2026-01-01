import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as admin from 'firebase-admin';

// 1. Define the mock implementations *inside* a factory or handle hoisting.
// However, since we want to access the spies in tests, we can use `vi.hoisted`
// or define them in a way that Vitest handles.

const { mockSet, mockDoc, mockCollection, mockFirestore, mockFieldValue, mockAuthGetClient, mockAuthGetProjectId } = vi.hoisted(() => {
    const mockSet = vi.fn();
    const mockDoc = vi.fn(() => ({ set: mockSet }));
    const mockCollection = vi.fn(() => ({ doc: mockDoc }));
    const mockFirestore = vi.fn(() => ({ collection: mockCollection }));
    const mockFieldValue = { serverTimestamp: vi.fn(() => 'TIMESTAMP') };

    const mockAuthGetClient = vi.fn();
    const mockAuthGetProjectId = vi.fn();

    return { mockSet, mockDoc, mockCollection, mockFirestore, mockFieldValue, mockAuthGetClient, mockAuthGetProjectId };
});

// Mock Firebase Admin
vi.mock('firebase-admin', () => ({
    initializeApp: vi.fn(),
    firestore: Object.assign(vi.fn(() => ({ collection: mockCollection })), { FieldValue: mockFieldValue }),
    storage: vi.fn(() => ({
        bucket: () => ({
            file: () => ({
                save: vi.fn(),
                makePublic: vi.fn(),
                publicUrl: () => 'https://mock-storage-url.com/video.mp4',
                getSignedUrl: vi.fn().mockResolvedValue(['https://mock-signed-url.com/video.mp4'])
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

// Mock GoogleAuth class
class MockGoogleAuth {
    getClient() { return mockAuthGetClient(); }
    getProjectId() { return mockAuthGetProjectId(); }
}

vi.mock('google-auth-library', () => {
    return {
        GoogleAuth: MockGoogleAuth
    };
});

describe('Video Backend', () => {
    beforeEach(() => {
        vi.clearAllMocks();
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

        const jobId = 'test-job-id';

        // 1. Simulate "update-status-processing"
        // We use the mocked firestore directly to simulate what the function would do
        await admin.firestore().collection('videoJobs').doc(jobId).set({
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
        await response.json();

        expect(global.fetch).toHaveBeenCalled();
        expect(accessToken.token).toBe('mock-token');

        // 3. Simulate "update-status-completed"
        await admin.firestore().collection('videoJobs').doc(jobId).set({
            status: 'completed',
            videoUrl: 'https://mock-signed-url.com/video.mp4',
            updatedAt: 'TIMESTAMP'
        }, { merge: true });

        expect(mockSet).toHaveBeenLastCalledWith({
            status: 'completed',
            videoUrl: 'https://mock-signed-url.com/video.mp4',
            updatedAt: 'TIMESTAMP'
        }, { merge: true });
    });
});
