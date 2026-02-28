
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MembershipService } from './MembershipService';
import { getDoc, setDoc, updateDoc, increment } from 'firebase/firestore';

// -----------------------------------------------------------------------------
// LEDGER'S MISSION: BUDGET ALERTS & HIGH USAGE INJECTION
// -----------------------------------------------------------------------------
// "If the Agent can't explain the cost, the Agent can't spend the money."
//
// This test verifies:
// 1. "Mock Token Usage": Injecting a "Fake High Usage" event.
// 2. "Wallet Logic": Ensuring the spend is recorded against the user's balance.
// 3. "Circuit Breaker": Asserting the NEXT action is blocked (Stop Switch).
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

// Stateful Mock for Firestore (The "Ledger")
const MOCK_DB: Record<string, any> = {};

vi.mock('firebase/firestore', () => ({
    doc: vi.fn((db, col, uid, subcol, date) => `users/${uid}/${subcol}/${date}`),
    getDoc: vi.fn(async (ref) => {
        const data = MOCK_DB[ref as string];
        return {
            exists: () => !!data,
            data: () => data
        };
    }),
    setDoc: vi.fn(async (ref, data, options) => {
        const key = ref as string;
        if (options?.merge) {
            const current = MOCK_DB[key] || {};
            const processedUpdates: any = {};
            for (const [k, v] of Object.entries(data)) {
                if (v && typeof v === 'object' && (v as any)._type === 'increment') {
                    const currentVal = (current[k] || 0) as number;
                    const newVal = currentVal + (v as any).value;
                    processedUpdates[k] = parseFloat(newVal.toFixed(2));
                } else {
                    processedUpdates[k] = v;
                }
            }
            MOCK_DB[key] = { ...current, ...processedUpdates };
        } else {
            MOCK_DB[key] = data;
        }
    }),
    updateDoc: vi.fn(), // Not used in this specific test flow (we use setDoc with merge)
    increment: vi.fn((n) => ({ _type: 'increment', value: n })),
    FieldValue: { serverTimestamp: vi.fn() }
}));

// Mock Store
const mockGetState = vi.fn();
vi.mock('@/core/store', () => ({
    useStore: {
        getState: () => mockGetState()
    }
}));

describe('MembershipService (Ledger Alerts)', () => {
    const MOCK_USER_ID = 'ledger-alert-user';
    const TODAY = new Date().toISOString().split('T')[0];
    const USAGE_DOC_REF = `users/${MOCK_USER_ID}/usage/${TODAY}`;

    beforeEach(() => {
        vi.clearAllMocks();
        // Clear Ledger
        for (const key in MOCK_DB) delete MOCK_DB[key];

        // Default: Free Tier ($1.00 Limit)
        mockGetState.mockReturnValue({
            userProfile: { id: MOCK_USER_ID },
            organizations: [{ id: 'org-1', plan: 'free' }],
            currentOrganizationId: 'org-1'
        });
    });

    it('💸 "High Usage Injection": Triggers Stop Switch when Token Usage spikes', async () => {
        // 1. Initial State: Wallet is empty ($0.00 spent)
        console.log('\n💸 [Ledger] Starting "High Usage" Simulation...');

        // Check Budget for a small task (Cost $0.05) - Should pass
        const initialCheck = await MembershipService.checkBudget(0.05);
        expect(initialCheck.allowed).toBe(true);
        expect(initialCheck.remainingBudget).toBe(1.00);
        console.log('   ✅ Initial Status: Green Light (Budget: $1.00)');

        // 2. MOCK TOKEN USAGE: Inject "Fake High Usage"
        // Scenario: Agent ran a "Deep Think" task that consumed massive tokens.
        // Cost: $0.98
        const FAKE_HIGH_USAGE_COST = 0.98;

        console.log(`   💸 Injecting "Deep Think" Cost: $${FAKE_HIGH_USAGE_COST}...`);

        // "Verify Wallet Logic": Assert that recording this spend updates the balance
        await MembershipService.recordSpend(MOCK_USER_ID, FAKE_HIGH_USAGE_COST);

        // Verify DB State
        expect(MOCK_DB[USAGE_DOC_REF]).toBeDefined();
        expect(MOCK_DB[USAGE_DOC_REF].totalSpend).toBe(FAKE_HIGH_USAGE_COST);
        console.log(`   ✅ Wallet Updated: Spent $${MOCK_DB[USAGE_DOC_REF].totalSpend.toFixed(2)}`);

        // 3. BUDGET ALERT / STOP SWITCH
        // Now try to run the small task again ($0.05).
        // $0.98 + $0.05 = $1.03 > $1.00 Limit.

        console.log('   💸 Attempting followup task (Cost: $0.05)...');
        const alertCheck = await MembershipService.checkBudget(0.05);

        // "Assert the system halts exactly when limit is breached"
        expect(alertCheck.allowed).toBe(false);
        expect(alertCheck.remainingBudget).toBeCloseTo(0.02); // $1.00 - $0.98 = $0.02 remaining

        console.log(`   🛑 STOP SWITCH ACTIVATED! Remaining: $${alertCheck.remainingBudget.toFixed(2)}`);
        console.log('   ✅ Test Passed: Ledger successfully blocked debt.');
    });

    it('💸 "Budget Alert": Detects "Near Limit" state correctly', async () => {
        // Test that we can detect when we are "in the danger zone" even if allowed.

        // Inject $0.90 spend (90% of budget)
        MOCK_DB[USAGE_DOC_REF] = { totalSpend: 0.90, updatedAt: Date.now() };

        // Check for $0.05 task
        const check = await MembershipService.checkBudget(0.05);

        expect(check.allowed).toBe(true);
        expect(check.remainingBudget).toBeCloseTo(0.10); // $1.00 - $0.90

        // In a real UI, this low remainingBudget would trigger a yellow/red alert
        if (check.remainingBudget < 0.20) {
             console.log(`   ⚠️ BUDGET ALERT: Low Funds! Only $${check.remainingBudget.toFixed(2)} left.`);
        }
    });
});
