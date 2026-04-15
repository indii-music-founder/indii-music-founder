import { VideoGeneration } from '../VideoGenerationService';
import { useStore } from '@/core/store';
import { subscriptionService } from '@/services/subscription/SubscriptionService';
import { firebaseAI } from '../../ai/FirebaseAIService';
import { vi, describe, it, expect, beforeEach } from 'vitest';

// Mocks
vi.mock('@/core/store');

vi.mock('../../ai/FirebaseAIService', () => ({
    firebaseAI: {
        generateVideo: vi.fn().mockResolvedValue('https://storage.googleapis.com/mock-video.mp4'),
        analyzeImage: vi.fn().mockResolvedValue('Mocked temporal analysis result.'),
    }
}));

vi.mock('@/services/subscription/SubscriptionService', () => ({
    subscriptionService: {
        canPerformAction: vi.fn(),
        getCurrentSubscription: vi.fn()
    }
}));

vi.mock('@/services/firebase', () => ({
    auth: { currentUser: { uid: 'test-user' } },
    functions: {},
    functionsWest1: {},
    remoteConfig: {},
    db: {},
    storage: {},
    getFirebaseAI: vi.fn(() => ({})),
    app: { options: {} },
    appCheck: { getToken: vi.fn(() => Promise.resolve({ token: 'mock-token' })) },
    messaging: { getToken: vi.fn() }
}));

vi.mock('firebase/firestore', async (importOriginal) => {
    const actual = await importOriginal() as unknown as any;
    return {
        ...actual,
        doc: vi.fn(() => ({ id: 'mock-doc-ref', path: 'videoJobs/mock-doc-ref' })),
        setDoc: vi.fn().mockResolvedValue(undefined),
        updateDoc: vi.fn().mockResolvedValue(undefined),
        serverTimestamp: vi.fn(),
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

// Mock video utils — extractLastFrameForAPI is called in the daisy-chain loop
// and will block/timeout if not mocked (it attempts real video frame extraction).
vi.mock('@/utils/video', () => ({
    extractLastFrameForAPI: vi.fn().mockResolvedValue({
        imageBytes: 'mock-base64-frame-data',
        mimeType: 'image/jpeg',
        dataUrl: 'data:image/jpeg;base64,mock-base64-frame-data',
    }),
}));

import type { UserProfile } from '@/types/User';

// Helper to create mock profile with distributor
const createMockProfile = (distributor?: string) => ({
    uid: 'test-user',
    email: 'test@example.com',
    brandKit: distributor ? {
        socials: { distributor }
    } : undefined
} as unknown as UserProfile);

describe('VideoGenerationService - Distributor Integration', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (useStore.getState as import("vitest").Mock).mockReturnValue({ currentOrganizationId: 'org-1' });
        (subscriptionService.canPerformAction as import("vitest").Mock).mockResolvedValue({ allowed: true });
        (subscriptionService.getCurrentSubscription as import("vitest").Mock).mockResolvedValue({ tier: 'pro' });
    });

    describe('Distributors with Canvas support (9:16)', () => {
        it('applies 9:16 for DistroKid Canvas', async () => {
            await VideoGeneration.generateVideo({
                prompt: 'A cool video',
                userProfile: createMockProfile('distrokid')
            });

            const callArgs = vi!.mocked(firebaseAI.generateVideo).mock.calls[0]![0];
            expect(callArgs.config?.aspectRatio).toBe('9:16');
            expect(callArgs.prompt).toContain('Optimized for Spotify Canvas');
        });

        it('applies 9:16 for TuneCore Canvas', async () => {
            await VideoGeneration.generateVideo({
                prompt: 'A cool video',
                userProfile: createMockProfile('tunecore')
            });

            const callArgs = vi!.mocked(firebaseAI.generateVideo).mock.calls[0]![0];
            expect(callArgs.config?.aspectRatio).toBe('9:16');
            expect(callArgs.prompt).toContain('Optimized for Spotify Canvas');
        });
    });

    describe('Distributors without Canvas support', () => {
        it('does NOT apply Canvas constraints for CD Baby', async () => {
            await VideoGeneration.generateVideo({
                prompt: 'A cool video',
                userProfile: createMockProfile('cdbaby')
            });

            const callArgs = vi!.mocked(firebaseAI.generateVideo).mock.calls[0]![0];
            // Default aspect ratio is '16:9' when no distributor constraint applies
            expect(callArgs.config?.aspectRatio).toBe('16:9');
            expect(callArgs.prompt).not.toContain('Optimized for Spotify Canvas');
        });

        it('does NOT apply Canvas constraints for Ditto', async () => {
            await VideoGeneration.generateVideo({
                prompt: 'A cool video',
                userProfile: createMockProfile('ditto')
            });

            const callArgs = vi!.mocked(firebaseAI.generateVideo).mock.calls[0]![0];
            expect(callArgs.config?.aspectRatio).toBe('16:9');
            expect(callArgs.prompt).not.toContain('Optimized for Spotify Canvas');
        });

        it('does NOT apply Canvas constraints for AWAL', async () => {
            await VideoGeneration.generateVideo({
                prompt: 'A cool video',
                userProfile: createMockProfile('awal')
            });

            const callArgs = vi!.mocked(firebaseAI.generateVideo).mock.calls[0]![0];
            expect(callArgs.config?.aspectRatio).toBe('16:9');
            expect(callArgs.prompt).not.toContain('Optimized for Spotify Canvas');
        });

        it('does NOT apply Canvas constraints for UnitedMasters', async () => {
            await VideoGeneration.generateVideo({
                prompt: 'A cool video',
                userProfile: createMockProfile('unitedmasters')
            });

            const callArgs = vi!.mocked(firebaseAI.generateVideo).mock.calls[0]![0];
            expect(callArgs.config?.aspectRatio).toBe('16:9');
            expect(callArgs.prompt).not.toContain('Optimized for Spotify Canvas');
        });

        it('does NOT apply Canvas constraints for Amuse', async () => {
            await VideoGeneration.generateVideo({
                prompt: 'A cool video',
                userProfile: createMockProfile('amuse')
            });

            const callArgs = vi!.mocked(firebaseAI.generateVideo).mock.calls[0]![0];
            expect(callArgs.config?.aspectRatio).toBe('16:9');
            expect(callArgs.prompt).not.toContain('Optimized for Spotify Canvas');
        });
    });

    describe('Edge cases', () => {
        it('falls back to defaults when no distributor configured', async () => {
            await VideoGeneration.generateVideo({
                prompt: 'A cool video',
                userProfile: createMockProfile() // No distributor
            });

            const callArgs = vi!.mocked(firebaseAI.generateVideo).mock.calls[0]![0];
            expect(callArgs.config?.aspectRatio).toBe('16:9');
            expect(callArgs.prompt).not.toContain('Optimized for Spotify Canvas');
        });

        it('falls back to defaults when no userProfile provided', async () => {
            await VideoGeneration.generateVideo({
                prompt: 'A cool video'
                // No userProfile at all
            });

            const callArgs = vi!.mocked(firebaseAI.generateVideo).mock.calls[0]![0];
            expect(callArgs.config?.aspectRatio).toBe('16:9');
        });

        it('explicit aspectRatio overrides distributor default', async () => {
            await VideoGeneration.generateVideo({
                prompt: 'A cool video',
                aspectRatio: '16:9', // Explicit override
                userProfile: createMockProfile('distrokid') // Would normally be 9:16
            });

            const callArgs = vi!.mocked(firebaseAI.generateVideo).mock.calls[0]![0];
            expect(callArgs.config?.aspectRatio).toBe('16:9');
        });

        it('handles unknown distributor gracefully', async () => {
            await VideoGeneration.generateVideo({
                prompt: 'A cool video',
                userProfile: createMockProfile('unknown_distributor')
            });

            const callArgs = vi!.mocked(firebaseAI.generateVideo).mock.calls[0]![0];
            // Should NOT crash, just use defaults
            expect(callArgs.config?.aspectRatio).toBe('16:9');
        });
    });

    describe('Long-form video generation', () => {
        it('applies distributor constraints to long-form videos', async () => {
            (subscriptionService.canPerformAction as import("vitest").Mock).mockResolvedValue({ allowed: true });

            await VideoGeneration.generateLongFormVideo({
                prompt: 'A long video',
                totalDuration: 30,
                userProfile: createMockProfile('distrokid')
            });

            // Long-form generates multiple segments, each calling firebaseAI.generateVideo
            const calls = vi.mocked(firebaseAI.generateVideo).mock.calls;
            expect(calls.length).toBeGreaterThan(0);

            // Each segment should have 9:16 for DistroKid
            const firstCallArgs = calls[0]![0];
            expect(firstCallArgs.config?.aspectRatio).toBe('9:16');
            // Prompt segments should contain Canvas optimization
            expect(firstCallArgs.prompt).toContain('Optimized for Spotify Canvas');
        });
    });
});
