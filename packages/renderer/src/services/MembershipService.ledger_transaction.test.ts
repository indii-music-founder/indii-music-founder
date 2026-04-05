import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MembershipService } from './MembershipService';
import { getDoc, setDoc, updateDoc, increment } from 'firebase/firestore';

// -----------------------------------------------------------------------------
// LEDGER'S TEST SUITE: TRANSACTION INTEGRITY
// -----------------------------------------------------------------------------
// "Verify 'Wallet' Logic: Assert that starting a 'Video Generation' deducts
// the correct estimated credit from the user's local balance."
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
    increment: vi.fn((n) => ({ _type: 'increment', value: n })),
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

describe('MembershipService (Ledger Transaction Integrity)', () => {
    const MOCK_USER_ID = 'ledger-wallet-007';

    beforeEach(() => {
        vi.clearAllMocks();

        // Default Store State (Free Tier => $1.00 Limit)
        mockGetState.mockReturnValue({
            userProfile: { id: MOCK_USER_ID },
            organizations: [{ id: 'org-1', plan: 'free' }],
            currentOrganizationId: 'org-1'
        });
    });

    it('💸 "The Standard Transaction": Verifies correct credit deduction flow', async () => {
        // 1. Initial State: User has spent $0.50
        (getDoc as import("vitest").Mock).mockResolvedValue({
            exists: () => true,
            data: () => ({ totalSpend: 0.50 })
        });

        const TASK_COST = 0.20;

        // 2. Pre-flight Check (Check Budget)
        const budgetCheck = await MembershipService.checkBudget(TASK_COST);

        // Assert: Budget allows it
        expect(budgetCheck.allowed).toBe(true);
        // Remaining should be calculated against max (1.00) - current (0.50) = 0.50 available
        expect(budgetCheck.remainingBudget).toBe(0.50);

        // 3. Execution (Record Spend)
        // Simulate the "transaction commit"
        await MembershipService.recordSpend(MOCK_USER_ID, TASK_COST);

        // 4. Verification (Ledger Update)
        // Verify we called setDoc/updateDoc with the correct increment
        // Note: recordSpend uses setDoc with merge: true
        expect(setDoc).toHaveBeenCalledWith(
            'mock-doc-ref',
            expect.objectContaining({
                totalSpend: { _type: 'increment', value: TASK_COST }
            }),
            { merge: true }
        );

        console.log(`   ✅ Transaction Verified: $${TASK_COST} deducted from wallet.`);
    });

    it('💸 "The Hard Limit Rejection": Aborts transaction when funds are insufficient', async () => {
        // 1. Initial State: User has spent $0.90
        (getDoc as import("vitest").Mock).mockResolvedValue({
            exists: () => true,
            data: () => ({ totalSpend: 0.90 })
        });

        const TASK_COST = 0.20; // 0.90 + 0.20 = 1.10 (Exceeds $1.00 limit)

        // 2. Attempt Transaction
        const budgetCheck = await MembershipService.checkBudget(TASK_COST);

        // 3. Assert Rejection
        expect(budgetCheck.allowed).toBe(false);

        // 4. Assert Prevention
        // We ensure recordSpend was NOT called (implied by flow control in real app,
        // but here we verify the gatekeeper returns false)

        // If we were simulating the full flow:
        if (budgetCheck.allowed) {
            await MembershipService.recordSpend(MOCK_USER_ID, TASK_COST);
        }

        expect(setDoc).not.toHaveBeenCalled();
        console.log(`   🛑 Transaction Aborted: Insufficient funds.`);
    });

    it('💸 "Fake High Usage Injection": Triggers Stop Switch immediately', async () => {
        // "Mock Token Usage: Inject 'Fake High Usage' metadata into the response
        // to test if the 'Stop' switch triggers."

        // 1. Inject Fake High Usage
        // Pretend the DB returns a massive number of generated videos
        const FAKE_HIGH_USAGE = 999999;

        (getDoc as import("vitest").Mock).mockResolvedValue({
            exists: () => true,
            data: () => ({
                videosGenerated: FAKE_HIGH_USAGE,
                updatedAt: Date.now()
            })
        });

        // 2. Attempt to check quota
        const result = await MembershipService.checkQuota('video', 1);

        // 3. Assert Stop Switch
        expect(result.allowed).toBe(false);
        expect(result.currentUsage).toBe(FAKE_HIGH_USAGE);

        console.log(`   🛑 Stop Switch Triggered: Detected High Usage (${FAKE_HIGH_USAGE}).`);
    });
});
