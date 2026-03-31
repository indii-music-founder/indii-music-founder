/**
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { VideoGenerationService } from './VideoGenerationService';
import { UserProfile } from '@/modules/workflow/types';
import { firebaseAI } from '../ai/FirebaseAIService';

// Mock dependencies
const mocks = vi.hoisted(() => ({
    auth: { currentUser: { uid: 'lens-tester' } },
    triggerVideoJob: vi.fn(),
    httpsCallable: vi.fn(),
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
    functions: { region: vi.fn(() => ({ httpsCallable: vi.fn() })) },
    getFirebaseAI: vi.fn(() => ({})),
    app: { options: {} },
    appCheck: { getToken: vi.fn(() => Promise.resolve({ token: 'mock-token' })) },
    messaging: { getToken: vi.fn() }
}));

vi.mock('../firebase', () => ({
    functionsWest1: {},
    db: {},
    auth: mocks.auth,
    remoteConfig: {},
}));

vi.mock('../ai/FirebaseAIService', () => ({
    firebaseAI: {
        analyzeImage: vi.fn().mockResolvedValue('Analyzed context'),
        generateVideo: vi.fn().mockResolvedValue('https://storage.googleapis.com/mock/video.mp4')
    }
}));

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
        mocks.httpsCallable.mockReturnValue(mocks.triggerVideoJob);
        mocks.triggerVideoJob.mockResolvedValue({ data: { jobId: 'lens-job-id' } });
    });

    it('should strictly respect explicit "16:9" aspect ratio', async () => {
        await service.generateVideo({
            prompt: 'Cinematic sunset',
            aspectRatio: '16:9',
            duration: 5
        });

        expect(firebaseAI.generateVideo).toHaveBeenCalledWith(expect.objectContaining({
            prompt: expect.stringContaining('Cinematic sunset'),
            config: expect.objectContaining({
                aspectRatio: '16:9',
            }),
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

        expect(firebaseAI.generateVideo).toHaveBeenCalledWith(expect.objectContaining({
            config: expect.objectContaining({
                aspectRatio: '9:16',
            }),
        }));

        // Verify prompt enrichment
        const callArgs = (firebaseAI.generateVideo as ReturnType<typeof vi.fn>).mock.calls[0]![0];
        expect(callArgs.prompt).toContain('Optimized for Spotify Canvas');
        expect(callArgs.prompt).toContain('9:16');
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

        expect(firebaseAI.generateVideo).toHaveBeenCalledWith(expect.objectContaining({
            config: expect.objectContaining({
                aspectRatio: '16:9',
            }),
        }));
    });
});
