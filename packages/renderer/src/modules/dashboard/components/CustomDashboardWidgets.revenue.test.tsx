import { render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    getUserRevenueStats: vi.fn(),
    setModule: vi.fn(),
    state: {
        user: { uid: 'authenticated-user-id' },
        userProfile: { id: 'stale-profile-id' },
    },
}));

vi.mock('@/core/store', () => ({
    useStore: (selector: (state: Record<string, unknown>) => unknown) => selector({
        ...mocks.state,
        setModule: mocks.setModule,
    }),
}));

vi.mock('zustand/react/shallow', () => ({
    useShallow: (selector: unknown) => selector,
}));

vi.mock('@/services/RevenueService', () => ({
    revenueService: {
        getUserRevenueStats: mocks.getUserRevenueStats,
    },
}));

vi.mock('@/services/dashboard/AnalyticsService', () => ({
    AnalyticsService: {},
}));

import { WIDGET_RENDERERS } from './CustomDashboardWidgets';

describe('Aggregate Revenue production owner boundary', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.getUserRevenueStats.mockResolvedValue({
            totalRevenue: 0,
            revenueChange: 0,
            unitsSold: 0,
            unitsChange: 0,
            pendingPayouts: 0,
            lastPayoutAmount: 0,
            sources: { streaming: 0, merch: 0, licensing: 0, social: 0 },
            sourceCounts: { streaming: 0, merch: 0, licensing: 0, social: 0 },
            revenueByProduct: {},
            salesByProduct: {},
            history: [],
            trendScore: 0,
            productionVelocity: 0,
            funnelData: null,
        });
    });

    it('queries revenue with Firebase Auth UID instead of a stale profile ID', async () => {
        render(WIDGET_RENDERERS.revenue_aggregated());

        await waitFor(() => {
            expect(mocks.getUserRevenueStats).toHaveBeenCalledWith(
                'authenticated-user-id',
                '30d',
            );
        });
        expect(mocks.getUserRevenueStats).not.toHaveBeenCalledWith(
            'stale-profile-id',
            expect.anything(),
        );
    });
});
