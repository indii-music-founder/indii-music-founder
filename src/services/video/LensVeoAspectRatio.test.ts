/**
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { VideoGenerationService } from './VideoGenerationService';
import { UserProfile } from '@/modules/workflow/types';

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

vi.mock('@/services/firebase', () => ({
    functionsWest1: {}, // Correct export name used by VideoGenerationService
    db: {},
    auth: mocks.auth,
    remoteConfig: {}
}));

vi.mock('../firebase', () => ({
    functionsWest1: {},
    db: {},
    auth: mocks.auth,
    remoteConfig: {}
}));

vi.mock('../ai/FirebaseAIService', () => ({
    firebaseAI: {
        analyzeImage: vi.fn().mockResolvedValue('Analyzed context')
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

        expect(mocks.triggerVideoJob).toHaveBeenCalledWith(expect.objectContaining({
            aspectRatio: '16:9',
            prompt: 'Cinematic sunset'
        }));
    });

    it('should automatically apply "9:16" for DistroKid users (Spotify Canvas)', async () => {
        // Mock UserProfile with DistroKid (which requires 9:16 for Canvas)
        const userProfile: Partial<UserProfile> = {
            brandKit: {
                socials: {
                    distributor: 'DistroKid'
                }
            } as any
        };

        await service.generateVideo({
            prompt: 'Abstract loop',
            userProfile: userProfile as UserProfile,
            // No explicit aspect ratio
        });

        expect(mocks.triggerVideoJob).toHaveBeenCalledWith(expect.objectContaining({
            aspectRatio: '9:16'
        }));

        // Verify prompt enrichment
        const callArgs = mocks.triggerVideoJob.mock.calls[0][0];
        expect(callArgs.prompt).toContain('Optimized for Spotify Canvas');
        expect(callArgs.prompt).toContain('9:16');
    });

    it('should respect user override (16:9) even if DistroKid is configured', async () => {
         const userProfile: Partial<UserProfile> = {
            brandKit: {
                socials: {
                    distributor: 'DistroKid'
                }
            } as any
        };

        await service.generateVideo({
            prompt: 'Wide music video',
            aspectRatio: '16:9', // Explicit override
            userProfile: userProfile as UserProfile
        });

        expect(mocks.triggerVideoJob).toHaveBeenCalledWith(expect.objectContaining({
            aspectRatio: '16:9'
        }));
    });
});
