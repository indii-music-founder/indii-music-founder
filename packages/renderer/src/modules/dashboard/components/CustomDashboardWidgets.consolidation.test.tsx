import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    setModule: vi.fn(),
    getUserRevenueStats: vi.fn(),
    subscribeToDashboardRevenue: vi.fn(),
    getRevenueZeroState: vi.fn(() => ({
        mtdRevenue: { formatted: '$0', raw: 0 },
        previousMonthRevenue: { formatted: '$0', raw: 0 },
        percentChange: 0,
        currency: 'USD',
    })),
    getActiveTimelines: vi.fn(),
    getAllTimelines: vi.fn(),
    onPendingApprovals: vi.fn(),
    approve: vi.fn(),
    deny: vi.fn(),
    toastSuccess: vi.fn(),
    toastError: vi.fn(),
}));

vi.mock('@/core/store', () => ({
    useStore: (selector: (state: Record<string, unknown>) => unknown) => selector({
        user: { uid: 'test-artist-123' },
        userProfile: { id: 'profile-123' },
        authLoading: false,
        setModule: mocks.setModule,
    }),
}));

vi.mock('zustand/react/shallow', () => ({
    useShallow: (selector: unknown) => selector,
}));

vi.mock('@/core/context/ToastContext', () => ({
    useToast: () => ({
        success: mocks.toastSuccess,
        error: mocks.toastError,
        info: vi.fn(),
        warning: vi.fn(),
    }),
}));

vi.mock('@/services/RevenueService', () => ({
    revenueService: {
        getUserRevenueStats: mocks.getUserRevenueStats,
    },
}));

vi.mock('@/services/dashboard/AnalyticsService', () => ({
    AnalyticsService: {
        subscribeToDashboardRevenue: mocks.subscribeToDashboardRevenue,
        getRevenueZeroState: mocks.getRevenueZeroState,
    },
}));

vi.mock('@/services/timeline/TimelineOrchestratorService', () => ({
    timelineOrchestrator: {
        getActiveTimelines: mocks.getActiveTimelines,
        getAllTimelines: mocks.getAllTimelines,
    },
}));

vi.mock('@/services/agent/governance/ToolApprovalService', () => ({
    toolApprovalService: {
        onPendingApprovals: mocks.onPendingApprovals,
        approve: mocks.approve,
        deny: mocks.deny,
    },
}));

vi.mock('motion/react', async (importOriginal) => {
    const actual = await importOriginal<Record<string, unknown>>();
    return {
        ...actual,
        animate: (target: { set?: (val: number) => void }, value: number, options?: { onUpdate?: (val: number) => void }) => {
            if (target && typeof target.set === 'function') {
                target.set(value);
            }
            if (options?.onUpdate) {
                options.onUpdate(value);
            }
            return { stop: vi.fn() };
        },
    };
});

import {
    WIDGET_RENDERERS,
    DEFAULT_WIDGETS,
    WIDGET_DEFINITIONS,
    migrateWidgets,
    loadWidgets,
    STORAGE_KEY,
    type Widget,
} from './CustomDashboardWidgets';

describe('Consolidated Dashboard Widgets & Operational Gates', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.clear();

        mocks.getUserRevenueStats.mockResolvedValue({
            totalRevenue: 42500,
            revenueChange: 14.5,
            unitsSold: 320,
            unitsChange: 5,
            pendingPayouts: 1200,
            lastPayoutAmount: 5000,
            sources: { streaming: 25000, merch: 12500, licensing: 5000, social: 0 },
            sourceCounts: { streaming: 100, merch: 50, licensing: 10, social: 0 },
            revenueByProduct: {},
            salesByProduct: {},
            history: [],
            trendScore: 85,
            productionVelocity: 1.2,
            funnelData: null,
        });

        mocks.subscribeToDashboardRevenue.mockImplementation((_uid, onData) => {
            onData({
                mtdRevenue: { formatted: '$15,800', raw: 15800 },
                previousMonthRevenue: { formatted: '$12,000', raw: 12000 },
                percentChange: 31.6,
                currency: 'USD',
            });
            return vi.fn();
        });

        mocks.getActiveTimelines.mockResolvedValue([]);
        mocks.getAllTimelines.mockResolvedValue([]);
        mocks.onPendingApprovals.mockReturnValue(vi.fn());
        mocks.approve.mockResolvedValue({ success: true });
        mocks.deny.mockResolvedValue({ success: true });
    });

    describe('Widget Definitions & Defaults', () => {
        it('includes revenue_consolidated, project_timeline, and approval_gates in definitions and defaults', () => {
            expect(WIDGET_DEFINITIONS.revenue_consolidated).toBeDefined();
            expect(WIDGET_DEFINITIONS.project_timeline).toBeDefined();
            expect(WIDGET_DEFINITIONS.approval_gates).toBeDefined();

            const typesInDefaults = DEFAULT_WIDGETS.map((w) => w.type);
            expect(typesInDefaults).toContain('revenue_consolidated');
            expect(typesInDefaults).toContain('project_timeline');
            expect(typesInDefaults).toContain('approval_gates');
        });
    });

    describe('ConsolidatedRevenueWidget', () => {
        it('renders aggregate mode by default with gross revenue and source breakdown', async () => {
            render(WIDGET_RENDERERS.revenue_consolidated());

            expect(screen.getByText('Revenue & Royalties')).toBeInTheDocument();
            expect(screen.getByText('Total Gross All Sources')).toBeInTheDocument();

            await waitFor(() => {
                expect(mocks.getUserRevenueStats).toHaveBeenCalledWith('test-artist-123', '30d');
            });

            expect(await screen.findByText('$42,500')).toBeInTheDocument();
            expect(screen.getByText('+14.5%')).toBeInTheDocument();
            expect(screen.getByText('Streaming, Merch, Licensing & Social')).toBeInTheDocument();

            const widget = screen.getByTestId('revenue-consolidated-widget');
            fireEvent.click(widget);
            expect(mocks.setModule).toHaveBeenCalledWith('finance');
        });

        it('switches between Aggregate and MTD views seamlessly', async () => {
            render(WIDGET_RENDERERS.revenue_consolidated());

            await waitFor(() => {
                expect(screen.getByText('$42,500')).toBeInTheDocument();
            });

            const mtdBtn = screen.getByRole('button', { name: 'MTD' });
            fireEvent.click(mtdBtn);

            await waitFor(() => {
                expect(mocks.subscribeToDashboardRevenue).toHaveBeenCalledWith(
                    'test-artist-123',
                    expect.any(Function),
                    expect.any(Function),
                );
            });

            expect(await screen.findByText('$15,800')).toBeInTheDocument();
            expect(screen.getByText(/MTD Earnings/i)).toBeInTheDocument();
            expect(screen.getByText('Next Payout')).toBeInTheDocument();

            const aggBtn = screen.getByRole('button', { name: 'Aggregate' });
            fireEvent.click(aggBtn);

            expect(await screen.findByText('$42,500')).toBeInTheDocument();
            expect(screen.getByText('Total Gross All Sources')).toBeInTheDocument();
        });

        it('renders empty state when aggregate total revenue is zero', async () => {
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

            render(WIDGET_RENDERERS.revenue_consolidated());

            expect(await screen.findByText('Set up revenue tracking')).toBeInTheDocument();
            expect(screen.getByText('Streaming, merch, sync and licensing income roll up here as it arrives.')).toBeInTheDocument();
        });
    });

    describe('ProjectTimelineWidget', () => {
        it('renders active campaign timeline details and milestone progress', async () => {
            mocks.getActiveTimelines.mockResolvedValue([
                {
                    id: 'tl-1',
                    title: 'Neon Odyssey Release',
                    status: 'active',
                    currentPhaseOrder: 1,
                    completedCount: 4,
                    totalCount: 8,
                    phases: [
                        { id: 'p1', name: 'Pre-Save Escalation', order: 1, cadence: 'daily' },
                    ],
                    milestones: [
                        {
                            id: 'm-pending',
                            instruction: 'Launch Spotify Canvas & Pre-Save Campaign',
                            status: 'pending',
                            platform: 'spotify',
                            scheduledAt: '2026-10-15T00:00:00Z',
                        },
                    ],
                },
            ]);

            render(WIDGET_RENDERERS.project_timeline());

            await waitFor(() => {
                expect(mocks.getActiveTimelines).toHaveBeenCalledWith('test-artist-123');
            });

            expect(await screen.findByText('Neon Odyssey Release')).toBeInTheDocument();
            expect(screen.getByText('Pre-Save Escalation')).toBeInTheDocument();
            expect(screen.getByText('daily cadence')).toBeInTheDocument();
            expect(screen.getByText('50%')).toBeInTheDocument();
            expect(screen.getByText('4 of 8 milestones completed')).toBeInTheDocument();
            expect(screen.getByText('Launch Spotify Canvas & Pre-Save Campaign')).toBeInTheDocument();
            expect(screen.getByText('spotify')).toBeInTheDocument();

            const widget = screen.getByTestId('project-timeline-widget');
            fireEvent.click(widget);
            expect(mocks.setModule).toHaveBeenCalledWith('campaign');
        });

        it('renders zero state with 1-click CTA to plan release timeline when none exists', async () => {
            mocks.getActiveTimelines.mockResolvedValue([]);
            mocks.getAllTimelines.mockResolvedValue([]);

            render(WIDGET_RENDERERS.project_timeline());

            await waitFor(() => {
                expect(mocks.getActiveTimelines).toHaveBeenCalledWith('test-artist-123');
            });

            expect(await screen.findByText('No Active Rollout')).toBeInTheDocument();
            const planBtn = screen.getByRole('button', { name: /Plan Release Timeline/i });
            expect(planBtn).toBeInTheDocument();

            fireEvent.click(planBtn);
            expect(mocks.setModule).toHaveBeenCalledWith('campaign');
        });
    });

    describe('ApprovalGatesWidget', () => {
        it('renders nominal safe state when no approval gates are pending', async () => {
            mocks.onPendingApprovals.mockImplementation((callback) => {
                callback([]);
                return vi.fn();
            });

            render(WIDGET_RENDERERS.approval_gates());

            expect(screen.getByText('All Gates Clear')).toBeInTheDocument();
            expect(screen.getByText('Autonomous safeguards active')).toBeInTheDocument();
            expect(screen.getByText('100% Safe')).toBeInTheDocument();
        });

        it('renders pending approval gates with risk tier and handles approve & deny actions', async () => {
            const pendingItems = [
                {
                    id: 'gate-item-1',
                    toolName: 'dsp_submission',
                    riskTier: 'destructive',
                    description: 'Direct ingestion of lossless master to Spotify & Apple Music',
                    createdAt: Date.now(),
                },
            ];

            mocks.onPendingApprovals.mockImplementation((callback) => {
                callback(pendingItems);
                return vi.fn();
            });

            render(WIDGET_RENDERERS.approval_gates());

            expect(screen.getByText('1 Gate Pending')).toBeInTheDocument();
            expect(screen.getByText('Action Required')).toBeInTheDocument();
            expect(screen.getByText('dsp_submission')).toBeInTheDocument();
            expect(screen.getByText('destructive')).toBeInTheDocument();
            expect(screen.getByText('Direct ingestion of lossless master to Spotify & Apple Music')).toBeInTheDocument();

            const approveBtn = screen.getByTestId('gate-approve-gate-item-1');
            const denyBtn = screen.getByTestId('gate-deny-gate-item-1');
            expect(approveBtn).toBeInTheDocument();
            expect(denyBtn).toBeInTheDocument();

            // Click approve
            fireEvent.click(approveBtn);
            await waitFor(() => {
                expect(mocks.approve).toHaveBeenCalledWith('gate-item-1');
            });
            expect(mocks.toastSuccess).toHaveBeenCalledWith('Gate approved & executed');

            // Click deny
            fireEvent.click(denyBtn);
            await waitFor(() => {
                expect(mocks.deny).toHaveBeenCalledWith('gate-item-1', 'Denied from Quick-Action Approval Gate');
            });
            expect(mocks.toastSuccess).toHaveBeenCalledWith('Gate denied');
        });

        it('shows additional gates indicator when more than 2 gates are pending', () => {
            const threeItems = [
                { id: 'g1', toolName: 'tool1', riskTier: 'read', description: 'desc1', createdAt: Date.now() },
                { id: 'g2', toolName: 'tool2', riskTier: 'write', description: 'desc2', createdAt: Date.now() },
                { id: 'g3', toolName: 'tool3', riskTier: 'destructive', description: 'desc3', createdAt: Date.now() },
            ];

            mocks.onPendingApprovals.mockImplementation((callback) => {
                callback(threeItems);
                return vi.fn();
            });

            render(WIDGET_RENDERERS.approval_gates());

            expect(screen.getByText('3 Gates Pending')).toBeInTheDocument();
            expect(screen.getByText('+1 more gate in Quick-Action Banner')).toBeInTheDocument();
        });
    });

    describe('Widget Migration & Deprecation Filtering', () => {
        it('marks revenue_aggregated and revenue_mtd as deprecated', () => {
            expect(WIDGET_DEFINITIONS.revenue_aggregated.deprecated).toBe(true);
            expect(WIDGET_DEFINITIONS.revenue_mtd.deprecated).toBe(true);
            expect(WIDGET_DEFINITIONS.revenue_consolidated.deprecated).toBeUndefined();
        });

        it('migrates legacy stored layout with redundant revenue widgets to consolidated layout', () => {
            const legacyWidgets: Widget[] = [
                { id: 'w1', type: 'streams_today', order: 0 },
                { id: 'w2', type: 'revenue_aggregated', order: 1 },
                { id: 'w3', type: 'revenue_mtd', order: 2 },
                { id: 'w4', type: 'next_release', order: 3 },
            ];

            const migrated = migrateWidgets(legacyWidgets);

            const types = migrated.map((w) => w.type);
            // Has consolidated revenue once
            expect(types).toContain('revenue_consolidated');
            expect(types.filter((t) => t === 'revenue_consolidated').length).toBe(1);
            // Does not have legacy revenue widgets
            expect(types).not.toContain('revenue_aggregated');
            expect(types).not.toContain('revenue_mtd');
            // Injected project_timeline and approval_gates
            expect(types).toContain('project_timeline');
            expect(types).toContain('approval_gates');

            // Verify sequential ordering
            migrated.forEach((w, idx) => {
                expect(w.order).toBe(idx);
            });
        });

        it('loads defaults when localStorage is empty and migrates if existing layout exists', () => {
            localStorage.clear();
            const defaults = loadWidgets();
            expect(defaults).toEqual(DEFAULT_WIDGETS);

            localStorage.setItem(
                STORAGE_KEY,
                JSON.stringify([
                    { id: 'legacy-1', type: 'revenue_mtd', order: 0 },
                ])
            );

            const migratedFromStorage = loadWidgets();
            const types = migratedFromStorage.map((w) => w.type);
            expect(types).toContain('revenue_consolidated');
            expect(types).not.toContain('revenue_mtd');
            expect(types).toContain('project_timeline');
            expect(types).toContain('approval_gates');
        });
    });
});
