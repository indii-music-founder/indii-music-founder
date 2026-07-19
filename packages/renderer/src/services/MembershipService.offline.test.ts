import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
vi.unmock('@/services/MembershipService');
import { MembershipService } from './MembershipService';
import { getDoc, setDoc } from 'firebase/firestore';



// Mock Firebase services
vi.mock('@/services/firebase', () => ({
    db: {},
    auth: { currentUser: { uid: 'test-user', email: 'test@example.com' } },
    storage: {},
    functions: { region: vi.fn(() => ({ httpsCallable: vi.fn() })) },
    app: { options: {} },
}));

// Mock Firestore SDK
vi.mock('firebase/firestore', () => ({
    doc: vi.fn(() => 'mock-doc-ref'),
    getDoc: vi.fn(),
    setDoc: vi.fn(),
    updateDoc: vi.fn(),
    increment: vi.fn((val) => val),
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

describe('MembershipService (Offline Budget Gates - ISSUE-049)', () => {
    const MOCK_USER_ID = 'offline-test-user';
    let originalNavigator: any;

    beforeEach(() => {
        vi.clearAllMocks();

        // Save original navigator
        originalNavigator = global.navigator;

        // Default to pro plan ($10 limit)
        mockGetState.mockReturnValue({
            userProfile: { id: MOCK_USER_ID },
            organizations: [{ id: 'org-1', plan: 'pro' }],
            currentOrganizationId: 'org-1'
        });

        // Reset sessionSpend accumulator before each test run
        (MembershipService as any).sessionSpend = 0;

        // Clear local storage
        if (typeof window !== 'undefined' && window.localStorage) {
            window.localStorage.clear();
        }
    });

    afterEach(() => {
        global.navigator = originalNavigator;
    });

    const setOfflineMode = (offline: boolean) => {
        global.navigator = {
            onLine: !offline,
        } as any;
    };

    it('🔒 Offline Budget Gate - Local Storage Accumulation', async () => {
        setOfflineMode(true);

        // Record offline spend
        await MembershipService.recordSpend(MOCK_USER_ID, 2.50);

        // Verify it didn't call setDoc on Firestore
        expect(setDoc).not.toHaveBeenCalled();

        // Verify it accumulated locally
        expect(MembershipService.getLocalOfflineSpend()).toBe(2.50);

        // Check budget for another $5 operation - allowed since total is $7.50 / $10
        const firstCheck = await MembershipService.checkBudget(5.00);
        expect(firstCheck.allowed).toBe(true);

        // Record the second operation
        await MembershipService.recordSpend(MOCK_USER_ID, 5.00);
        expect(MembershipService.getLocalOfflineSpend()).toBe(7.50);

        // Check budget for another $5 operation - denied since total $12.50 exceeds $10 cap
        const secondCheck = await MembershipService.checkBudget(5.00);
        expect(secondCheck.allowed).toBe(false);
        expect(secondCheck.remainingBudget).toBe(2.50);
    });

    it('🔒 Offline Spend Sync - Flushes back to Firestore when transition back online', async () => {
        // Accumulate spend offline
        setOfflineMode(true);
        await MembershipService.recordSpend(MOCK_USER_ID, 4.00);
        expect(MembershipService.getLocalOfflineSpend()).toBe(4.00);

        // Transition online
        setOfflineMode(false);

        // Mock getDailyUsage return
        (getDoc as any).mockResolvedValue({
            exists: () => true,
            data: () => ({ totalSpend: 4.00 })
        });

        // Trigger budget check which automatically triggers the sync
        const checkResult = await MembershipService.checkBudget(1.00);

        // Assert sync was called
        expect(setDoc).toHaveBeenCalledWith('mock-doc-ref', expect.objectContaining({
            totalSpend: 4.00
        }), { merge: true });

        // Assert local offline spend has been cleared
        expect(MembershipService.getLocalOfflineSpend()).toBe(0);
        expect(checkResult.allowed).toBe(true);
    });
});
