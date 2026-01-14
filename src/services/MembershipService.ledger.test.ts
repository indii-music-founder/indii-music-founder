
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MembershipService } from './MembershipService';
import { getDoc, setDoc, updateDoc, increment } from 'firebase/firestore';

// -----------------------------------------------------------------------------
// LEDGER'S TEST SUITE: THE "HARD LIMIT"
// -----------------------------------------------------------------------------
// "If the Agent can't explain the cost, the Agent can't spend the money."
// -----------------------------------------------------------------------------

// Mock Firebase services
vi.mock('@/services/firebase', () => ({
    db: {}
}));

// Stateful Mock for Firestore
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
        if (options?.merge) {
            const current = MOCK_DB[ref as string] || {};
            const processedUpdates: any = {};
            for (const [key, value] of Object.entries(data)) {
                if (value && typeof value === 'object' && (value as any)._type === 'increment') {
                    const currentVal = (current[key] || 0) as number;
                    const newVal = currentVal + (value as any).value;
                    processedUpdates[key] = parseFloat(newVal.toFixed(2));
                } else {
                    processedUpdates[key] = value;
                }
            }
            MOCK_DB[ref as string] = { ...current, ...processedUpdates };
        } else {
            MOCK_DB[ref as string] = data;
        }
    }),
    updateDoc: vi.fn(async (ref, updates) => {
        const current = MOCK_DB[ref as string] || {};

        // Handle "increment" logic manually for the mock
        const processedUpdates: any = {};
        for (const [key, value] of Object.entries(updates)) {
            if (value && typeof value === 'object' && (value as any)._type === 'increment') {
                const currentVal = (current[key] || 0) as number;
                // Use parseFloat/toFixed to avoid floating point errors in mock
                const newVal = currentVal + (value as any).value;
                processedUpdates[key] = parseFloat(newVal.toFixed(2));
            } else {
                processedUpdates[key] = value;
            }
        }

        MOCK_DB[ref as string] = { ...current, ...processedUpdates };
    }),
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

describe('MembershipService (Ledger Budget Checks)', () => {
    const MOCK_USER_ID = 'ledger-budget-001';

    beforeEach(() => {
        vi.clearAllMocks();
        // Clear Mock DB
        for (const key in MOCK_DB) delete MOCK_DB[key];

        // Default Store State (Free Tier => $1.00 Limit)
        mockGetState.mockReturnValue({
            userProfile: { id: MOCK_USER_ID },
            organizations: [{ id: 'org-1', plan: 'free' }],
            currentOrganizationId: 'org-1'
        });
    });

    it('💸 "The Hard Limit": Halts a runaway loop exactly when budget is breached', async () => {
        // 1. Setup
        const COST_PER_ACTION = 0.10; // $0.10
        const BUDGET_LIMIT = 1.00;    // Free Tier Limit (Verified in TIER_LIMITS)
        const ATTEMPTED_LOOPS = 20;   // Try to spend $2.00

        let successfulActions = 0;
        let haltedAt = -1;

        console.log('\n💸 [Ledger] Starting "Hard Limit" Budget Simulation...');
        console.log(`💸 [Ledger] Cost: $${COST_PER_ACTION} | Budget: $${BUDGET_LIMIT}`);

        for (let i = 0; i < ATTEMPTED_LOOPS; i++) {
            // A. Check Budget (The "Wallet Check")
            const budgetCheck = await MembershipService.checkBudget(COST_PER_ACTION);

            if (budgetCheck.allowed) {
                // B. Spend the money (Record Spend)
                await MembershipService.recordSpend(MOCK_USER_ID, COST_PER_ACTION);
                successfulActions++;
                // console.log(`   ✅ Action ${i + 1}: Approved. Remaining: $${budgetCheck.remainingBudget.toFixed(2)}`);
            } else {
                // C. Circuit Breaker
                console.log(`   🛑 Action ${i + 1}: BLOCKED. Budget Exhausted.`);
                haltedAt = i;
                break;
            }
        }

        // 2. Verification
        const EXPECTED_SUCCESSES = 10; // 1.00 / 0.10 = 10

        console.log(`💸 [Ledger] Simulation Complete. Successes: ${successfulActions}`);

        // Assert we stopped exactly at the limit
        expect(successfulActions).toBe(EXPECTED_SUCCESSES);
        expect(haltedAt).toBe(EXPECTED_SUCCESSES);

        // Verify the Ledger (Database State)
        const today = new Date().toISOString().split('T')[0];
        const docRef = `users/${MOCK_USER_ID}/usage/${today}`;

        // Assert total spend is exactly 1.00
        expect(MOCK_DB[docRef].totalSpend).toBe(BUDGET_LIMIT);

        // Verify we cannot spend even a penny more
        const finalCheck = await MembershipService.checkBudget(0.01);
        expect(finalCheck.allowed).toBe(false);
    });

    it('💸 "Pro Upgrade": Allows higher spending', async () => {
        // Switch to Pro ($10.00 Limit)
        mockGetState.mockReturnValue({
            userProfile: { id: MOCK_USER_ID },
            organizations: [{ id: 'org-1', plan: 'pro' }],
            currentOrganizationId: 'org-1'
        });

        // Set current spend to $2.00 (Over Free, Under Pro)
        const today = new Date().toISOString().split('T')[0];
        const docRef = `users/${MOCK_USER_ID}/usage/${today}`;
        MOCK_DB[docRef] = { totalSpend: 2.00, updatedAt: Date.now() };

        const budgetCheck = await MembershipService.checkBudget(5.00); // Spend another $5

        expect(budgetCheck.allowed).toBe(true);
        expect(budgetCheck.remainingBudget).toBe(8.00); // 10 - 2 = 8
    });
});
