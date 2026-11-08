import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AnalyticsService } from './AnalyticsService';

// Mock Firebase
vi.mock('@/services/firebase', () => ({
    db: {},
    functions: {},
}));

const mockDoc = vi.fn();
const mockOnSnapshot = vi.fn();
const mockHttpsCallable = vi.fn();

vi.mock('firebase/firestore', () => ({
    doc: (...args: unknown[]) => mockDoc(...args),
    onSnapshot: (...args: unknown[]) => mockOnSnapshot(...args),
}));

vi.mock('firebase/functions', () => ({
    httpsCallable: (...args: unknown[]) => mockHttpsCallable(...args),
}));

vi.mock('@/utils/logger', () => ({
    logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
    },
}));

describe('AnalyticsService (ISSUE-1595)', () => {
    const TEST_UID = 'user-test-1595';

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('subscribes to sales_analytics and yields zero-state when document does not exist', () => {
        mockDoc.mockReturnValue({ path: `users/${TEST_UID}/stats/sales_analytics` });
        let updateCallback: ((snap: unknown) => void) | undefined;
        mockOnSnapshot.mockImplementation((_ref: unknown, onNext: (snap: unknown) => void) => {
            updateCallback = onNext;
            return vi.fn(); // unsubscribe
        });

        const onUpdate = vi.fn();
        const unsub = AnalyticsService.subscribeToSalesAnalytics(TEST_UID, onUpdate);

        expect(typeof unsub).toBe('function');
        expect(mockDoc).toHaveBeenCalledWith(expect.anything(), 'users', TEST_UID, 'stats', 'sales_analytics');

        // Simulate snapshot does not exist
        updateCallback?.({
            exists: () => false,
            data: () => null,
        });

        expect(onUpdate).toHaveBeenCalledWith(expect.objectContaining({
            conversionRate: expect.objectContaining({ value: 0 }),
            totalVisitors: expect.objectContaining({ value: 0 }),
        }));
    });

    it('subscribes to dashboard_revenue and yields parsed data when document exists', () => {
        mockDoc.mockReturnValue({ path: `users/${TEST_UID}/stats/dashboard_revenue` });
        let updateCallback: ((snap: unknown) => void) | undefined;
        mockOnSnapshot.mockImplementation((_ref: unknown, onNext: (snap: unknown) => void) => {
            updateCallback = onNext;
            return vi.fn();
        });

        const onUpdate = vi.fn();
        AnalyticsService.subscribeToDashboardRevenue(TEST_UID, onUpdate);

        // Simulate snapshot exists with valid revenue data
        updateCallback?.({
            exists: () => true,
            data: () => ({
                mtdRevenue: { value: 450, trend: 'up', formatted: '$450.00' },
                totalRevenue: { value: 12500, trend: 'up', formatted: '$12,500.00' },
                pendingPayouts: { value: 0, trend: 'neutral', formatted: '$0.00' },
                lastPayout: { value: 500, trend: 'neutral', formatted: '$500.00' },
                period: 'mtd',
                lastUpdated: Date.now(),
            }),
        });

        expect(onUpdate).toHaveBeenCalledWith(expect.objectContaining({
            mtdRevenue: expect.objectContaining({ value: 450 }),
            totalRevenue: expect.objectContaining({ value: 12500 }),
        }));
    });

    it('triggerStatsAggregation calls backend aggregateUserDashboardStats Cloud Function', async () => {
        const mockFn = vi.fn().mockResolvedValue({ data: { success: true, updatedCount: 13 } });
        mockHttpsCallable.mockReturnValue(mockFn);

        await AnalyticsService.triggerStatsAggregation();

        expect(mockHttpsCallable).toHaveBeenCalledWith(expect.anything(), 'aggregateUserDashboardStats');
        expect(mockFn).toHaveBeenCalled();
    });
});
