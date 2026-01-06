import { vi, describe, it, expect, beforeEach } from 'vitest';
import { ShowroomService } from './ShowroomService';
import { ImageGeneration } from '@/services/image/ImageGenerationService';
import { VideoGeneration } from '@/services/video/VideoGenerationService';

// Mock dependencies
const mocks = vi.hoisted(() => ({
    addDoc: vi.fn(),
    collection: vi.fn(),
    updateDoc: vi.fn(),
    serverTimestamp: vi.fn(),
    useStore: vi.fn(),
    generateImages: vi.fn(),
    generateVideo: vi.fn(),
    waitForJob: vi.fn(),
    canPerformAction: vi.fn()
}));

// Mock Firebase services
vi.mock('@/services/firebase', () => ({
    db: {},
    auth: { currentUser: { uid: 'test-user' } }, // Mock auth for service checks
    functions: {}
}));

vi.mock('firebase/firestore', () => ({
    addDoc: mocks.addDoc,
    collection: mocks.collection,
    updateDoc: mocks.updateDoc,
    serverTimestamp: mocks.serverTimestamp,
    getFirestore: vi.fn(),
    doc: vi.fn()
}));

vi.mock('@/core/store', () => ({
    useStore: {
        getState: () => ({
            userProfile: { id: 'test-user' }
        })
    }
}));

// Mock Subscription Service to pass quota checks
vi.mock('@/services/subscription/SubscriptionService', () => ({
    subscriptionService: {
        canPerformAction: mocks.canPerformAction
    }
}));

// Mock ImageGenerationService
vi.mock('@/services/image/ImageGenerationService', () => ({
    ImageGeneration: {
        generateImages: mocks.generateImages
    }
}));

// Mock VideoGenerationService
vi.mock('@/services/video/VideoGenerationService', () => ({
    VideoGeneration: {
        generateVideo: mocks.generateVideo,
        waitForJob: mocks.waitForJob
    }
}));

describe('ShowroomService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Setup default mocks
        mocks.addDoc.mockResolvedValue({ id: 'doc-1' });
        mocks.canPerformAction.mockResolvedValue({ allowed: true });
    });

    it('should generate a mockup and save to Firestore', async () => {
        const mockAsset = 'data:image/png;base64,mockdata';
        const mockPrompt = 'A cozy living room';
        const expectedUrl = 'https://generated.image/url';

        // Mock ImageGeneration result
        mocks.generateImages.mockResolvedValue([{
            id: 'img-1',
            url: expectedUrl,
            prompt: mockPrompt
        }]);

        const url = await ShowroomService.generateMockup(mockAsset, 'T-Shirt', mockPrompt);

        // Verify ImageGeneration was called
        expect(mocks.generateImages).toHaveBeenCalledWith(expect.objectContaining({
            prompt: expect.stringContaining(mockPrompt),
            count: 1
        }));

        // Verify Firestore persistence (tracking)
        // Note: The first argument to addDoc is the collection ref.
        // Since we mock collection() to return undefined (implicitly), we expect undefined here.
        // We focus on the second argument which is the data.
        expect(mocks.addDoc).toHaveBeenCalledWith(
            undefined,
            expect.objectContaining({
                type: 'T-Shirt',
                scene: mockPrompt,
                status: 'processing'
            })
        );
        expect(mocks.updateDoc).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({
                resultUrl: expectedUrl,
                status: 'completed'
            })
        );

        expect(url).toBe(expectedUrl);
    });

    it('should generate a video and save to Firestore', async () => {
        const mockImage = 'https://mockup.url';
        const mockPrompt = 'Camera pans around';
        const expectedVideoUrl = 'https://generated.video/url.mp4';
        const jobId = 'job-123';

        // Mock VideoGeneration result
        mocks.generateVideo.mockResolvedValue([{
            id: jobId,
            url: '',
            prompt: mockPrompt
        }]);

        // Mock WaitForJob result
        mocks.waitForJob.mockResolvedValue({
            id: jobId,
            status: 'completed',
            outputUrl: expectedVideoUrl
        });

        const url = await ShowroomService.generateVideo(mockImage, mockPrompt);

        // Verify VideoGeneration was called
        expect(mocks.generateVideo).toHaveBeenCalledWith(expect.objectContaining({
            prompt: mockPrompt,
            firstFrame: mockImage
        }));

        // Verify WaitForJob was called
        expect(mocks.waitForJob).toHaveBeenCalledWith(jobId);

        // Verify Firestore persistence
        expect(mocks.addDoc).toHaveBeenCalled();
        expect(mocks.updateDoc).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({
                resultUrl: expectedVideoUrl,
                status: 'completed',
                videoJobId: jobId
            })
        );

        expect(url).toBe(expectedVideoUrl);
    });
});
