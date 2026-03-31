import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { VideoGeneration } from '../VideoGenerationService';
import { firebaseAI } from '../../ai/FirebaseAIService';
import { onSnapshot } from 'firebase/firestore';

// Mock dependencies
vi.mock('../../ai/FirebaseAIService', () => ({
    serverTimestamp: vi.fn(),
    firebaseAI: {
        analyzeImage: vi.fn().mockResolvedValue("Mocked temporal analysis result."),
        generateVideo: vi.fn().mockResolvedValue('https://storage.googleapis.com/mock-video.mp4'),
    }
}));

vi.mock('@/services/firebase', () => ({
    serverTimestamp: vi.fn(),
    auth: {
        currentUser: { uid: 'lens-verifier' }
    },
    db: {},
    functions: {},
    functionsWest1: {},
    remoteConfig: { defaultConfig: {} },
    storage: {},
    getFirebaseAI: vi.fn(() => ({})),
    app: { options: {} },
    appCheck: { getToken: vi.fn(() => Promise.resolve({ token: 'mock-token' })) },
    messaging: { getToken: vi.fn() }
}));

// Mock SubscriptionService to always allow
vi.mock('@/services/subscription/SubscriptionService', () => ({
    serverTimestamp: vi.fn(),
    subscriptionService: {
        canPerformAction: vi.fn().mockResolvedValue({ allowed: true, currentUsage: 0, maxAllowed: 100 }),
        getCurrentSubscription: vi.fn().mockResolvedValue({ tier: Promise.resolve('pro') })
    }
}));

vi.mock('firebase/firestore', async (importOriginal) => {
    const actual = await importOriginal<typeof import('firebase/firestore')>();
    return {
        ...actual,
        serverTimestamp: vi.fn(),
        doc: vi.fn(() => ({ id: 'mock-doc-ref', path: 'videoJobs/mock-doc-ref' })),
        setDoc: vi.fn().mockResolvedValue(undefined),
        updateDoc: vi.fn().mockResolvedValue(undefined),
        onSnapshot: vi.fn(),
        Timestamp: {
            now: vi.fn(() => ({ toDate: () => new Date() })),
        },
    };
});

vi.mock('@/services/persistence/MetadataPersistenceService', () => ({
    metadataPersistenceService: {
        save: vi.fn().mockResolvedValue(undefined),
    }
}));

vi.mock('@/services/ai/utils/InputSanitizer', () => ({
    InputSanitizer: {
        sanitize: vi.fn((text: string) => text),
    }
}));

describe('🎥 Lens: Veo 3.1 & Gemini 3 Integration Verification', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    describe('Veo 3.1 Metadata Integrity', () => {
        it('should strictly enforce Veo 3.1 metadata contract', async () => {
            const mockJobId = 'veo-integrity-check';
            const mockVeoMetadata = {
                status: 'completed',
                url: 'https://storage.googleapis.com/veo-video.mp4', // Mocked Signed URL
                metadata: {
                    duration_seconds: 5.0,
                    fps: 24, // Veo standard
                    mime_type: 'video/mp4',
                    resolution: '1280x720'
                }
            };

            vi.mocked(onSnapshot).mockImplementation(((ref: unknown, callback: (snapshot: unknown) => void) => {
                // Simulate "Processing" -> "Success"
                callback({
                    exists: () => true,
                    id: mockJobId,
                    data: () => ({ status: 'processing' })
                } as unknown as import('firebase/firestore').DocumentSnapshot);

                setTimeout(() => {
                    callback({
                        exists: () => true,
                        id: mockJobId,
                        data: () => mockVeoMetadata
                    } as unknown as import('firebase/firestore').DocumentSnapshot);
                }, 1000);

                return vi.fn();
            }) as unknown as typeof import('firebase/firestore').onSnapshot);

            const jobPromise = VideoGeneration.waitForJob(mockJobId);

            // Advance time to trigger completion
            vi.advanceTimersByTime(1100);

            const job = await jobPromise;

            expect(job.status).toBe('completed');
            expect(job.metadata!.fps).toBe(24);
            expect(job.metadata!.mime_type).toBe('video/mp4');
            expect(job.metadata!.duration_seconds).toBe(5.0);
            // Verify URL is present (Lens philosophy: A 404 is a critical failure, here we ensure we get a URL)
            expect(job.url).toBeDefined();
        });
    });

    describe('Flash vs Pro Generation Speed', () => {
        it('should handle Flash generation (< 2s)', async () => {
            const mockJobId = 'flash-job';

            vi.mocked(onSnapshot).mockImplementation(((ref: unknown, callback: (snapshot: unknown) => void) => {
                setTimeout(() => {
                    callback({
                        exists: () => true,
                        id: mockJobId,
                        data: () => ({ status: 'completed', url: 'http://fast.url' })
                    } as unknown as import('firebase/firestore').DocumentSnapshot);
                }, 500); // 0.5s
                return vi.fn();
            }) as unknown as typeof import('firebase/firestore').onSnapshot);

            const jobPromise = VideoGeneration.waitForJob(mockJobId, 2000); // 2s timeout

            vi.advanceTimersByTime(510);

            await expect(jobPromise).resolves.toHaveProperty('status', 'completed');
        });

        it('should handle Pro generation (< 30s) and timeout if too slow', async () => {
            const mockJobId = 'pro-job-slow';

            vi.mocked(onSnapshot).mockImplementation(((ref: unknown, callback: (snapshot: unknown) => void) => {
                callback({
                    exists: () => true,
                    id: mockJobId,
                    data: () => ({ status: 'processing' })
                } as unknown as import('firebase/firestore').DocumentSnapshot);
                return vi.fn();
            }) as unknown as typeof import('firebase/firestore').onSnapshot);

            const jobPromise = VideoGeneration.waitForJob(mockJobId, 30000); // 30s timeout

            // Advance past 30s
            vi.advanceTimersByTime(30001);

            await expect(jobPromise).rejects.toThrow(/Video generation timeout/);
        });
    });

    describe('SafetySettings Handshake', () => {
        it('should gracefully handle Gemini/Veo safety blocks', async () => {
            const mockJobId = 'unsafe-content';

            vi.mocked(onSnapshot).mockImplementation(((ref: unknown, callback: (snapshot: unknown) => void) => {
                setTimeout(() => {
                    callback({
                        exists: () => true,
                        id: mockJobId,
                        data: () => ({
                            serverTimestamp: vi.fn(),
                            status: 'failed',
                            error: 'Safety violation: Harassment filter triggered.'
                        })
                    } as unknown as import('firebase/firestore').DocumentSnapshot);
                }, 100);
                return vi.fn();
            }) as unknown as typeof import('firebase/firestore').onSnapshot);

            const jobPromise = VideoGeneration.waitForJob(mockJobId);
            vi.advanceTimersByTime(110);

            await expect(jobPromise).rejects.toThrow(/Safety violation/);
        });
    });

    describe('Prompt Enhancer Flow', () => {
        it('should inject camera and motion parameters into the prompt', async () => {
            // Use real timers for generateVideo (no onSnapshot-based job waiting)
            vi.useRealTimers();

            await VideoGeneration.generateVideo({
                prompt: 'A Cyberpunk city',
                cameraMovement: 'Pan Right',
                motionStrength: 0.9,
                fps: 24
            });

            // Inspect the call to firebaseAI.generateVideo (direct SDK path)
            const callArgs = vi!.mocked(firebaseAI.generateVideo).mock.calls[0]![0];

            // Verify camera movement enrichment
            expect(callArgs.prompt).toContain('cinematic pan right camera movement');

            // Verify motion strength enrichment
            expect(callArgs.prompt).toContain('high dynamic motion');
        });
    });
});
