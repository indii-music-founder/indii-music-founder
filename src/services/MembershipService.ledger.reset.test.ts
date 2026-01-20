
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MembershipService } from './MembershipService';

// -----------------------------------------------------------------------------
// LEDGER'S TEST SUITE: "THE QUOTA RESET"
// -----------------------------------------------------------------------------
// "Ensuring daily free limits reset correctly at midnight"
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
        const processedUpdates: any = {};
        for (const [key, value] of Object.entries(updates)) {
            if (value && typeof value === 'object' && (value as any)._type === 'increment') {
                const currentVal = (current[key] || 0) as number;
                const newVal = currentVal + (value as any).value;
                processedUpdates[key] = parseFloat(newVal.toFixed(2));
            } else {
                processedUpdates[key] = value;
            }
        }
        MOCK_DB[ref as string] = { ...current, ...processedUpdates };
    }),
    increment: vi.fn((n) => ({ _type: 'increment', value: n })),
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

describe('MembershipService (Ledger Quota Reset)', () => {
    const MOCK_USER_ID = 'ledger-reset-001';

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

        // Enable fake timers
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('💸 "The Quota Reset": Ensures daily free limits reset correctly at midnight', async () => {
        // 1. Start on "Day 1" (e.g., 2024-01-01)
        const day1 = new Date('2024-01-01T12:00:00Z');
        vi.setSystemTime(day1);
        const day1Key = '2024-01-01';

        console.log(`\n💸 [Ledger] Starting "Quota Reset" Simulation on ${day1Key}...`);

        // 2. Consume Quota to the Limit
        // Free tier has 5 video generations per day
        const MAX_VIDEOS = 5;

        console.log(`💸 [Ledger] Consuming full quota on Day 1...`);
        for (let i = 0; i < MAX_VIDEOS; i++) {
            await MembershipService.incrementUsage(MOCK_USER_ID, 'video', 1);
        }

        // Verify Usage on Day 1
        const day1Usage = await MembershipService.getDailyUsage(MOCK_USER_ID);
        expect(day1Usage.videosGenerated).toBe(MAX_VIDEOS);
        expect(MOCK_DB[`users/${MOCK_USER_ID}/usage/${day1Key}`].videosGenerated).toBe(MAX_VIDEOS);

        // Verify Quota is Reached (Should be disallowed)
        const quotaCheckDay1 = await MembershipService.checkQuota('video', 1);
        expect(quotaCheckDay1.allowed).toBe(false);
        console.log(`   ✅ Day 1 Quota correctly enforced (Blocked).`);

        // 3. The "Midnight" Event (Switch to Day 2)
        const day2 = new Date('2024-01-02T00:00:01Z');
        vi.setSystemTime(day2);
        const day2Key = '2024-01-02';

        console.log(`💸 [Ledger] 🕛 MIDNIGHT STRIKES! Clock is now ${day2Key}...`);

        // 4. Verify Quota Reset
        // New day = New usage document (not yet created, effectively 0)
        const quotaCheckDay2 = await MembershipService.checkQuota('video', 1);

        expect(quotaCheckDay2.allowed).toBe(true);
        expect(quotaCheckDay2.currentUsage).toBe(0);
        console.log(`   ✅ Day 2 Quota reset successful (Allowed).`);

        // 5. Consume One unit on Day 2
        await MembershipService.incrementUsage(MOCK_USER_ID, 'video', 1);

        // 6. Verify Day 2 Usage updated
        const day2Usage = await MembershipService.getDailyUsage(MOCK_USER_ID);
        expect(day2Usage.videosGenerated).toBe(1);
        expect(MOCK_DB[`users/${MOCK_USER_ID}/usage/${day2Key}`].videosGenerated).toBe(1);

        // 7. Verify Day 1 Record is preserved (Audit Trail)
        // Ledger: "If the Agent can't explain the cost..." - Audit trail must remain.
        expect(MOCK_DB[`users/${MOCK_USER_ID}/usage/${day1Key}`]).toBeDefined();
        expect(MOCK_DB[`users/${MOCK_USER_ID}/usage/${day1Key}`].videosGenerated).toBe(MAX_VIDEOS);
        console.log(`   ✅ Day 1 Audit Trail preserved.`);
    });
});
