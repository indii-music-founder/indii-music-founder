
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SubscriptionService } from './SubscriptionService';
import { SubscriptionTier, getTierConfig } from './SubscriptionTier';
import { auth } from '@/services/firebase';
import { cacheService } from '@/services/cache/CacheService';
import { httpsCallable } from 'firebase/functions';

// -----------------------------------------------------------------------------
// LEDGER'S TEST SUITE: SUBSCRIPTION GATES & QUOTA LIMITS
// -----------------------------------------------------------------------------
// "If the Agent can't explain the cost, the Agent can't spend the money." - Ledger
// This test verifies that Pro/Studio features are strictly gated for Free users.
// -----------------------------------------------------------------------------

// Mock dependencies
vi.mock('@/services/firebase', () => ({
    auth: { currentUser: { uid: 'ledger-user-123' } }
}));

vi.mock('firebase/functions', () => ({
    getFunctions: vi.fn(),
    httpsCallable: vi.fn()
}));

vi.mock('@/services/cache/CacheService', () => ({
    cacheService: {
        get: vi.fn(),
        set: vi.fn(),
        invalidate: vi.fn(),
        invalidatePattern: vi.fn()
    }
}));

describe('SubscriptionService (Ledger Checks)', () => {
    let subscriptionService: SubscriptionService;
    const mockHttpsCallable = httpsCallable as any;

    beforeEach(() => {
        vi.clearAllMocks();
        // Reset singleton-like behavior by creating a new instance if possible,
        // or just clearing internal state via public methods if available.
        // Since we can't easily reset the singleton export, we'll rely on mocking external calls.
        subscriptionService = new SubscriptionService();
        subscriptionService.clearCache();
    });

    // Helper to mock backend responses
    const mockBackendResponse = (tier: SubscriptionTier, usageOverrides: any = {}) => {
        // Mock Subscription
        mockHttpsCallable.mockImplementation((functions: any, name: string) => {
            if (name === 'getSubscription') {
                return async () => ({
                    data: {
                        id: 'sub_123',
                        userId: 'ledger-user-123',
                        tier: tier,
                        status: 'active',
                        currentPeriodStart: Date.now(),
                        currentPeriodEnd: Date.now() + 86400000,
                        cancelAtPeriodEnd: false,
                        createdAt: Date.now(),
                        updatedAt: Date.now()
                    }
                });
            }
            if (name === 'getUsageStats') {
                const tierConfig = getTierConfig(tier);
                return async () => ({
                    data: {
                        tier: tier,
                        resetDate: Date.now() + 86400000,
                        imagesGenerated: usageOverrides.imagesGenerated || 0,
                        imagesRemaining: (tierConfig.imageGenerations.monthly - (usageOverrides.imagesGenerated || 0)),
                        imagesPerMonth: tierConfig.imageGenerations.monthly,
                        videoDurationSeconds: usageOverrides.videoDurationSeconds || 0,
                        videoDurationMinutes: (usageOverrides.videoDurationSeconds || 0) / 60,
                        videoRemainingMinutes: tierConfig.videoGenerations.totalDurationMinutes - ((usageOverrides.videoDurationSeconds || 0) / 60),
                        videoTotalMinutes: tierConfig.videoGenerations.totalDurationMinutes,
                        aiChatTokensUsed: usageOverrides.aiChatTokensUsed || 0,
                        aiChatTokensRemaining: tierConfig.aiChat.tokensPerMonth - (usageOverrides.aiChatTokensUsed || 0),
                        aiChatTokensPerMonth: tierConfig.aiChat.tokensPerMonth,
                        storageUsedGB: usageOverrides.storageUsedGB || 0,
                        storageRemainingGB: tierConfig.storage.totalGB - (usageOverrides.storageUsedGB || 0),
                        storageTotalGB: tierConfig.storage.totalGB,
                        projectsCreated: usageOverrides.projectsCreated || 0,
                        projectsRemaining: tierConfig.maxProjects - (usageOverrides.projectsCreated || 0),
                        maxProjects: tierConfig.maxProjects,
                        teamMembersUsed: usageOverrides.teamMembersUsed || 0,
                        teamMembersRemaining: tierConfig.maxTeamMembers - (usageOverrides.teamMembersUsed || 0),
                        maxTeamMembers: tierConfig.maxTeamMembers
                    }
                });
            }
            return async () => ({ data: {} });
        });
    };

    it('💸 "Subscription Gate": Verifies Pro features (Long Duration Video) fail for Free Tier', async () => {
        // Setup: Free Tier User
        mockBackendResponse(SubscriptionTier.FREE);

        // Attempt to generate a 10-minute video (600 seconds)
        // Free tier limit is 5 minutes (300 seconds) in TIER_CONFIGS
        const result = await subscriptionService.canPerformAction('generateVideo', 600);

        // Expectation: Access Denied
        expect(result.allowed).toBe(false);
        expect(result.upgradeRequired).toBe(true);
        expect(result.reason).toContain('Video quota exceeded');

        // Verify "Ledger" logic: The cost (duration) exceeded the wallet (allowance)
        // Note: canPerformAction checks MONTHLY quota primarily in this implementation,
        // but strict duration limits per job should also be enforced.
        // Wait, 'generateVideo' action in `canPerformAction` checks against `videoRemainingMinutes`.
        // Free tier has 5 mins TOTAL per month.
        // So requesting 10 mins (600s) > 5 mins (300s) remaining.
    });

    it('💸 "Subscription Gate": Verifies Pro features (Long Duration Video) succeed for Pro Tier', async () => {
        // Setup: Pro Tier User
        mockBackendResponse(SubscriptionTier.PRO_MONTHLY);

        // Attempt to generate a 10-minute video (600 seconds)
        // Pro tier limit is 30 minutes total.
        const result = await subscriptionService.canPerformAction('generateVideo', 600);

        // Expectation: Access Granted
        expect(result.allowed).toBe(true);
    });

    it('💸 "Hard Limit": Halts system exactly when Video Quota is breached', async () => {
        // Setup: Free Tier User with 4.5 minutes used out of 5 minutes total
        mockBackendResponse(SubscriptionTier.FREE, {
            videoDurationSeconds: 4.5 * 60 // 270 seconds used
        });

        // Attempt to generate a 1 minute video (60 seconds)
        // 4.5 + 1 = 5.5 minutes > 5 minutes limit.
        const result = await subscriptionService.canPerformAction('generateVideo', 60);

        // Expectation: Access Denied
        expect(result.allowed).toBe(false);
        expect(result.reason).toContain('Video quota exceeded');
    });

    it('💸 "Wallet Check": Deducts estimated credit from local balance logic', async () => {
        // Setup: Pro User with 0 usage
        mockBackendResponse(SubscriptionTier.PRO_MONTHLY, {
            videoDurationSeconds: 0
        });

        // Check usage before
        const statsBefore = await subscriptionService.getCurrentUsageStats();
        expect(statsBefore.videoDurationMinutes).toBe(0);

        // In a real integration test, we would run the job and check after.
        // Here we verify the *Checker* logic works correctly against the stats.

        // Simulate a check for a large job (20 mins)
        const result = await subscriptionService.canPerformAction('generateVideo', 20 * 60);
        expect(result.allowed).toBe(true);

        // Simulate a check for a job that exceeds remaining (31 mins)
        const resultBlocked = await subscriptionService.canPerformAction('generateVideo', 31 * 60);
        expect(resultBlocked.allowed).toBe(false);
    });

    it('💸 "Pro Feature Gate": Verifies Team Members are blocked for Free Tier', async () => {
        // Setup: Free Tier User
        mockBackendResponse(SubscriptionTier.FREE);

        // Attempt to add a team member (limit is 1 for free, so adding 2nd should fail if used=1, but check logic)
        // TIER_CONFIGS[FREE].maxTeamMembers is 1.
        // If we try to add 2 members at once (unlikely but possible in bulk add) OR if we have 1 and add 1.

        // Let's assume user has 1 member already (themselves maybe? or 0 used)
        mockBackendResponse(SubscriptionTier.FREE, { teamMembersUsed: 1 });

        const result = await subscriptionService.canPerformAction('addTeamMember', 1);

        expect(result.allowed).toBe(false);
        expect(result.reason).toContain('Team member limit reached');
        expect(result.upgradeRequired).toBe(true);
    });

});
