
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SubscriptionService } from './SubscriptionService';
import { SubscriptionTier } from './SubscriptionTier';
import { httpsCallable } from 'firebase/functions';

// -----------------------------------------------------------------------------
// LEDGER'S TEST SUITE: TOKEN CIRCUIT BREAKER
// -----------------------------------------------------------------------------
// "If the Agent can't explain the cost, the Agent can't spend the money." - Ledger
// This test verifies that sudden token usage spikes immediately trip the circuit breaker.
// -----------------------------------------------------------------------------

// Mock dependencies
vi.mock('@/services/firebase', () => ({
    auth: { currentUser: { uid: 'ledger-token-user' } },
    db: {},
    storage: {},
    functions: { region: vi.fn(() => ({ httpsCallable: vi.fn() })) },
    functionsWest1: { region: vi.fn(() => ({ httpsCallable: vi.fn() })) },
    remoteConfig: { defaultConfig: {}, fetchAndActivate: vi.fn(() => Promise.resolve()), getValue: vi.fn(() => ({ asString: () => '', asBoolean: () => false, asNumber: () => 0 })) },
    getFirebaseAI: vi.fn(() => ({})),
    app: { options: {} },
    appCheck: { getToken: vi.fn(() => Promise.resolve({ token: 'mock-token' })) },
    messaging: { getToken: vi.fn() }
}));

vi.mock('firebase/functions', () => ({
    getFunctions: vi.fn(),
    httpsCallable: vi.fn()
}));

vi.mock('@/services/cache/CacheService', () => ({
    cacheService: {
        get: vi.fn().mockReturnValue(null), // Always miss cache to force backend call
        set: vi.fn(),
        invalidate: vi.fn(),
        invalidatePattern: vi.fn()
    }
}));

describe('SubscriptionService (Token Circuit Breaker)', () => {
    let subscriptionService: SubscriptionService;
    const mockHttpsCallable = vi.mocked(httpsCallable);

    beforeEach(() => {
        vi.clearAllMocks();
        subscriptionService = new SubscriptionService();
    });

    // Helper to generate schema-compliant usage stats
    const createUsageStats = (tokensUsed: number, tokenLimit: number = 10000) => ({
        tier: SubscriptionTier.FREE,
        resetDate: Date.now() + 86400000,
        // Chat tokens (Focus of this test)
        aiChatTokensUsed: tokensUsed,
        aiChatTokensRemaining: Math.max(0, tokenLimit - tokensUsed),
        aiChatTokensPerMonth: tokenLimit,
        // Other required fields (Defaulted)
        imagesGenerated: 0,
        imagesRemaining: 5,
        imagesPerMonth: 5,
        videoDurationSeconds: 0,
        videoDurationMinutes: 0,
        videoRemainingMinutes: 5,
        videoTotalMinutes: 5,
        storageUsedGB: 0,
        storageRemainingGB: 1,
        storageTotalGB: 1,
        projectsCreated: 0,
        projectsRemaining: 3,
        maxProjects: 3,
        teamMembersUsed: 0,
        teamMembersRemaining: 1,
        maxTeamMembers: 1
    });

    it('💸 "Token Circuit Breaker": Detects sudden high token usage and immediately blocks next request', async () => {
        // 1. Setup: Define a user limit and start with 0 usage.
        const TOKEN_LIMIT = 10000;
        let currentTokensUsed = 0;

        // Mock the backend to return dynamic usage
        mockHttpsCallable.mockImplementation((_functions: any, name: string) => {
            if (name === 'getSubscription') {
                const fn = async () => ({
                    data: {
                        id: 'sub_123',
                        userId: 'ledger-token-user',
                        tier: SubscriptionTier.FREE,
                        status: 'active',
                        currentPeriodStart: Date.now(),
                        currentPeriodEnd: Date.now() + 86400000,
                        cancelAtPeriodEnd: false,
                        createdAt: Date.now(),
                        updatedAt: Date.now()
                    }
                });
                return fn as unknown as ReturnType<typeof httpsCallable>;
            }
            if (name === 'getUsageStats') {
                const fn = async () => ({
                    data: createUsageStats(currentTokensUsed, TOKEN_LIMIT)
                });
                return fn as unknown as ReturnType<typeof httpsCallable>;
            }
            const dfn = async () => ({ data: {} });
            return dfn as unknown as ReturnType<typeof httpsCallable>;
        });

        // 2. Initial Check: User has 0 usage. Should be allowed.
        console.log(`💸 [Ledger] Initial Check. Used: ${currentTokensUsed}/${TOKEN_LIMIT}`);
        const check1 = await subscriptionService.canPerformAction('chat', 100);
        expect(check1.allowed).toBe(true);

        // 3. Inject "Fake High Usage": Simulate a massive spike (e.g., a runaway agent loop or huge context).
        // The user supposedly generated 12,000 tokens worth of text in one go.
        console.log(`💸 [Ledger] Injecting FAKE HIGH USAGE spike...`);
        currentTokensUsed = 12000;

        // Simulate the system invalidating cache after the operation
        // (This is critical: Ledger demands real-time awareness)
        subscriptionService.invalidateUsageCache('ledger-token-user');

        // 4. Circuit Breaker Check: Attempt another small action.
        console.log(`💸 [Ledger] Post-Spike Check. Used: ${currentTokensUsed}/${TOKEN_LIMIT}`);
        const check2 = await subscriptionService.canPerformAction('chat', 100);

        // 5. Verification
        if (!check2.allowed) {
            console.log(`   🛑 STOP SWITCH ACTIVATED! Reason: ${check2.reason}`);
        }

        expect(check2.allowed).toBe(false);
        expect(check2.reason).toContain('AI chat token quota exceeded');
        expect(check2.upgradeRequired).toBe(true);
        expect(check2.currentUsage?.used).toBe(12000);
        expect(check2.currentUsage?.remaining).toBe(0);
    });
});
