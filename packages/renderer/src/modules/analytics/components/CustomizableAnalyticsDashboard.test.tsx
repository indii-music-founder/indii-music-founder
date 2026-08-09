import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    userId: 'user-1' as string | null,
    getCurrentTier: vi.fn(),
    getDailyUsage: vi.fn(),
    getUserRevenueStats: vi.fn(),
    fetchEarnings: vi.fn(),
    getExpenses: vi.fn(),
    getEarningsSummary: vi.fn(),
    buildCatalogue: vi.fn(),
}));

vi.mock('@/core/store', () => ({
    useStore: (selector: (state: { user: { uid: string } | null }) => unknown) =>
        selector({ user: mocks.userId ? { uid: mocks.userId } : null }),
}));
vi.mock('@/services/MembershipService', () => ({
    MembershipService: {
        getCurrentTier: mocks.getCurrentTier,
        getLimits: vi.fn(() => ({
            maxImagesPerDay: 50,
            maxVideoGenerationsPerDay: 5,
            maxStorageMB: 500,
            maxDailySpend: 1,
        })),
        getDailyUsage: mocks.getDailyUsage,
    },
}));
vi.mock('@/services/RevenueService', () => ({
    revenueService: { getUserRevenueStats: mocks.getUserRevenueStats },
}));
vi.mock('@/services/finance/FinanceService', () => ({
    financeService: {
        fetchEarnings: mocks.fetchEarnings,
        getExpenses: mocks.getExpenses,
        getEarningsSummary: mocks.getEarningsSummary,
    },
}));
vi.mock('@/services/analytics/PlatformDataService', () => ({
    platformDataService: { buildCatalogue: mocks.buildCatalogue },
}));
vi.mock('@/utils/logger', () => ({
    logger: { error: vi.fn() },
}));
vi.mock('recharts', () => ({
    AreaChart: () => <div data-testid="area-chart" />,
    Area: () => null,
    XAxis: () => null,
    YAxis: () => null,
    CartesianGrid: () => null,
    Tooltip: () => null,
    ResponsiveContainer: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
    BarChart: () => <div data-testid="bar-chart" />,
    Bar: () => null,
    Legend: () => null,
    Cell: () => null,
}));
vi.mock('motion/react', () => ({
    motion: { div: ({ children }: { children?: React.ReactNode }) => <div>{children}</div> },
    AnimatePresence: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
}));

import { CustomizableAnalyticsDashboard } from './CustomizableAnalyticsDashboard';

const revenueStats = {
    totalRevenue: 100,
    revenueChange: 0,
    unitsSold: 1,
    unitsChange: 0,
    pendingPayouts: 0,
    lastPayoutAmount: 0,
    sources: { streaming: 100, merch: 0, licensing: 0, social: 0 },
    sourceCounts: { streaming: 1, merch: 0, licensing: 0, social: 0 },
    revenueByProduct: {},
    salesByProduct: {},
    history: [],
    trendScore: 50,
    productionVelocity: 0,
    funnelData: null,
};

describe('CustomizableAnalyticsDashboard account boundaries', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.userId = 'user-1';
        mocks.getCurrentTier.mockResolvedValue('free');
        mocks.getDailyUsage.mockResolvedValue({
            imagesGenerated: 0,
            videosGenerated: 0,
            storageUsedMB: 0,
            totalSpend: 0,
        });
        mocks.getUserRevenueStats.mockResolvedValue(revenueStats);
        mocks.fetchEarnings.mockResolvedValue(null);
        mocks.getExpenses.mockResolvedValue([]);
        mocks.getEarningsSummary.mockResolvedValue({
            totalEarnings: 100,
            pendingPayouts: 0,
            lastPayout: 0,
            currency: 'USD',
            trends: { earningsChange: 0, payoutsChange: 0 },
            sources: [],
        });
        mocks.buildCatalogue.mockResolvedValue([]);
    });

    it('does not render zero-value account data as a signed-out result', async () => {
        mocks.userId = null;
        render(<CustomizableAnalyticsDashboard />);

        expect(await screen.findByText(/Sign in to load your owner-scoped analytics/i)).toBeInTheDocument();
        expect(screen.queryByText('Gross Revenue')).not.toBeInTheDocument();
    });

    it('clears the previous account values when the next account load fails', async () => {
        const view = render(<CustomizableAnalyticsDashboard />);
        expect((await screen.findAllByText('$100.00')).length).toBeGreaterThan(0);

        mocks.userId = 'user-2';
        mocks.getUserRevenueStats.mockRejectedValueOnce(new Error('permission denied'));
        view.rerender(<CustomizableAnalyticsDashboard />);

        expect(await screen.findByRole('alert')).toHaveTextContent('permission denied');
        await waitFor(() => expect(screen.queryAllByText('$100.00')).toHaveLength(0));
    });
});
