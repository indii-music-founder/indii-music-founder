
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MembershipService } from './MembershipService';
import { getDoc, setDoc, updateDoc, increment } from 'firebase/firestore';

// -----------------------------------------------------------------------------
// LEDGER'S TEST SUITE: COST CIRCUIT BREAKER
// -----------------------------------------------------------------------------
// "An infinite loop is an infinite bill." - Ledger
// This test simulates a runaway agent process and verifies the system halts
// exactly when the budget (quota) is exhausted.
// -----------------------------------------------------------------------------

// Mock Firebase services
vi.mock('@/services/firebase', () => ({
    db: {}
}));

// Stateful Mock for Firestore
// We need a real "Memory DB" to test the loop interaction
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
    setDoc: vi.fn(async (ref, data) => {
        MOCK_DB[ref as string] = data;
    }),
    updateDoc: vi.fn(async (ref, updates) => {
        const current = MOCK_DB[ref as string] || {};

        // Handle "increment" logic manually for the mock
        const processedUpdates: any = {};
        for (const [key, value] of Object.entries(updates)) {
            if (value && typeof value === 'object' && (value as any)._type === 'increment') {
                const currentVal = (current[key] || 0) as number;
                processedUpdates[key] = currentVal + (value as any).value;
            } else {
                processedUpdates[key] = value;
            }
        }

        MOCK_DB[ref as string] = { ...current, ...processedUpdates };
    }),
    increment: vi.fn((n) => ({ _type: 'increment', value: n })),
    FieldValue: { serverTimestamp: vi.fn() }
}));

// Mock Store for User ID and Tier
const mockGetState = vi.fn();
vi.mock('@/core/store', () => ({
    useStore: {
        getState: () => mockGetState()
    }
}));

describe('MembershipService (Ledger Circuit Breaker)', () => {
    const MOCK_USER_ID = 'ledger-agent-007';

    beforeEach(() => {
        vi.clearAllMocks();

        // Clear Mock DB
        for (const key in MOCK_DB) delete MOCK_DB[key];

        // Default Store State (Free Tier)
        mockGetState.mockReturnValue({
            userProfile: { id: MOCK_USER_ID },
            organizations: [{ id: 'org-1', plan: 'free' }],
            currentOrganizationId: 'org-1'
        });
    });

    it('💸 "Circuit Breaker": Halts a runaway loop exactly at the quota limit', async () => {
        // 1. Setup: Free Tier (Limit 5 videos)
        // We start with 0 usage.

        const ATTEMPTED_GENERATIONS = 10;
        const EXPECTED_LIMIT = 5;
        let successfulGenerations = 0;
        let haltedAt = -1;

        console.log('\n💸 [Ledger] Starting "Runaway Loop" Simulation...');
        console.log(`💸 [Ledger] Plan: ${ATTEMPTED_GENERATIONS} attempts | Limit: ${EXPECTED_LIMIT}`);

        for (let i = 0; i < ATTEMPTED_GENERATIONS; i++) {
            // A. Check Quota (The "Wallet Check")
            const quota = await MembershipService.checkQuota('video', 1);

            if (quota.allowed) {
                // B. Simulate "Charge" (Deducting Credit)
                await MembershipService.incrementUsage(MOCK_USER_ID, 'video', 1);
                successfulGenerations++;
                // console.log(`   ✅ Attempt ${i + 1}: Success. Usage: ${quota.currentUsage} -> ${quota.currentUsage + 1}`);
            } else {
                // C. Circuit Breaker Tripped!
                console.log(`   🛑 Attempt ${i + 1}: BLOCKED. Usage: ${quota.currentUsage}/${quota.maxAllowed}`);
                haltedAt = i;
                break;
            }
        }

        // 2. Verification
        console.log(`💸 [Ledger] Simulation Complete. Successes: ${successfulGenerations}`);

        // Assert that we stopped exactly when we hit the limit
        expect(successfulGenerations).toBe(EXPECTED_LIMIT);

        // Assert that the loop didn't run to completion (it broke early)
        expect(haltedAt).toBe(EXPECTED_LIMIT);

        // Verify the database state matches the limit
        const today = new Date().toISOString().split('T')[0];
        const docRef = `users/${MOCK_USER_ID}/usage/${today}`;
        expect(MOCK_DB[docRef].videosGenerated).toBe(EXPECTED_LIMIT);
    });

    it('💸 "Upsell Trigger": Returns correct maxAllowed when blocked', async () => {
        // Set usage to limit
        const today = new Date().toISOString().split('T')[0];
        const docRef = `users/${MOCK_USER_ID}/usage/${today}`;
        MOCK_DB[docRef] = { videosGenerated: 5, updatedAt: Date.now() };

        const quota = await MembershipService.checkQuota('video', 1);

        expect(quota.allowed).toBe(false);
        expect(quota.maxAllowed).toBe(5);
        // This ensures the UI can show "5/5 used"
    });
});
