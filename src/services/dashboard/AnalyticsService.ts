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
}
