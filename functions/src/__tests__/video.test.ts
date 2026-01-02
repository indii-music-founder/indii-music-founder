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

// Mock Firebase Admin
vi.mock('firebase-admin', () => ({
    initializeApp: vi.fn(),
    firestore: Object.assign(mocks.mockFirestore, { FieldValue: mocks.mockFieldValue }),
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
