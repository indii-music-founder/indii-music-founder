import { render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    getUserRevenueStats: vi.fn(),
    setModule: vi.fn(),
    subscribeToDashboardStreams: vi.fn(() => vi.fn()),
    subscribeToDashboardRevenue: vi.fn(() => vi.fn()),
    subscribeToNextRelease: vi.fn(() => vi.fn()),
    subscribeToTopTrack: vi.fn(() => vi.fn()),
    subscribeToAgentActivity: vi.fn(() => vi.fn()),
    subscribeToAudienceGrowth: vi.fn(() => vi.fn()),
    subscribeToActiveCampaigns: vi.fn(() => vi.fn()),
    subscribeToPendingTasks: vi.fn(() => vi.fn()),
    subscribeToSocialEngagement: vi.fn(() => vi.fn()),
    subscribeToBrandIdentity: vi.fn(() => vi.fn()),
    subscribeToMerchSales: vi.fn(() => vi.fn()),
    subscribeToTourStatus: vi.fn(() => vi.fn()),
    state: {
        user: { uid: 'authenticated-user-id' },
        userProfile: { id: 'stale-profile-id' },
        authLoading: false as boolean,
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
    AnalyticsService: {
        subscribeToDashboardStreams: mocks.subscribeToDashboardStreams,
        subscribeToDashboardRevenue: mocks.subscribeToDashboardRevenue,
        subscribeToNextRelease: mocks.subscribeToNextRelease,
        subscribeToTopTrack: mocks.subscribeToTopTrack,
        subscribeToAgentActivity: mocks.subscribeToAgentActivity,
        subscribeToAudienceGrowth: mocks.subscribeToAudienceGrowth,
        subscribeToActiveCampaigns: mocks.subscribeToActiveCampaigns,
        subscribeToPendingTasks: mocks.subscribeToPendingTasks,
        subscribeToSocialEngagement: mocks.subscribeToSocialEngagement,
        subscribeToBrandIdentity: mocks.subscribeToBrandIdentity,
        subscribeToMerchSales: mocks.subscribeToMerchSales,
        subscribeToTourStatus: mocks.subscribeToTourStatus,
    },
}));

import { WIDGET_RENDERERS } from './CustomDashboardWidgets';

describe('Aggregate Revenue production owner boundary', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.state.authLoading = false;
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

    it('uses the auth-ready UID for every owner-scoped analytics subscription', async () => {
        const subscriptions = [
            ['streams_today', mocks.subscribeToDashboardStreams],
            ['revenue_mtd', mocks.subscribeToDashboardRevenue],
            ['next_release', mocks.subscribeToNextRelease],
            ['top_track', mocks.subscribeToTopTrack],
            ['agent_activity', mocks.subscribeToAgentActivity],
            ['audience_growth', mocks.subscribeToAudienceGrowth],
            ['active_campaigns', mocks.subscribeToActiveCampaigns],
            ['pending_tasks', mocks.subscribeToPendingTasks],
            ['social_engagement', mocks.subscribeToSocialEngagement],
            ['brand_identity', mocks.subscribeToBrandIdentity],
            ['merch_sales', mocks.subscribeToMerchSales],
            ['tour_status', mocks.subscribeToTourStatus],
        ] as const;

        render(<>{subscriptions.map(([widgetType]) => (
            <div key={widgetType}>{WIDGET_RENDERERS[widgetType]()}</div>
        ))}</>);

        await waitFor(() => {
            for (const [, subscribe] of subscriptions) {
                const calls = subscribe.mock.calls as unknown[][];
                expect(subscribe).toHaveBeenCalledOnce();
                expect(calls[0]?.[0]).toBe('authenticated-user-id');
                expect(calls.some(call => call[0] === 'stale-profile-id')).toBe(false);
            }
        });
    });

    it('does not query revenue before Firebase Auth restoration completes', async () => {
        mocks.state.authLoading = true;

        render(WIDGET_RENDERERS.revenue_aggregated());

        await Promise.resolve();
        expect(mocks.getUserRevenueStats).not.toHaveBeenCalled();
    });
});
