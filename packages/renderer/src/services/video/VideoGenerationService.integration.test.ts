import { vi, describe, it, expect, beforeEach } from 'vitest';
import { VideoGenerationService } from './VideoGenerationService';
import { VideoGenerationOptions } from '@/modules/video/schemas';
import { GenAI } from '@/services/ai/GenAI';

// Mock Dependencies
vi.mock('../ai/FirebaseAIService', () => {
    const mockFirebaseAI = {
        generateText: vi.fn().mockResolvedValue('Mock AI response'),
        generateStructuredData: vi.fn().mockResolvedValue({ data: {} }),
        generateImage: vi.fn().mockResolvedValue({ url: 'https://mock-image.png' }),
        generateVideo: vi.fn().mockResolvedValue('https://mock-video.mp4'),
        generateContent: vi.fn().mockResolvedValue('Mock AI response'),
        analyzeImage: vi.fn().mockResolvedValue({ analysis: {} })
    };
    return {
        FirebaseAIService: class {
            static getInstance() { return mockFirebaseAI; }
        },
        firebaseAI: mockFirebaseAI
    };
});

vi.mock('@/core/store', () => ({
    useStore: {
        getState: () => ({ currentOrganizationId: 'org-123' })
    }
}));

const _mockHttpsCallable = vi.fn();
// We need to return a function that returns the result, because httpsCallable returns a callable function
const mockTriggerVideoJob = vi.fn().mockResolvedValue({ data: { jobId: 'job-123' } });

vi.mock('firebase/functions', () => ({
    httpsCallable: (functions: any, name: string) => {
        if (name === 'triggerVideoJob') return mockTriggerVideoJob;
        return vi.fn();
    }
}));

vi.mock('@/services/firebase', () => ({
    auth: { currentUser: { uid: 'user-123' } },
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

vi.mock('@/services/subscription/SubscriptionService', () => ({
    subscriptionService: {
        canPerformAction: vi.fn().mockResolvedValue({ allowed: true })
    }
}));

// Mock UUID to return deterministic ID if needed, OR adjust test to expect any string
// The service implementation generates a UUID *before* calling the function in some paths,
// or the function returns it.
// Looking at the implementation of `triggerVideoGeneration`:
// await triggerVideoJob({ ...options, jobId });
// return { jobId };
// So the Service generates the ID. We should mock uuid.

vi.mock('uuid', () => ({
    v4: () => 'job-123'
}));

describe('VideoGenerationService Integration', () => {
    let service: VideoGenerationService;

    beforeEach(() => {
        vi.clearAllMocks();
        service = new VideoGenerationService();
    });

    it('generateVideo accepts valid options', async () => {
        const validOptions: VideoGenerationOptions = {
            prompt: "A cyberpunk city at night",
            duration: 5,
            fps: 24,
            aspectRatio: "16:9",
            resolution: '1080p',
            cameraMovement: "Pan Right"
        };

        const result = await service.generateVideo(validOptions);

        expect(result[0]!.id).toBe('job-123');
        expect(GenAI.generateVideo).toHaveBeenCalledWith(expect.objectContaining({
            prompt: expect.stringContaining("A cyberpunk city")
        }));
    });

    it('generateVideo throws error for missing prompt', async () => {
        const invalidOptions = {
            prompt: "", // Invalid
            duration: 5
        } as VideoGenerationOptions;

        await expect(service.generateVideo(invalidOptions)).rejects.toThrow(/Invalid video parameters/);
    });

    it('generateVideo throws error for invalid duration', async () => {
        const invalidOptions = {
            prompt: "Valid prompt",
            duration: 600 // Too long (max 300)
        } as VideoGenerationOptions;

        await expect(service.generateVideo(invalidOptions)).rejects.toThrow(/Invalid video parameters/);
    });
});
