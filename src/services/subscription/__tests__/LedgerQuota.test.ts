import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SubscriptionService } from '../SubscriptionService';
import { SubscriptionTier, TIER_CONFIGS } from '../SubscriptionTier';
import { cacheService } from '@/services/cache/CacheService';
import { httpsCallable } from 'firebase/functions';

// Mock Firebase
vi.mock('firebase/functions', () => ({
    getFunctions: vi.fn(),
    httpsCallable: vi.fn()
}));

vi.mock('@/services/firebase', () => ({
    auth: {
        currentUser: { uid: 'ledger-test-user' }
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

describe('Ledger\'s "Circuit Breaker" Test 💸', () => {
    let service: SubscriptionService;
    let mutableUsageStats: any;

    // Mock Functions
    const mockFunctions = {
        getSubscription: vi.fn(),
        getUsageStats: vi.fn(),
        trackUsage: vi.fn()
    };

    beforeEach(() => {
        vi.clearAllMocks();
        service = new SubscriptionService();

        // Setup generic httpsCallable mock
        (httpsCallable as any).mockImplementation((_functions: any, name: string) => {
            return mockFunctions[name as keyof typeof mockFunctions];
        });

        // Setup base subscription (FREE Tier)
        const mockSub = {
            id: 'sub_ledger',
            userId: 'ledger-test-user',
            tier: SubscriptionTier.FREE,
            status: 'active',
            currentPeriodStart: Date.now(),
            currentPeriodEnd: Date.now() + 86400000,
            cancelAtPeriodEnd: false,
            createdAt: Date.now(),
            updatedAt: Date.now()
        };

        // Mock Cache to return subscription but NOT usage (forcing a "fetch" which we intercept)
        (cacheService.get as any).mockImplementation((key: string) => {
            if (key.startsWith('subscription:')) return mockSub;
            return null;
        });

        mockFunctions.getSubscription.mockResolvedValue({ data: mockSub });

        // Initialize Mutable Usage Stats (The "Wallet")
        // We start with 0 usage.
        // FREE Tier Token Limit is 10,000 (from SubscriptionTier.ts)
        mutableUsageStats = {
            tier: SubscriptionTier.FREE,
            resetDate: Date.now() + 86400000,
            imagesGenerated: 0,
            imagesRemaining: 50,
            imagesPerMonth: 50,
            videoDurationSeconds: 0,
            videoDurationMinutes: 0,
            videoRemainingMinutes: 5,
            videoTotalMinutes: 5,
            aiChatTokensUsed: 0,
            aiChatTokensRemaining: 10000, // Starting Balance
            aiChatTokensPerMonth: 10000,
            storageUsedGB: 0,
            storageRemainingGB: 2,
            storageTotalGB: 2,
            projectsCreated: 0,
            projectsRemaining: 3,
            maxProjects: 3,
            teamMembersUsed: 0,
            teamMembersRemaining: 1,
            maxTeamMembers: 1
        };

        // The mock always returns the current state of our "Wallet"
        mockFunctions.getUsageStats.mockImplementation(async () => {
            return { data: { ...mutableUsageStats } };
        });
    });

    it('should halt execution EXACTLY when the hard limit is breached', async () => {
        // LEDGER'S SCENARIO:
        // An Agent is in a loop, consuming tokens.
        // We want to verify that the "Circuit Breaker" trips exactly when the balance hits 0.

        const TOKEN_COST_PER_ACTION = 1000;
        const INITIAL_BALANCE = 10000;
        const EXPECTED_LOOPS = INITIAL_BALANCE / TOKEN_COST_PER_ACTION; // 10 loops

        let loopsCompleted = 0;
        let circuitBreakerTripped = false;

        // Simulate the Agent's "Work Loop"
        // We allow it to run slightly more than expected to prove it stops.
        for (let i = 0; i < EXPECTED_LOOPS + 5; i++) {

            // 1. Check Budget (The "Gatekeeper")
            const quotaCheck = await service.canPerformAction('chat', TOKEN_COST_PER_ACTION, 'ledger-test-user');

            if (!quotaCheck.allowed) {
                circuitBreakerTripped = true;
                // Verify the reason is correct (Ledger demands explanation!)
                expect(quotaCheck.reason).toContain('token quota exceeded');
                expect(quotaCheck.upgradeRequired).toBe(true);
                break; // HALT!
            }

            // 2. Perform Work (Simulated)
            loopsCompleted++;

            // 3. Deduct from Wallet (Simulating the backend update)
            mutableUsageStats.aiChatTokensUsed += TOKEN_COST_PER_ACTION;
            mutableUsageStats.aiChatTokensRemaining -= TOKEN_COST_PER_ACTION;

            // In a real app, trackUsage would happen here.
            // We invalidate cache to ensure next check fetches fresh stats
            service.invalidateUsageCache('ledger-test-user');
        }

        // VERIFICATION
        console.log(`Ledger Report: Paid for ${loopsCompleted} loops. Circuit breaker tripped: ${circuitBreakerTripped}`);

        // 1. Assert we got exactly what we paid for
        expect(loopsCompleted).toBe(EXPECTED_LOOPS);

        // 2. Assert the system STOPPED (Circuit Breaker)
        expect(circuitBreakerTripped).toBe(true);

        // 3. Assert the Balance is effectively zero (or insufficient for next move)
        expect(mutableUsageStats.aiChatTokensRemaining).toBe(0);

        // 4. Double check: Trying one more time should still be blocked
        const finalCheck = await service.canPerformAction('chat', TOKEN_COST_PER_ACTION, 'ledger-test-user');
        expect(finalCheck.allowed).toBe(false);
    });
});
