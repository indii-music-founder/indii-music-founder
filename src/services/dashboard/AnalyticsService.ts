import {
    SalesAnalyticsData,
    SalesAnalyticsSchema,
    DashboardRevenueStats,
    DashboardRevenueStatsSchema,
    DashboardStreamsStats,
    DashboardStreamsStatsSchema,
    DashboardAudienceStats,
    DashboardAudienceStatsSchema,
    DashboardTopTrack,
    DashboardTopTrackSchema,
    DashboardNextRelease,
    DashboardNextReleaseSchema,
    DashboardAgentActivity,
    DashboardAgentActivitySchema,
    DashboardActiveCampaigns,
    DashboardActiveCampaignsSchema,
    DashboardPendingTasks,
    DashboardPendingTasksSchema,
    DashboardSocialEngagement,
    DashboardSocialEngagementSchema,
    DashboardBrandIdentity,
    DashboardBrandIdentitySchema,
    DashboardMerchSales,
    DashboardMerchSalesSchema,
    DashboardTourStatus,
    DashboardTourStatusSchema,
} from './schema';
import { db } from '@/services/firebase';
import {
    doc,
    onSnapshot,
    Unsubscribe,
} from 'firebase/firestore';
import { logger } from '@/utils/logger';

// ─────────────────────────────────────────────────────────────────────────────
// Internal helper: creates a standardised onSnapshot wrapper with validation.
// ─────────────────────────────────────────────────────────────────────────────
function createDocSubscription<T>(
    ref: ReturnType<typeof doc>,
    schema: { safeParse: (data: unknown) => { success: true; data: T } | { success: false; error: unknown } },
    onUpdate: (data: T) => void,
    onError: ((error: Error) => void) | undefined,
    getZero: () => T,
    logContext: string,
): Unsubscribe {
    return onSnapshot(ref, (snapshot) => {
        if (snapshot.exists()) {
            const parseResult = schema.safeParse(snapshot.data());
            if (parseResult.success) {
                onUpdate(parseResult.data);
            } else {
                logger.warn(`[AnalyticsService] ${logContext} — validation failed:`, parseResult.error);
                onUpdate(getZero());
            }
        } else {
            onUpdate(getZero());
        }
    }, (error) => {
        logger.error(`[AnalyticsService] ${logContext} — snapshot error:`, error);
        onError?.(error as Error);
    });
}

// ─────────────────────────────────────────────────────────────────────────────

export class AnalyticsService {

    // ── Sales Analytics ───────────────────────────────────────────────────────

    /**
     * Subscribes to real-time sales analytics (used by the Publishing dashboard).
     */
    static subscribeToSalesAnalytics(
        userId: string,
        onUpdate: (data: SalesAnalyticsData) => void,
        onError?: (error: Error) => void,
    ): Unsubscribe {
        const ref = doc(db, 'users', userId, 'stats', 'sales_analytics');
        return createDocSubscription(ref, SalesAnalyticsSchema, onUpdate, onError, () => this.getZeroState(), 'sales_analytics');
    }

    // ── Revenue MTD ───────────────────────────────────────────────────────────

    /**
     * Subscribes to real-time month-to-date revenue stats.
     */
    static subscribeToDashboardRevenue(
        userId: string,
        onUpdate: (data: DashboardRevenueStats) => void,
        onError?: (error: Error) => void,
    ): Unsubscribe {
        const ref = doc(db, 'users', userId, 'stats', 'dashboard_revenue');
        return createDocSubscription(ref, DashboardRevenueStatsSchema, onUpdate, onError, () => this.getRevenueZeroState(), 'dashboard_revenue');
    }

    // ── Streams Today ─────────────────────────────────────────────────────────

    /**
     * Subscribes to real-time daily stream counts and weekly sparkline data.
     */
    static subscribeToDashboardStreams(
        userId: string,
        onUpdate: (data: DashboardStreamsStats) => void,
        onError?: (error: Error) => void,
    ): Unsubscribe {
        const ref = doc(db, 'users', userId, 'stats', 'dashboard_streams');
        return createDocSubscription(ref, DashboardStreamsStatsSchema, onUpdate, onError, () => this.getStreamsZeroState(), 'dashboard_streams');
    }

    // ── Audience Growth ───────────────────────────────────────────────────────

    /**
     * Subscribes to real-time audience growth statistics including weekly sparkline data
     * and optional per-platform breakdowns.
     */
    static subscribeToAudienceGrowth(
        userId: string,
        onUpdate: (data: DashboardAudienceStats) => void,
        onError?: (error: Error) => void,
    ): Unsubscribe {
        const ref = doc(db, 'users', userId, 'stats', 'audience_growth');
        return createDocSubscription(ref, DashboardAudienceStatsSchema, onUpdate, onError, () => this.getAudienceZeroState(), 'audience_growth');
    }

    // ── Top Track ─────────────────────────────────────────────────────────────

    /**
     * Subscribes to the user's current top-performing track with live stream,
     * revenue, and save-rate metrics.
     */
    static subscribeToTopTrack(
        userId: string,
        onUpdate: (data: DashboardTopTrack | null) => void,
        onError?: (error: Error) => void,
    ): Unsubscribe {
        const ref = doc(db, 'users', userId, 'stats', 'top_track');
        return onSnapshot(ref, (snapshot) => {
            if (snapshot.exists()) {
                const parseResult = DashboardTopTrackSchema.safeParse(snapshot.data());
                if (parseResult.success) {
                    onUpdate(parseResult.data);
                } else {
                    logger.warn('[AnalyticsService] top_track — validation failed:', parseResult.error);
                    onUpdate(null);
                }
            } else {
                onUpdate(null); // null means "no releases yet" — different from an error
            }
        }, (error) => {
            logger.error('[AnalyticsService] top_track — snapshot error:', error);
            onError?.(error as Error);
        });
    }

    // ── Next Release ──────────────────────────────────────────────────────────

    /**
     * Subscribes to the user's nearest upcoming scheduled release by watching
     * the `stats/next_release` document (written server-side by a Cloud Function
     * that monitors the distribution collection).
     */
    static subscribeToNextRelease(
        userId: string,
        onUpdate: (data: DashboardNextRelease | null) => void,
        onError?: (error: Error) => void,
    ): Unsubscribe {
        const ref = doc(db, 'users', userId, 'stats', 'next_release');
        return onSnapshot(ref, (snapshot) => {
            if (snapshot.exists()) {
                const parseResult = DashboardNextReleaseSchema.safeParse(snapshot.data());
                if (parseResult.success) {
                    onUpdate(parseResult.data);
                } else {
                    logger.warn('[AnalyticsService] next_release — validation failed:', parseResult.error);
                    onUpdate(null);
                }
            } else {
                onUpdate(null); // null means "no upcoming releases"
            }
        }, (error) => {
            logger.error('[AnalyticsService] next_release — snapshot error:', error);
            onError?.(error as Error);
        });
    }

    // ── Agent Activity ────────────────────────────────────────────────────────

    /**
     * Subscribes to the 5 most recent agent tasks for the user, ordered by
     * creation time descending, providing a live activity feed.
     */
    static subscribeToAgentActivity(
        userId: string,
        onUpdate: (data: DashboardAgentActivity) => void,
        onError?: (error: Error) => void,
    ): Unsubscribe {
        const ref = doc(db, 'users', userId, 'stats', 'agent_activity');
        return createDocSubscription(ref, DashboardAgentActivitySchema, onUpdate, onError, () => this.getAgentActivityZeroState(), 'agent_activity');
    }

    // ── Zero-State Factories ──────────────────────────────────────────────────

    static getZeroState(period = '30d'): SalesAnalyticsData {
        return {
            conversionRate: { value: 0, trend: 'neutral', formatted: '0%' },
            totalVisitors: { value: 0, trend: 'neutral', formatted: '0' },
            clickRate: { value: 0, trend: 'neutral', formatted: '0%' },
            avgOrderValue: { value: 0, trend: 'neutral', formatted: '$0.00' },
            revenueChart: [],
            period,
            lastUpdated: Date.now(),
        };
    }

    static getRevenueZeroState(): DashboardRevenueStats {
        return {
            mtdRevenue: { value: 0, trend: 'neutral', formatted: '$0' },
            totalRevenue: { value: 0, trend: 'neutral', formatted: '$0' },
            pendingPayouts: { value: 0, trend: 'neutral', formatted: '$0' },
            lastPayout: { value: 0, trend: 'neutral', formatted: '$0' },
            period: 'mtd',
            lastUpdated: Date.now(),
        };
    }

    static getStreamsZeroState(): DashboardStreamsStats {
        return {
            streamsToday: { value: 0, trend: 'neutral', formatted: '0' },
            weeklyStreams: [0, 0, 0, 0, 0, 0, 0],
            period: 'daily',
            lastUpdated: Date.now(),
        };
    }

    static getAudienceZeroState(): DashboardAudienceStats {
        return {
            newListenersThisWeek: { value: 0, trend: 'neutral', formatted: '+0' },
            totalFollowers: { value: 0, trend: 'neutral', formatted: '0' },
            weeklyGrowth: [0, 0, 0, 0, 0, 0, 0],
            platforms: [],
            period: 'weekly',
            lastUpdated: Date.now(),
        };
    }

    static getAgentActivityZeroState(): DashboardAgentActivity {
        return {
            recentTasks: [],
            runningCount: 0,
            completedToday: 0,
            lastUpdated: Date.now(),
        };
    }

    // ── Active Campaigns ──────────────────────────────────────────────────────

    static subscribeToActiveCampaigns(
        userId: string,
        onUpdate: (data: DashboardActiveCampaigns) => void,
        onError?: (error: Error) => void,
    ): Unsubscribe {
        const ref = doc(db, 'users', userId, 'stats', 'active_campaigns');
        return createDocSubscription(ref, DashboardActiveCampaignsSchema, onUpdate, onError, () => this.getActiveCampaignsZeroState(), 'active_campaigns');
    }

    static getActiveCampaignsZeroState(): DashboardActiveCampaigns {
        return {
            activeCount: 0,
            totalBudget: { value: 0, trend: 'neutral', formatted: '$0' },
            lastUpdated: Date.now(),
        };
    }

    // ── Pending Tasks ─────────────────────────────────────────────────────────

    static subscribeToPendingTasks(
        userId: string,
        onUpdate: (data: DashboardPendingTasks) => void,
        onError?: (error: Error) => void,
    ): Unsubscribe {
        const ref = doc(db, 'users', userId, 'stats', 'pending_tasks');
        return createDocSubscription(ref, DashboardPendingTasksSchema, onUpdate, onError, () => this.getPendingTasksZeroState(), 'pending_tasks');
    }

    static getPendingTasksZeroState(): DashboardPendingTasks {
        return {
            tasks: [],
            totalCount: 0,
            lastUpdated: Date.now(),
        };
    }

    // ── Social Engagement ─────────────────────────────────────────────────────

    static subscribeToSocialEngagement(
        userId: string,
        onUpdate: (data: DashboardSocialEngagement) => void,
        onError?: (error: Error) => void,
    ): Unsubscribe {
        const ref = doc(db, 'users', userId, 'stats', 'social_engagement');
        return createDocSubscription(ref, DashboardSocialEngagementSchema, onUpdate, onError, () => this.getSocialEngagementZeroState(), 'social_engagement');
    }

    static getSocialEngagementZeroState(): DashboardSocialEngagement {
        return {
            engagementRate: { value: 0, trend: 'neutral', formatted: '--' },
            weeklyEngagement: [0, 0, 0, 0, 0, 0, 0],
            totalInteractions: { value: 0, trend: 'neutral', formatted: '0' },
            lastUpdated: Date.now(),
        };
    }

    // ── Brand Identity ────────────────────────────────────────────────────────

    static subscribeToBrandIdentity(
        userId: string,
        onUpdate: (data: DashboardBrandIdentity) => void,
        onError?: (error: Error) => void,
    ): Unsubscribe {
        const ref = doc(db, 'users', userId, 'stats', 'brand_identity');
        return createDocSubscription(ref, DashboardBrandIdentitySchema, onUpdate, onError, () => this.getBrandIdentityZeroState(), 'brand_identity');
    }

    static getBrandIdentityZeroState(): DashboardBrandIdentity {
        return {
            complianceScore: { value: 0, trend: 'neutral', formatted: '--' },
            assetsStatus: 'missing',
            issues: 0,
            lastUpdated: Date.now(),
        };
    }

    // ── Merch Sales ───────────────────────────────────────────────────────────

    static subscribeToMerchSales(
        userId: string,
        onUpdate: (data: DashboardMerchSales) => void,
        onError?: (error: Error) => void,
    ): Unsubscribe {
        const ref = doc(db, 'users', userId, 'stats', 'merch_sales');
        return createDocSubscription(ref, DashboardMerchSalesSchema, onUpdate, onError, () => this.getMerchSalesZeroState(), 'merch_sales');
    }

    static getMerchSalesZeroState(): DashboardMerchSales {
        return {
            weeklyRevenue: { value: 0, trend: 'neutral', formatted: '$0' },
            totalOrders: { value: 0, trend: 'neutral', formatted: '0' },
            lowStockAlerts: 0,
            lastUpdated: Date.now(),
        };
    }

    // ── Tour Status ───────────────────────────────────────────────────────────

    static subscribeToTourStatus(
        userId: string,
        onUpdate: (data: DashboardTourStatus) => void,
        onError?: (error: Error) => void,
    ): Unsubscribe {
        const ref = doc(db, 'users', userId, 'stats', 'tour_status');
        return createDocSubscription(ref, DashboardTourStatusSchema, onUpdate, onError, () => this.getTourStatusZeroState(), 'tour_status');
    }

    static getTourStatusZeroState(): DashboardTourStatus {
        return {
            upcomingShows: 0,
            totalTicketRevenue: { value: 0, trend: 'neutral', formatted: '$0' },
            lastUpdated: Date.now(),
        };
    }
}
