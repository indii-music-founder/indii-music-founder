
/**
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { VideoGenerationService } from './VideoGenerationService';

// Hoisted mocks must be defined before imports
const mocks = vi.hoisted(() => ({
    serverTimestamp: vi.fn(),
    analyzeImage: vi.fn(),
    canPerformAction: vi.fn(),
    currentUser: { uid: 'test-user-lens' },
    triggerVideoJob: vi.fn(),
    useStore: {
        getState: vi.fn(() => ({
            serverTimestamp: vi.fn(), currentOrganizationId: 'org-lens'
        }))
    },
    doc: vi.fn(),
    onSnapshot: vi.fn()
}));

// Mock modules
vi.mock('../ai/FirebaseAIService', () => ({
    serverTimestamp: vi.fn(),
    firebaseAI: {
        analyzeImage: mocks.analyzeImage
    }
}));

vi.mock('@/services/subscription/SubscriptionService', () => ({
    serverTimestamp: vi.fn(),
    subscriptionService: {
        canPerformAction: mocks.canPerformAction
    }
}));

vi.mock('@/services/firebase', () => ({
    serverTimestamp: vi.fn(),
    auth: { currentUser: mocks.currentUser },
    functions: {},
    db: {},
    remoteConfig: { defaultConfig: {} },
    storage: {},
    functionsWest1: { region: vi.fn(() => ({ httpsCallable: vi.fn() })) },
    getFirebaseAI: vi.fn(() => ({})),
    app: { options: {} },
    appCheck: { getToken: vi.fn(() => Promise.resolve({ token: 'mock-token' })) },
    messaging: { getToken: vi.fn() }
}));

vi.mock('firebase/firestore', () => ({
    collection: vi.fn(() => ({ id: 'mock-coll' })),
    doc: mocks.doc,
    addDoc: vi.fn(() => Promise.resolve({ id: 'mock-doc' })),
    getDoc: vi.fn(() => Promise.resolve({ exists: () => true, data: () => ({}) })),
    setDoc: vi.fn(() => Promise.resolve()),
    updateDoc: vi.fn(() => Promise.resolve()),
    onSnapshot: mocks.onSnapshot,
    serverTimestamp: vi.fn(),
    Timestamp: {
        now: () => ({ toMillis: () => Date.now() }),
        fromMillis: (ms: number) => ({ toMillis: () => ms })
    }
}));

vi.mock('@/core/store', () => ({
    serverTimestamp: vi.fn(),
    useStore: mocks.useStore
}));

describe('Lens 🎥 - Veo 3.1 Resilience & Fallback Strategy', () => {
    let service: VideoGenerationService;

    beforeEach(() => {
        vi.useFakeTimers();
        vi.clearAllMocks();
        service = new VideoGenerationService();
        global.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200 });

        // Default successful mocks
        mocks.analyzeImage.mockResolvedValue('Calculated temporal context');
        mocks.canPerformAction.mockResolvedValue({ allowed: true });

        // Mock the trigger method to avoid calling real Firebase functions
        vi.spyOn(service as any, 'triggerVideoGeneration').mockResolvedValue({ jobId: 'mock-job-id' });
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('should proceed with generation (Resilience) when Temporal Context Analysis fails', async () => {
        // Scenario: AI Service is down or returns 500
        mocks.analyzeImage.mockRejectedValue(new Error('AI Service Unavailable'));

        const options = {
            prompt: 'A cinematic shot of a cyberpunk city',
            firstFrame: 'base64-image-data',
            timeOffset: 4,
            fps: 24,
            // Ensure we test that strict safety settings are passed through
            safetySettings: [
                { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_LOW_AND_ABOVE' }
            ]
        };

        // Execute
        const result = await service.generateVideo(options);

        // Assert
        expect(result).toHaveLength(1);
        expect(result[0].id).toBe('mock-job-id');

        const triggerSpy = vi.spyOn(service as any, 'triggerVideoGeneration');
        expect(triggerSpy).toHaveBeenCalledTimes(1);

        const callArgs = triggerSpy.mock.calls[0][0] as any;
        expect(callArgs.prompt).toContain('A cinematic shot of a cyberpunk city');
        expect(callArgs.prompt).not.toContain('Calculated temporal context');

        // Assert Safety Settings Handshake (Always do)
        expect(callArgs.safetySettings).toBeDefined();
        expect(callArgs.safetySettings).toHaveLength(1);
        expect(callArgs.safetySettings![0].category).toBe('HARM_CATEGORY_HATE_SPEECH');
    });

    it('should proceed with generation (Fallback) when Quota Service fails', async () => {
        // Scenario: Subscription Service network error
        mocks.canPerformAction.mockRejectedValue(new Error('Network Error'));

        const options = {
            prompt: 'A calm ocean view'
        };

        // Execute
        const result = await service.generateVideo(options);

        // Assert
        expect(result).toHaveLength(1);
        expect(result[0].id).toBe('mock-job-id');
    });

    it('should BLOCK generation when Quota is strictly exceeded', async () => {
        // Scenario: User has no credits left
        mocks.canPerformAction.mockResolvedValue({ allowed: false, reason: 'Monthly limit reached' });

        const options = {
            prompt: 'Expensive video generation'
        };

        // Execute & Assert
        await expect(service.generateVideo(options)).rejects.toThrow(/Quota exceeded: Monthly limit reached/);
    });

    it('should correctly enrich prompt with Veo 3.1 parameters even during Fallback', async () => {
        // Scenario: AI analysis fails, but we still want Camera/Motion control
        mocks.analyzeImage.mockRejectedValue(new Error('AI fail'));

        const options = {
            prompt: 'A car chase',
            cameraMovement: 'Pan',
            motionStrength: 0.9,
            fps: 60
        };

        await service.generateVideo(options);

        const triggerSpy = vi.spyOn(service as any, 'triggerVideoGeneration');
        const callArgs = triggerSpy.mock.calls[0][0] as any;

        expect(callArgs.prompt).toContain('cinematic pan camera movement');
        expect(callArgs.prompt).toContain('high dynamic motion');
    });

    it('should verify E2E pipeline: Trigger -> Wait -> Success with Veo 3.1 Metadata', async () => {
        // 1. Setup Trigger Mock (Already done in beforeEach, ensuring we get 'mock-job-id')

        // 2. Setup Wait Mock (onSnapshot)
        mocks.doc.mockReturnValue('doc-ref');
        mocks.onSnapshot.mockImplementation((ref, callback) => {
            // Simulate async completion
            setTimeout(() => {
                callback({
                    exists: () => true,
                    id: 'mock-job-id',
                    data: () => ({
                        serverTimestamp: vi.fn(),
                        status: 'completed',
                        output: {
                            url: 'https://veo.google.com/generated-video.mp4',
                            metadata: {
                                duration_seconds: 5.0,
                                fps: 30,
                                mime_type: 'video/mp4'
                            }
                        }
                    })
                });
            }, 100); // 100ms delay
            return vi.fn(); // Unsubscribe
        });

        // 3. Execute: Generate and Wait
        const options = { prompt: 'Test video' };
        const generationResult = await service.generateVideo(options);
        const jobId = generationResult[0].id;

        const waitPromise = service.waitForJob(jobId, 1000);

        // 4. Advance time to trigger completion
        vi.advanceTimersByTime(100);

        const jobResult = await waitPromise;

        // 5. Assert: Metadata Integrity (The "Contract")
        expect(jobResult.output!.metadata!.mime_type).toBe('video/mp4');
        expect((jobResult.output!.metadata as any)!.duration_seconds).toBe(5.0);
        expect((jobResult.output!.metadata as any)!.fps).toBe(30);
        expect(jobResult.output!.url).toBe('https://veo.google.com/generated-video.mp4');
    });
});
