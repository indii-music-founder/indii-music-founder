/**
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// 1. Hoisted mocks for dependencies
const mocks = vi.hoisted(() => ({
    httpsCallable: vi.fn(),
    onSnapshot: vi.fn(),
    doc: vi.fn(),
    auth: { currentUser: { uid: 'test-user' } },
    subscriptionService: {
        canPerformAction: vi.fn(),
        getCurrentSubscription: vi.fn()
    },
    useStore: {
        getState: vi.fn(() => ({ currentOrganizationId: 'org-123' }))
    },
    firebaseAI: {
        analyzeImage: vi.fn()
    },
    uuid: vi.fn(() => 'mock-uuid')
}));

// 2. Mock modules
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

// Handle dynamic import used in VideoGenerationService
vi.mock('../firebase', () => ({
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

// Import service AFTER mocks
import { VideoGenerationService } from './VideoGenerationService';

describe('VideoGenerationService (Veo 3.1 Pipeline)', () => {
    let service: VideoGenerationService;

    beforeEach(() => {
        vi.clearAllMocks();
        service = new VideoGenerationService();
        // Default happy path for quota
        mocks.subscriptionService.canPerformAction.mockResolvedValue({ allowed: true });
        mocks.subscriptionService.getCurrentSubscription.mockResolvedValue({ tier: 'pro' });
        // Default happy path for function trigger
        mocks.httpsCallable.mockReturnValue(async () => ({ data: { jobId: 'job-123' } }));
    });

    describe('generateVideo', () => {
        it('should enforce quota limits before triggering job', async () => {
            mocks.subscriptionService.canPerformAction.mockResolvedValue({
                allowed: false,
                reason: 'Quota exceeded'
            });

            await expect(service.generateVideo({ prompt: 'test' }))
                .rejects.toThrow('Quota exceeded: Quota exceeded');
        });

        it('should trigger video generation with correct parameters', async () => {
            const triggerMock = vi.fn().mockResolvedValue({ data: { jobId: 'job-123' } });
            mocks.httpsCallable.mockReturnValue(triggerMock);

            const result = await service.generateVideo({
                prompt: 'A cinematic shot',
                aspectRatio: '16:9',
                resolution: '1920x1080'
            });

            expect(triggerMock).toHaveBeenCalledWith(expect.objectContaining({
                prompt: expect.stringContaining('A cinematic shot'),
                aspectRatio: '16:9',
                jobId: 'mock-uuid',
                orgId: 'org-123'
            }));

            expect(result).toHaveLength(1);
            expect(result[0].id).toBe('mock-uuid');
        });
    });

    describe('waitForJob (Veo Metadata Verification)', () => {
        it('should resolve with Veo 3.1 specific metadata on completion', async () => {
            // Mock onSnapshot to simulate job completion
            mocks.doc.mockReturnValue('doc-ref');
            mocks.onSnapshot.mockImplementation((ref, callback) => {
                // Simulate async update
                setTimeout(() => {
                    callback({
                        exists: () => true,
                        id: 'job-123',
                        data: () => ({
                            status: 'completed',
                            output: {
                                url: 'https://storage.googleapis.com/mock/video.mp4',
                                metadata: {
                                    duration_seconds: 5.0,
                                    fps: 24,
                                    mime_type: 'video/mp4',
                                    resolution: '1280x720' // 720p is typical for preview
                                }
                            }
                        })
                    });
                }, 10);
                return () => { }; // unsubscribe
            });

            const job = await service.waitForJob('job-123');

            expect(job.status).toBe('completed');
            expect(job.output.metadata).toEqual(expect.objectContaining({
                duration_seconds: 5.0,
                fps: 24,
                mime_type: 'video/mp4'
            }));
        });

        it('should handle SafetySettings rejection (Gemini 3 Guardrails)', async () => {
            mocks.doc.mockReturnValue('doc-ref');
            mocks.onSnapshot.mockImplementation((ref, callback) => {
                setTimeout(() => {
                    callback({
                        exists: () => true,
                        id: 'job-123',
                        data: () => ({
                            status: 'failed',
                            error: 'Safety violation: Content blocked by safety filters.'
                        })
                    });
                }, 10);
                return () => { };
            });

            await expect(service.waitForJob('job-123'))
                .rejects.toThrow('Safety violation: Content blocked by safety filters.');
        });
    });

    describe('generateLongFormVideo (Veo 3.1 Streaming)', () => {
        it('should enforce duration-based quota for long-form video', async () => {
            mocks.subscriptionService.canPerformAction.mockResolvedValue({
                allowed: false,
                reason: 'Duration limit exceeded',
                currentUsage: { limit: 10 }
            });

            await expect(service.generateLongFormVideo({
                prompt: 'Long video',
                totalDuration: 60
            })).rejects.toThrow('Duration limit exceeded');

            expect(mocks.subscriptionService.canPerformAction).toHaveBeenCalledWith('generateVideo', 60);
        });

        it('should segment prompt into multiple blocks for long duration (Pro scenario)', async () => {
            // Mock the internal httpsCallable return
            const triggerMock = vi.fn().mockResolvedValue({ data: { success: true } });
            // The service calls 'triggerLongFormVideoJob'
            mocks.httpsCallable.mockImplementation((functionsInstance, name) => {
                if (name === 'triggerLongFormVideoJob') {
                    return triggerMock;
                }
                return vi.fn();
            });

            // 20s duration with 8s block size = 3 blocks (8, 8, 4)
            await service.generateLongFormVideo({
                prompt: 'Epic space battle',
                totalDuration: 20
            });

            expect(triggerMock).toHaveBeenCalledWith(expect.objectContaining({
                jobId: 'long_mock-uuid',
                totalDuration: 20,
                prompts: expect.arrayContaining([
                    expect.stringContaining('Epic space battle (Part 1/3)'),
                    expect.stringContaining('Epic space battle (Part 2/3)'),
                    expect.stringContaining('Epic space battle (Part 3/3)')
                ])
            }));
        });

        it('should generate single block for short duration (Flash scenario)', async () => {
            const triggerMock = vi.fn().mockResolvedValue({ data: { success: true } });
            mocks.httpsCallable.mockImplementation((functionsInstance, name) => {
                if (name === 'triggerLongFormVideoJob') {
                    return triggerMock;
                }
                return vi.fn();
            });

            // 5s duration with 8s block size = 1 block
            await service.generateLongFormVideo({
                prompt: 'Quick reaction',
                totalDuration: 5
            });

            expect(triggerMock).toHaveBeenCalledWith(expect.objectContaining({
                jobId: 'long_mock-uuid',
                prompts: [
                    expect.stringContaining('Quick reaction (Part 1/1)')
                ]
            }));
        });

        it('should trigger backend function with correct payload including startImage', async () => {
            const triggerMock = vi.fn().mockResolvedValue({ data: { success: true } });
            mocks.httpsCallable.mockImplementation((functionsInstance, name) => {
                if (name === 'triggerLongFormVideoJob') {
                    return triggerMock;
                }
                return vi.fn();
            });

            const startImage = 'data:image/png;base64,abc';
            await service.generateLongFormVideo({
                prompt: 'continuation',
                totalDuration: 10,
                firstFrame: startImage,
                aspectRatio: '9:16'
            });

            expect(triggerMock).toHaveBeenCalledWith(expect.objectContaining({
                startImage: startImage,
                aspectRatio: '9:16',
                prompts: expect.any(Array)
            }));
        });
    });
});
