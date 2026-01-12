import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SubscriptionService } from '../SubscriptionService';
import { SubscriptionTier, TIER_CONFIGS } from '../SubscriptionTier';
import { cacheService } from '@/services/cache/CacheService';
import { UsageWarningLevel } from '../types';
import { httpsCallable } from 'firebase/functions';

// Mock Firebase
vi.mock('firebase/functions', () => ({
    getFunctions: vi.fn(),
    httpsCallable: vi.fn()
}));

vi.mock('@/services/firebase', () => ({
    auth: {
        currentUser: { uid: 'test-user-id' }
    }
}));

// Mock CacheService
vi.mock('@/services/cache/CacheService', () => ({
    cacheService: {
        get: vi.fn(),
        set: vi.fn(),
        invalidate: vi.fn(),
        invalidatePattern: vi.fn()
    }
}));

describe('SubscriptionService', () => {
    let service: SubscriptionService;
    const mockFunctions = {
        getSubscription: vi.fn(),
        getUsageStats: vi.fn(),
        createCheckoutSession: vi.fn(),
        getCustomerPortal: vi.fn(),
        cancelSubscription: vi.fn(),
        resumeSubscription: vi.fn()
    };

    beforeEach(() => {
        vi.clearAllMocks();
        service = new SubscriptionService();

        // Setup generic httpsCallable mock
        (httpsCallable as any).mockImplementation((_functions: any, name: string) => {
            return mockFunctions[name as keyof typeof mockFunctions];
        });
    });

    describe('getSubscription', () => {
        it('should return cached subscription if available', async () => {
            const mockSub = {
                id: 'sub_123',
                userId: 'test-user-id',
                tier: SubscriptionTier.PRO_MONTHLY,
                status: 'active',
                currentPeriodStart: 1000,
                currentPeriodEnd: 2000,
                cancelAtPeriodEnd: false,
                createdAt: 1000,
                updatedAt: 1000
            };

            // Inject into private cache map via type casting or just mock cacheService
            (cacheService.get as any).mockReturnValue(mockSub);

            const result = await service.getSubscription('test-user-id');
            expect(result).toBe(mockSub);
            expect(mockFunctions.getSubscription).not.toHaveBeenCalled();
        });

        it('should fetch from firebase if not cached', async () => {
            (cacheService.get as any).mockReturnValue(null);

            const mockSub = {
                id: 'sub_remote',
                userId: 'test-user-id',
                tier: SubscriptionTier.FREE,
                status: 'active',
                currentPeriodStart: 1000,
                currentPeriodEnd: 2000,
                cancelAtPeriodEnd: false,
                createdAt: 1000,
                updatedAt: 1000
            };

            mockFunctions.getSubscription.mockResolvedValue({ data: mockSub });

            const result = await service.getSubscription('test-user-id');
            expect(result).toEqual(mockSub);
            expect(mockFunctions.getSubscription).toHaveBeenCalledWith({ userId: 'test-user-id' });
            expect(cacheService.set).toHaveBeenCalled();
        });
    });

    describe('Quota Checks (canPerformAction)', () => {
        // Helper to setup mocks for quota tests
        const setupMocks = (tier: SubscriptionTier, usageOverrides: any = {}) => {
            const mockSub = {
                id: 'sub_123',
                userId: 'test-user-id',
                tier,
                status: 'active',
                currentPeriodStart: 1000,
                currentPeriodEnd: 2000,
                cancelAtPeriodEnd: false,
                createdAt: 1000,
                updatedAt: 1000
            };
            (cacheService.get as any).mockImplementation((key: string) => {
                if (key.startsWith('subscription:')) return mockSub;
                // Mock usage cache lookup failure to force "fetch" but we'll intercept the fetch
                return null;
            });

            // Mock remote fetch for usage
            mockFunctions.getSubscription.mockResolvedValue({ data: mockSub });

            const defaultUsage = {
                userId: 'test-user-id',
                tier,
                resetDate: 123456789,
                imagesGenerated: 0,
                imagesRemaining: 100,
                imagesPerMonth: 100,
                videoDurationSeconds: 0,
                videoDurationMinutes: 0,
                videoRemainingMinutes: 100,
                videoTotalMinutes: 100,
                aiChatTokensUsed: 0,
                aiChatTokensRemaining: 10000,
                aiChatTokensPerMonth: 10000,
                storageUsedGB: 0,
                storageRemainingGB: 10,
                storageTotalGB: 10,
                projectsCreated: 0,
                projectsRemaining: 10,
                maxProjects: 10,
                teamMembersUsed: 0,
                teamMembersRemaining: 5,
                maxTeamMembers: 5,
                ...usageOverrides
            };

            // If we are mocking getUsageStats to return specific limits based on tier sometimes, 
            // but here we just return the 'defaultUsage' which we manually set to correspond to the scenario
            mockFunctions.getUsageStats.mockResolvedValue({ data: defaultUsage });

            return defaultUsage;
        };

        it('should allow unlimited access for STUDIO tier', async () => {
            setupMocks(SubscriptionTier.STUDIO);
            const result = await service.canPerformAction('generateImage', 1000, 'test-user-id');
            expect(result.allowed).toBe(true);
        });

        it('should block image generation when quota exceeded (FREE)', async () => {
            setupMocks(SubscriptionTier.FREE, {
                imagesGenerated: 50,
                imagesRemaining: 0
            });

            const result = await service.canPerformAction('generateImage', 1, 'test-user-id');
            expect(result.allowed).toBe(false);
            expect(result.reason).toContain('Image quota exceeded');
            expect(result.upgradeRequired).toBe(true);
        });

        it('should allow image generation when within quota (FREE)', async () => {
            setupMocks(SubscriptionTier.FREE, {
                imagesGenerated: 49,
                imagesRemaining: 1
            });

            const result = await service.canPerformAction('generateImage', 1, 'test-user-id');
            expect(result.allowed).toBe(true);
        });

        it('should block video generation when quota exceeded (PRO)', async () => {
            setupMocks(SubscriptionTier.PRO_MONTHLY, {
                videoRemainingMinutes: 0.5 // 30 seconds left
            });

            // Try to generate 1 minute video (60s) -> 1 minute amount is "60"? 
            // canPerformAction('generateVideo', amount) -> amount is usually count or time units?
            // Looking at implementation: `const videoMinutesNeeded = amount / 60;`
            // So amount passed to 'generateVideo' is SECONDS.

            const result = await service.canPerformAction('generateVideo', 60, 'test-user-id'); // 60 seconds = 1 min
            // remaining is 0.5 min. 1 min needed. Should fail.
            expect(result.allowed).toBe(false);
            expect(result.reason).toContain('Video quota exceeded');
        });

        it('should allow chat if tokens remain', async () => {
            setupMocks(SubscriptionTier.FREE, {
                aiChatTokensRemaining: 500
            });
            const result = await service.canPerformAction('chat', 100, 'test-user-id');
            expect(result.allowed).toBe(true);
        });

        it('should block chat if tokens insufficient', async () => {
            setupMocks(SubscriptionTier.FREE, {
                aiChatTokensRemaining: 50
            });
            const result = await service.canPerformAction('chat', 100, 'test-user-id');
            expect(result.allowed).toBe(false);
            expect(result.reason).toContain('token quota exceeded');
        });
    });

    describe('getUsageWarnings', () => {
        it('should return no warnings for low usage', async () => {
            const mockSub = { tier: SubscriptionTier.FREE, id: 'sub_123', userId: 'test-user-id', status: 'active', currentPeriodStart: 1000, currentPeriodEnd: 2000, cancelAtPeriodEnd: false, createdAt: 1000, updatedAt: 1000 };
            mockFunctions.getSubscription.mockResolvedValue({ data: mockSub });

            mockFunctions.getUsageStats.mockResolvedValue({
                data: {
                    tier: SubscriptionTier.FREE,
                    resetDate: 123456789,
                    imagesGenerated: 5,
                    imagesRemaining: 45, // 10% used
                    imagesPerMonth: 50,
                    videoDurationSeconds: 0,
                    videoDurationMinutes: 0,
                    videoRemainingMinutes: 100,
                    videoTotalMinutes: 100,
                    aiChatTokensUsed: 0,
                    aiChatTokensRemaining: 10000,
                    aiChatTokensPerMonth: 10000,
                    storageUsedGB: 0,
                    storageRemainingGB: 10,
                    storageTotalGB: 10,
                    projectsCreated: 0,
                    projectsRemaining: 10,
                    maxProjects: 10,
                    teamMembersUsed: 0,
                    teamMembersRemaining: 5,
                    maxTeamMembers: 5
                }
            });
            (cacheService.get as any).mockReturnValue(mockSub);

            const warnings = await service.getUsageWarnings('test-user-id');
            expect(warnings).toHaveLength(0);
        });

        it('should return CRITICAL warning when 85% image quota used', async () => {
            const mockSub = { tier: SubscriptionTier.FREE, id: 'sub_123', userId: 'test-user-id', status: 'active', currentPeriodStart: 1000, currentPeriodEnd: 2000, cancelAtPeriodEnd: false, createdAt: 1000, updatedAt: 1000 };
            const config = TIER_CONFIGS[SubscriptionTier.FREE];
            const limit = config.imageGenerations.monthly;
            const used = Math.floor(limit * 0.9); // 90%

            mockFunctions.getSubscription.mockResolvedValue({ data: mockSub });
            (cacheService.get as any).mockReturnValue(mockSub);

            mockFunctions.getUsageStats.mockResolvedValue({
                data: {
                    tier: SubscriptionTier.FREE,
                    resetDate: 123456789,
                    imagesGenerated: used,
                    imagesRemaining: limit - used,
                    imagesPerMonth: limit,
                    videoDurationSeconds: 0,
                    videoDurationMinutes: 0,
                    videoRemainingMinutes: 100,
                    videoTotalMinutes: 100,
                    aiChatTokensUsed: 0,
                    aiChatTokensRemaining: 10000,
                    aiChatTokensPerMonth: 10000,
                    storageUsedGB: 0,
                    storageRemainingGB: 10,
                    storageTotalGB: 10,
                    projectsCreated: 0,
                    projectsRemaining: 10,
                    maxProjects: 10,
                    teamMembersUsed: 0,
                    teamMembersRemaining: 5,
                    maxTeamMembers: 5
                }
            });

            const warnings = await service.getUsageWarnings('test-user-id');
            const imageWarning = warnings.find(w => w.type === 'image');
            expect(imageWarning).toBeDefined();
            expect(imageWarning?.level).toBe(UsageWarningLevel.CRITICAL);
        });

        it('should return EXCEEDED warning when 100% video quota used', async () => {
            const mockSub = { tier: SubscriptionTier.PRO_MONTHLY, id: 'sub_123', userId: 'test-user-id', status: 'active', currentPeriodStart: 1000, currentPeriodEnd: 2000, cancelAtPeriodEnd: false, createdAt: 1000, updatedAt: 1000 };
            const config = TIER_CONFIGS[SubscriptionTier.PRO_MONTHLY];
            const limit = config.videoGenerations.totalDurationMinutes;

            mockFunctions.getSubscription.mockResolvedValue({ data: mockSub });
            (cacheService.get as any).mockReturnValue(mockSub);

            mockFunctions.getUsageStats.mockResolvedValue({
                data: {
                    tier: SubscriptionTier.PRO_MONTHLY,
                    resetDate: 123456789,
                    imagesGenerated: 0,
                    imagesRemaining: 100,
                    imagesPerMonth: 100,
                    videoDurationMinutes: limit, // 100%
                    videoRemainingMinutes: 0,
                    videoTotalMinutes: limit,
                    videoDurationSeconds: limit * 60,
                    aiChatTokensUsed: 0,
                    aiChatTokensRemaining: 10000,
                    aiChatTokensPerMonth: 10000,
                    storageUsedGB: 0,
                    storageRemainingGB: 10,
                    storageTotalGB: 10,
                    projectsCreated: 0,
                    projectsRemaining: 10,
                    maxProjects: 10,
                    teamMembersUsed: 0,
                    teamMembersRemaining: 5,
                    maxTeamMembers: 5
                }
            });

            const warnings = await service.getUsageWarnings('test-user-id');
            const videoWarning = warnings.find(w => w.type === 'video');
            expect(videoWarning).toBeDefined();
            expect(videoWarning?.level).toBe(UsageWarningLevel.EXCEEDED);
        });
    });
});
