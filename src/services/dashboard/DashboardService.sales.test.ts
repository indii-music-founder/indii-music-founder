import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DashboardService } from './DashboardService';
import { SalesAnalyticsSchema, SalesAnalyticsData } from './schema';

// Mock the store
vi.mock('@/core/store', () => ({
    serverTimestamp: vi.fn(),
    useStore: {
        getState: vi.fn()
    }
}));

// Mock Firebase
vi.mock('@/services/firebase', () => ({
    serverTimestamp: vi.fn(),
    db: {},
    auth: {
        currentUser: { uid: 'test-user', email: 'test@example.com' }
    },
    storage: {},
    functions: { region: vi.fn(() => ({ httpsCallable: vi.fn() })) },
    functionsWest1: { region: vi.fn(() => ({ httpsCallable: vi.fn() })) },
    remoteConfig: { defaultConfig: {}, fetchAndActivate: vi.fn(() => Promise.resolve()), getValue: vi.fn(() => ({ asString: () => '', asBoolean: () => false, asNumber: () => 0 })) },
    getFirebaseAI: vi.fn(() => ({})),
    app: { options: {} },
    appCheck: { getToken: vi.fn(() => Promise.resolve({ token: 'mock-token' })) },
    messaging: { getToken: vi.fn() }
}));

vi.mock('firebase/firestore', () => ({
    serverTimestamp: vi.fn(),
    doc: vi.fn(),
    getDoc: vi.fn(),
    getDocs: vi.fn(),
    collection: vi.fn(),
    query: vi.fn(),
    where: vi.fn(),
    deleteDoc: vi.fn()
}));

describe('DashboardService - Sales Analytics', () => {

    const validSalesData: SalesAnalyticsData = {
        conversionRate: { value: 5.5, change: 1.0, trend: 'up', formatted: '5.5%' },
        totalVisitors: { value: 20000, change: 15, trend: 'up', formatted: '20k' },
        clickRate: { value: 25.0, change: 2, trend: 'up', formatted: '25.0%' },
        avgOrderValue: { value: 50.00, change: 5, trend: 'up', formatted: '$50.00' },
        revenueChart: [100, 200, 150, 300],
        period: '30d',
        lastUpdated: 1234567890
    };

    beforeEach(() => {
        vi.clearAllMocks();
        // Default console mocks to keep test output clean
        vi.spyOn(console, 'warn').mockImplementation(() => { });
        vi.spyOn(console, 'error').mockImplementation(() => { });
        DashboardService.resetCache();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('should return data from Firestore when it is valid', async () => {
        const { useStore } = await import('@/core/store');
        const { getDoc } = await import('firebase/firestore');

        // Mock User
        (useStore.getState as any).mockReturnValue({
            userProfile: { id: 'test-user-id' }
        });

        // Mock Firestore Response
        (getDoc as any).mockResolvedValue({
            exists: () => true,
            data: () => validSalesData
        });

        const result = await DashboardService.getSalesAnalytics();

        expect(result).toEqual(validSalesData);
        expect(getDoc).toHaveBeenCalled();
    });

    it('should return fallback data when Firestore data is invalid (schema mismatch)', async () => {
        const { useStore } = await import('@/core/store');
        const { getDoc } = await import('firebase/firestore');

        (useStore.getState as any).mockReturnValue({
            userProfile: { id: 'test-user-id' }
        });

        // Invalid data: missing 'totalVisitors'
        const invalidData = {
            conversionRate: { value: 5.5, change: 1.0, trend: 'up', formatted: '5.5%' },
            // totalVisitors MISSING
            clickRate: { value: 25.0, change: 2, trend: 'up', formatted: '25.0%' },
            avgOrderValue: { value: 50.00, change: 5, trend: 'up', formatted: '$50.00' },
            revenueChart: [100, 200, 150, 300],
            period: '30d'
        };

        (getDoc as any).mockResolvedValue({
            exists: () => true,
            data: () => invalidData
        });

        const result = await DashboardService.getSalesAnalytics();

        // Should verify it is NOT the invalid data
        expect(result).not.toEqual(invalidData);

        // It should be the fallback data
        // We can verify a specific property known to be in the fallback but not in our mock invalid data just to be sure
        // But better yet, check that it logged a warning
        expect(console.warn).toHaveBeenCalledWith(
            "[Dashboard] Firestore data failed schema validation:",
            expect.anything()
        );

        // And verify the returned result IS valid schema
        const check = SalesAnalyticsSchema.safeParse(result);
        expect(check.success).toBe(true);
    });

    it('should return fallback data when Firestore throws an error', async () => {
        const { useStore } = await import('@/core/store');
        const { getDoc } = await import('firebase/firestore');

        (useStore.getState as any).mockReturnValue({
            userProfile: { id: 'test-user-id' }
        });

        (getDoc as any).mockRejectedValue(new Error("Connection failed"));

        const result = await DashboardService.getSalesAnalytics();

        expect(console.warn).toHaveBeenCalledWith(
            "[Dashboard] Firestore fetch failed:",
            expect.any(Error)
        );

        // Verify result is valid schema (fallback)
        const check = SalesAnalyticsSchema.safeParse(result);
        expect(check.success).toBe(true);
    });

    it('should return fallback data when no user is logged in', async () => {
        const { useStore } = await import('@/core/store');
        const { getDoc } = await import('firebase/firestore');

        (useStore.getState as any).mockReturnValue({
            userProfile: null
        });

        const result = await DashboardService.getSalesAnalytics();

        // Should not even try to fetch
        expect(getDoc).not.toHaveBeenCalled();

        // Verify result is valid schema (fallback)
        const check = SalesAnalyticsSchema.safeParse(result);
        expect(check.success).toBe(true);
    });

    it('should ensure the hardcoded fallback data itself complies with the schema', async () => {
        // Force fallback by having no user
        const { useStore } = await import('@/core/store');
        (useStore.getState as any).mockReturnValue({ userProfile: null });

        const result = await DashboardService.getSalesAnalytics();

        const parseResult = SalesAnalyticsSchema.safeParse(result);
        if (!parseResult.success) {
            console.error("Fallback data schema errors:", parseResult.error);
        }
        expect(parseResult.success).toBe(true);
    });
});
