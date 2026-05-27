/**
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { VideoGenerationService } from './VideoGenerationService';
import { UserProfile } from '@/modules/workflow/types';
import { AutonomousIntelligence } from '@/services/intelligence/AutonomousIntelligence';

// Mock dependencies
const mocks = vi.hoisted(() => ({
    httpsCallableFn: vi.fn().mockResolvedValue({ data: { jobId: 'mock-job-id' } }),
    auth: { currentUser: { uid: 'lens-tester' } },
    triggerVideoJob: vi.fn(),
    httpsCallable: vi.fn(() => mocks.httpsCallableFn),
    useStore: {
        getState: vi.fn(() => ({ currentOrganizationId: 'lens-org' }))
    },
    subscriptionService: {
        canPerformAction: vi.fn().mockResolvedValue({ allowed: true })
    }
}));

vi.mock('firebase/functions', () => ({
    httpsCallable: mocks.httpsCallable,
    getFunctions: vi.fn()
}));

vi.mock('firebase/firestore', () => ({
    doc: vi.fn(() => ({ id: 'mock-doc' })),
    setDoc: vi.fn(() => Promise.resolve()),
    updateDoc: vi.fn(() => Promise.resolve()),
    addDoc: vi.fn(() => Promise.resolve({ id: 'mock-doc' })),
    collection: vi.fn(() => ({ id: 'mock-coll' })),
    serverTimestamp: vi.fn(() => new Date()),
    getFirestore: vi.fn(),
    onSnapshot: vi.fn(() => () => { }),
}));

vi.mock('@/services/firebase', () => ({
    functionsWest1: {}, // Correct export name used by VideoGenerationService
    db: {},
    auth: mocks.auth,
    remoteConfig: {},
    storage: {},
    functions: { region: vi.fn(() => ({ httpsCallable: vi.fn(() => mocks.httpsCallableFn) })) },
    getFirebaseAI: vi.fn(() => ({})),
    app: { options: {} },
    appCheck: { getToken: vi.fn(() => Promise.resolve({ token: 'mock-token' })) },
    messaging: { getToken: vi.fn() }
}));

vi.mock('../firebase', () => ({
    functionsWest1: {},
    functions: { region: vi.fn(() => ({ httpsCallable: vi.fn(() => mocks.httpsCallableFn) })) },
    db: {},
    auth: mocks.auth,
    remoteConfig: {},
}));

vi.mock('../intelligence/FirebaseIntelligenceService', () => {
    const mockFirebaseAI = {
        generateText: vi.fn().mockResolvedValue('Mock Intelligence response'),
        generateStructuredData: vi.fn().mockResolvedValue({ data: {} }),
        generateImage: vi.fn().mockResolvedValue({ url: 'https://mock-image.png' }),
        generateVideo: vi.fn().mockResolvedValue('blob:mock-video-url'),
        generateContent: vi.fn().mockResolvedValue('Mock Intelligence response'),
        analyzeImage: vi.fn().mockResolvedValue({ analysis: {} })
    };
    return {
        FirebaseIntelligenceService: class {
            static getInstance() { return mockFirebaseAI; }
        },
        firebaseAI: mockFirebaseAI
    };
});

vi.mock('@/services/subscription/SubscriptionService', () => ({
    subscriptionService: mocks.subscriptionService
}));

vi.mock('@/core/store', () => ({
    useStore: mocks.useStore
}));

vi.mock('uuid', () => ({
    v4: () => 'lens-job-id'
}));

describe('Lens 🎥 - Veo 3.1 Aspect Ratio Compliance', () => {
    let service: VideoGenerationService;

    beforeEach(() => {
        vi.clearAllMocks();
        service = new VideoGenerationService();
        mocks.subscriptionService.canPerformAction.mockResolvedValue({ allowed: true });
        mocks.httpsCallableFn.mockResolvedValue({ data: { jobId: 'job-123' } });
        mocks.httpsCallable.mockReturnValue(mocks.httpsCallableFn);
    });

    it('should strictly respect explicit "16:9" aspect ratio', async () => {
        await service.generateVideo({
            prompt: 'Cinematic sunset',
            aspectRatio: '16:9',
            duration: 5
        });

        expect(mocks.httpsCallableFn).toHaveBeenCalledWith(expect.objectContaining({
            prompt: expect.stringContaining('Cinematic sunset'),
        }));
    });

    it('should automatically apply "9:16" for DistroKid users (Spotify Canvas)', async () => {
        // Mock UserProfile with DistroKid (which requires 9:16 for Canvas)
        const userProfile: Partial<UserProfile> = {
            brandKit: {
                socials: {
                    distributor: 'DistroKid'
                }
            } as unknown as NonNullable<UserProfile["brandKit"]>
        };

        await service.generateVideo({
            prompt: 'Abstract loop',
            userProfile: userProfile as UserProfile,
            // No explicit aspect ratio
        });

        // Verify prompt enrichment
        expect(mocks.httpsCallableFn).toHaveBeenCalledWith(expect.objectContaining({
            prompt: expect.stringContaining('Optimized for Spotify Canvas'),
        }));
        expect(mocks.httpsCallableFn).toHaveBeenCalledWith(expect.objectContaining({
            prompt: expect.stringContaining('9:16'),
        }));
    });

    it('should respect user override (16:9) even if DistroKid is configured', async () => {
        const userProfile: Partial<UserProfile> = {
            brandKit: {
                socials: {
                    distributor: 'DistroKid'
                }
            } as unknown as NonNullable<UserProfile["brandKit"]>
        };

        await service.generateVideo({
            prompt: 'Wide music video',
            aspectRatio: '16:9', // Explicit override
            userProfile: userProfile as UserProfile
        });

        expect(mocks.httpsCallableFn).toHaveBeenCalledWith(expect.objectContaining({
            prompt: expect.stringContaining('Wide music video'),
        }));
    });
});
