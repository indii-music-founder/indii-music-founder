/**
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { VideoGenerationService } from './VideoGenerationService';

// Mock dependencies
const mocks = vi.hoisted(() => ({
    httpsCallable: vi.fn(),
    onSnapshot: vi.fn(),
    doc: vi.fn(),
    auth: { currentUser: { uid: 'lens-tester' } },
    subscriptionService: {
        canPerformAction: vi.fn(),
        getCurrentSubscription: vi.fn()
    },
    useStore: {
        getState: vi.fn(() => ({ currentOrganizationId: 'org-lens' }))
    },
    firebaseAI: {
        analyzeImage: vi.fn()
    },
    uuid: vi.fn(() => 'job-uuid-123')
}));

vi.mock('firebase/functions', () => ({
    httpsCallable: mocks.httpsCallable,
    getFunctions: vi.fn()
}));

vi.mock('firebase/firestore', () => ({
    doc: mocks.doc,
    onSnapshot: mocks.onSnapshot,
    getFirestore: vi.fn()
}));

vi.mock('@/services/firebase', () => ({
    auth: mocks.auth,
    db: {},
    functions: {}
}));

vi.mock('../firebase', () => ({ // Handle relative import in service
    functions: {},
    db: {},
    auth: mocks.auth
}));

vi.mock('@/services/subscription/SubscriptionService', () => ({
    subscriptionService: mocks.subscriptionService
}));

vi.mock('@/core/store', () => ({
    useStore: mocks.useStore
}));

vi.mock('../ai/FirebaseAIService', () => ({
    firebaseAI: mocks.firebaseAI
}));

vi.mock('uuid', () => ({
    v4: mocks.uuid
}));

describe('Veo 3.1 Integration Pipeline', () => {
    let service: VideoGenerationService;

    beforeEach(() => {
        vi.clearAllMocks();
        service = new VideoGenerationService();
        mocks.subscriptionService.canPerformAction.mockResolvedValue({ allowed: true });
        mocks.httpsCallable.mockReturnValue(async () => ({ data: { jobId: 'job-uuid-123' } }));
    });

    it('Prompt Enhancer: Should inject temporal analysis into Veo prompt when firstFrame is present', async () => {
        // Arrange
        const userPrompt = "Cyberpunk city street";
        const mockAnalysis = "Camera moves forward into the neon mist.";
        mocks.firebaseAI.analyzeImage.mockResolvedValue(mockAnalysis);

        const triggerMock = vi.fn().mockResolvedValue({ data: { jobId: 'job-uuid-123' } });
        mocks.httpsCallable.mockReturnValue(triggerMock);

        // Act
        await service.generateVideo({
            prompt: userPrompt,
            firstFrame: 'data:image/png;base64,fakeimage',
            timeOffset: 2
        });

        // Assert
        expect(mocks.firebaseAI.analyzeImage).toHaveBeenCalledWith(
            expect.stringContaining('Predict exactly what happens'),
            'data:image/png;base64,fakeimage'
        );

        // This is the critical assertion that verifies the "Prompt Enhancer" result is actually used
        expect(triggerMock).toHaveBeenCalledWith(expect.objectContaining({
            prompt: expect.stringContaining(mockAnalysis)
        }));
    });

    it('Veo 3.1 Metadata Contract: Should validate completed job output', async () => {
        // Arrange
        mocks.doc.mockReturnValue('doc-ref');
        mocks.onSnapshot.mockImplementation((ref, callback) => {
            // Simulate async update - "Flash" response speed logic could be tested here implicitly by fast timeout
            setTimeout(() => {
                callback({
                    exists: () => true,
                    id: 'job-uuid-123',
                    data: () => ({
                        status: 'completed',
                        output: {
                            url: 'https://mock.generated/video.mp4',
                            metadata: {
                                duration_seconds: 4.0,
                                fps: 30,
                                mime_type: 'video/mp4'
                            }
                        }
                    })
                });
            }, 10);
            return () => {};
        });

        // Act
        const job = await service.waitForJob('job-uuid-123');

        // Assert
        expect(job.output.metadata).toEqual({
            duration_seconds: 4.0,
            fps: 30,
            mime_type: 'video/mp4'
        });
    });
});
