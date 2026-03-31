
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MembershipService } from './MembershipService';
import { getDoc } from 'firebase/firestore';

// -----------------------------------------------------------------------------
// LEDGER'S TEST SUITE: APPROVAL GATES
// -----------------------------------------------------------------------------
// "The user must approve every charge over $0.50."
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

// Mock Store
const mockGetState = vi.fn();
vi.mock('@/core/store', () => ({
    useStore: {
        getState: () => mockGetState()
    }
}));

describe('MembershipService (Ledger Approval Gates)', () => {
    const MOCK_USER_ID = 'ledger-approver-001';

    beforeEach(() => {
        vi.clearAllMocks();

        // Default: Free Tier ($1.00 Limit)
        mockGetState.mockReturnValue({
            userProfile: { id: MOCK_USER_ID },
            organizations: [{ id: 'org-1', plan: 'free' }],
            currentOrganizationId: 'org-1'
        });

        // Default: No usage
        (getDoc as import("vitest").Mock).mockResolvedValue({
            exists: () => false
        });
    });

    it('💸 "Micro-Transaction": allows small charges without approval', async () => {
        // Charge: $0.10 (< $0.50)
        const COST = 0.10;

        const result = await MembershipService.checkBudget(COST);

        expect(result.allowed).toBe(true);
        expect(result.requiresApproval).toBe(false);
        console.log(`   ✅ Micro-transaction ($${COST}) approved automatically.`);
    });

    it('💸 "Major Purchase": flags expensive charges for user approval', async () => {
        // Charge: $0.60 (> $0.50)
        const COST = 0.60;

        const result = await MembershipService.checkBudget(COST);

        expect(result.allowed).toBe(true); // Within $1.00 budget
        expect(result.requiresApproval).toBe(true); // BUT requires approval
        console.log(`   ⚠️ Major purchase ($${COST}) flagged for user approval.`);
    });

    it('💸 "Ledger Logic": Ensures approval is flagged even if budget permits', async () => {
         // Switch to Pro ($10.00 Limit) so budget is definitely not an issue
         mockGetState.mockReturnValue({
            userProfile: { id: MOCK_USER_ID },
            organizations: [{ id: 'org-1', plan: 'pro' }],
            currentOrganizationId: 'org-1'
        });

        const COST = 5.00; // Well within $10.00 budget, but > $0.50

        const result = await MembershipService.checkBudget(COST);

        expect(result.allowed).toBe(true);
        expect(result.requiresApproval).toBe(true);
        console.log(`   ⚠️ High-value transaction ($${COST}) requires sign-off despite sufficient funds.`);
    });

    it('💸 "Threshold Edge Case": Exactly $0.50 does not require approval', async () => {
        const COST = 0.50;

        const result = await MembershipService.checkBudget(COST);

        expect(result.allowed).toBe(true);
        expect(result.requiresApproval).toBe(false);
    });
});
