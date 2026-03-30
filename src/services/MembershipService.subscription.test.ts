
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MembershipService } from './MembershipService';
import { getDoc } from 'firebase/firestore';

// -----------------------------------------------------------------------------
// LEDGER'S TEST SUITE: SUBSCRIPTION GATES & VEO 3.1
// -----------------------------------------------------------------------------
// "Check Subscription Gates: Verify that 'Pro' features (Veo 3.1) fail
// gracefully for 'Free Tier' users."
// -----------------------------------------------------------------------------

// Mock Firebase services
vi.mock('@/services/firebase', () => ({
    db: {},
    auth: { currentUser: { uid: 'test-user', email: 'test@example.com' }, onAuthStateChanged: vi.fn(), signInWithEmailAndPassword: vi.fn(), createUserWithEmailAndPassword: vi.fn(), signOut: vi.fn() },
    storage: {},
    functions: { region: vi.fn(() => ({ httpsCallable: vi.fn() })) },
    functionsWest1: { region: vi.fn(() => ({ httpsCallable: vi.fn() })) },
    remoteConfig: { defaultConfig: {}, fetchAndActivate: vi.fn(() => Promise.resolve()), getValue: vi.fn(() => ({ asString: () => '', asBoolean: () => false, asNumber: () => 0 })) },
    getFirebaseAI: vi.fn(() => ({})),
    app: { options: {} },
    appCheck: { getToken: vi.fn(() => Promise.resolve({ token: 'mock-token' })) },
    messaging: { getToken: vi.fn() }
}));

// Mock Firestore SDK
vi.mock('firebase/firestore', () => ({
    doc: vi.fn(() => 'mock-doc-ref'),
    getDoc: vi.fn(),
    setDoc: vi.fn(),
    updateDoc: vi.fn(),
    increment: vi.fn(),
    FieldValue: { serverTimestamp: vi.fn() },
    query: vi.fn(),
    collection: vi.fn(),
    where: vi.fn(),
    getCountFromServer: vi.fn()
}));

// Mock Store for User ID and Tier
const mockGetState = vi.fn();
vi.mock('@/core/store', () => ({
    useStore: {
        getState: () => mockGetState()
    }
}));

describe('MembershipService (Ledger Subscription Gates)', () => {
    const MOCK_USER_ID = 'ledger-gate-keeper';

    beforeEach(() => {
        vi.clearAllMocks();

        // Default: Free Tier
        mockGetState.mockReturnValue({
            userProfile: { id: MOCK_USER_ID },
            organizations: [{ id: 'org-1', plan: 'free' }],
            currentOrganizationId: 'org-1'
        });

        // Default: No usage
        vi.mocked(getDoc).mockResolvedValue({
            exists: () => false
        } as Awaited<ReturnType<typeof getDoc>>);
    });

    it('💸 "Veo 3.1 Duration Gate": Blocks Free users from Long Form generation', async () => {
        // Veo 3.1 capable of long form content.
        // Free Tier Limit: 8 minutes (480s)
        const VEO_LONG_FORM_DURATION = 10 * 60; // 600s

        const result = await MembershipService.checkVideoDurationQuota(VEO_LONG_FORM_DURATION);

        // 1. Assert Access Denied
        expect(result.allowed).toBe(false);

        // 2. Assert "Graceful Failure" Metadata
        // The UI needs these values to show the "Upgrade to Pro" modal.
        expect(result.tierName).toBe('Free');
        expect(result.maxDuration).toBe(480);
    });

    it('💸 "Pro Access": Allows Veo 3.1 Long Form generation for Pro users', async () => {
        // Switch to Pro
        mockGetState.mockReturnValue({
            userProfile: { id: MOCK_USER_ID },
            organizations: [{ id: 'org-1', plan: 'pro' }],
            currentOrganizationId: 'org-1'
        });

        const VEO_LONG_FORM_DURATION = 10 * 60; // 600s

        const result = await MembershipService.checkVideoDurationQuota(VEO_LONG_FORM_DURATION);

        // Assert Access Granted
        expect(result.allowed).toBe(true);
        expect(result.maxDuration).toBe(3600); // Pro limit is 60 mins
    });

    it('💸 "Feature Lock": Ensures Advanced Editing (Veo Control) is disabled for Free Tier', async () => {
        // "Verify that 'Pro' features ... fail gracefully"
        // Advanced Editing is a proxy for granular Veo controls (masks, keyframes)

        const canUseAdvanced = MembershipService.canUseFeature('free', 'hasAdvancedEditing');
        const canUseCustomBranding = MembershipService.canUseFeature('free', 'hasCustomBranding');

        expect(canUseAdvanced).toBe(false);
        expect(canUseCustomBranding).toBe(false);
    });

    it('💸 "Upgrade Path": Provides actionable upsell message for blocked features', async () => {
        const message = MembershipService.getUpgradeMessage('free', 'video');
        expect(message).toContain('Upgrade to Pro');
        expect(message).toContain('longer video durations');
    });

    it('💸 "Enterprise Scale": Allows Cinematic Duration (4 Hours)', async () => {
        // Switch to Enterprise
        mockGetState.mockReturnValue({
            userProfile: { id: MOCK_USER_ID },
            organizations: [{ id: 'org-1', plan: 'enterprise' }],
            currentOrganizationId: 'org-1'
        });

        const CINEMATIC_DURATION = 3.5 * 60 * 60; // 3.5 Hours

        const result = await MembershipService.checkVideoDurationQuota(CINEMATIC_DURATION);

        expect(result.allowed).toBe(true);
        expect(result.maxDuration).toBe(4 * 60 * 60); // 14400s
    });
});
