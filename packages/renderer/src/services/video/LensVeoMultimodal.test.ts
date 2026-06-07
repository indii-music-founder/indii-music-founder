/**
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { VideoGenerationService } from './VideoGenerationService';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { CreativeStorageService } from '../creative/CreativeStorageService';

// Mocks
const mocks = vi.hoisted(() => ({
    generateVideoV3: vi.fn(),
    canPerformAction: vi.fn(),
    uploadReferenceMedia: vi.fn(),
    currentUser: { uid: 'lens-user' },
    getState: vi.fn(() => ({ currentOrganizationId: 'org-lens' }))
}));

vi.mock('@/services/firebase', () => ({
    auth: { currentUser: mocks.currentUser },
    functions: {},
    functionsWest1: {},
    db: {},
    remoteConfig: { defaultConfig: {} },
    storage: { app: { options: { storageBucket: 'mock-bucket.appspot.com' } } },
    getFirebaseAI: vi.fn(() => ({})),
    app: { options: {} },
    appCheck: { getToken: vi.fn(() => Promise.resolve({ token: 'mock-token' })) },
    messaging: { getToken: vi.fn() }
}));

vi.mock('../creative/CreativeStorageService', () => ({
    CreativeStorageService: {
        uploadReferenceMedia: mocks.uploadReferenceMedia
    }
}));

vi.mock('@/services/subscription/SubscriptionService', () => ({
    subscriptionService: {
        canPerformAction: mocks.canPerformAction
    }
}));

vi.mock('@/core/store', () => ({
    useStore: {
        getState: mocks.getState
    }
}));

vi.mock('firebase/functions', () => ({
    httpsCallable: (_functions: any, name: string) => {
        if (name === 'generateVideoV3') {
            return mocks.generateVideoV3;
        }
        return vi.fn();
    },
    getFunctions: vi.fn()
}));

vi.mock('uuid', () => ({
    v4: () => 'job-lens-multimodal'
}));

describe('Lens 🎥 - Gemini 3 Native Multimodal Pipeline (Thin Client)', { timeout: 30000 }, () => {
    let service: VideoGenerationService;

    beforeEach(() => {
        vi.clearAllMocks();
        service = new VideoGenerationService();
        mocks.canPerformAction.mockResolvedValue({ allowed: true });
        mocks.generateVideoV3.mockResolvedValue({ data: { jobId: 'job-lens-multimodal' } });
        mocks.uploadReferenceMedia.mockResolvedValue('gs://mock-bucket.appspot.com/creative/lens-user/123_mock-uuid.jpg');
    });

    it('should upload reference media and pass firstFrameUri to the backend via generateVideoV3', async () => {
        // Arrange
        const userPrompt = "A cybernetic cat jumping";
        const firstFrame = "data:image/png;base64,mock";

        // Act
        await service.generateVideo({
            prompt: userPrompt,
            firstFrame: firstFrame,
            timeOffset: 2
        });

        // Assert
        // 1. Verify storage upload was called
        expect(mocks.uploadReferenceMedia).toHaveBeenCalledWith(
            mocks.currentUser.uid,
            firstFrame,
            'image'
        );

        // 2. Verify backend was called with the uploaded URI
        expect(mocks.generateVideoV3).toHaveBeenCalledWith(expect.objectContaining({
            prompt: expect.stringContaining(userPrompt),
            firstFrameUri: 'gs://mock-bucket.appspot.com/creative/lens-user/123_mock-uuid.jpg'
        }));
    });

    it('should bypass reference media upload if no frame is provided', async () => {
        // Arrange
        const userPrompt = "Pure text generation";

        // Act
        await service.generateVideo({
            prompt: userPrompt
        });

        // Assert
        expect(mocks.uploadReferenceMedia).not.toHaveBeenCalled();
        expect(mocks.generateVideoV3).toHaveBeenCalledWith(expect.objectContaining({
            prompt: expect.stringContaining(userPrompt)
        }));
    });
});
