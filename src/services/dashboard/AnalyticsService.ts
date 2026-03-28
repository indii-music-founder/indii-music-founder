
import {
    SalesAnalyticsData,
    SalesAnalyticsSchema,
    DashboardRevenueStats,
    DashboardRevenueStatsSchema,
    DashboardStreamsStats,
    DashboardStreamsStatsSchema
} from './schema';
import { db } from '@/services/firebase';
import { doc, onSnapshot, Unsubscribe } from 'firebase/firestore';
import { logger } from '@/utils/logger';

export class AnalyticsService {
    /**
     * Subscribes to real-time sales analytics for a user.
     * 
     * @param userId - The ID of the artist/user.
     * @param onUpdate - Callback function with the latest analytics data.
     * @param onError - Optional error handler.
     * @returns Unsubscribe function to stop listening.
     */
    static subscribeToSalesAnalytics(
        userId: string,
        onUpdate: (data: SalesAnalyticsData) => void,
        onError?: (error: Error) => void
    ): Unsubscribe {
        const statsRef = doc(db, 'users', userId, 'stats', 'sales_analytics');

        return onSnapshot(statsRef, (snapshot) => {
            if (snapshot.exists()) {
                const rawData = snapshot.data();
                const parseResult = SalesAnalyticsSchema.safeParse(rawData);

                if (parseResult.success) {
                    onUpdate(parseResult.data);
                } else {
                    logger.warn('[AnalyticsService] Data validation failed:', parseResult.error);
                    // Provide a zero-state if we have a document but it's invalid
                    onUpdate(this.getZeroState());
                }
            } else {
                // If document does not exist, return a clean zero-state
                onUpdate(this.getZeroState());
            }
        }, (error) => {
            logger.error('[AnalyticsService] Snapshot error:', error);
            if (onError) onError(error as Error);
        });
    }

    /**
     * Subscribes to real-time dashboard revenue stats for a user (MTD, Total, etc).
     * 
     * @param userId - The ID of the artist/user.
     * @param onUpdate - Callback function with the latest revenue stats.
     * @param onError - Optional error handler.
     * @returns Unsubscribe function to stop listening.
     */
    static subscribeToDashboardRevenue(
        userId: string,
        onUpdate: (data: DashboardRevenueStats) => void,
        onError?: (error: Error) => void
    ): Unsubscribe {
        const statsRef = doc(db, 'users', userId, 'stats', 'dashboard_revenue');

        return onSnapshot(statsRef, (snapshot) => {
            if (snapshot.exists()) {
                const rawData = snapshot.data();
                const parseResult = DashboardRevenueStatsSchema.safeParse(rawData);

                if (parseResult.success) {
                    onUpdate(parseResult.data);
                } else {
                    logger.warn('[AnalyticsService] Dashboard revenue validation failed:', parseResult.error);
                    onUpdate(this.getRevenueZeroState());
                }
            } else {
                onUpdate(this.getRevenueZeroState());
            }
        }, (error) => {
            logger.error('[AnalyticsService] Dashboard revenue snapshot error:', error);
            if (onError) onError(error as Error);
        });
    }
    /**
     * Subscribes to real-time dashboard streams stats for a user.
     * 
     * @param userId - The ID of the artist/user.
     * @param onUpdate - Callback function with the latest streams stats.
     * @param onError - Optional error handler.
     * @returns Unsubscribe function to stop listening.
     */
    static subscribeToDashboardStreams(
        userId: string,
        onUpdate: (data: DashboardStreamsStats) => void,
        onError?: (error: Error) => void
    ): Unsubscribe {
        const statsRef = doc(db, 'users', userId, 'stats', 'dashboard_streams');

        return onSnapshot(statsRef, (snapshot) => {
            if (snapshot.exists()) {
                const rawData = snapshot.data();
                const parseResult = DashboardStreamsStatsSchema.safeParse(rawData);

                if (parseResult.success) {
                    onUpdate(parseResult.data);
                } else {
                    logger.warn('[AnalyticsService] Dashboard streams validation failed:', parseResult.error);
                    onUpdate(this.getStreamsZeroState());
                }
            } else {
                onUpdate(this.getStreamsZeroState());
            }
        }, (error) => {
            logger.error('[AnalyticsService] Dashboard streams snapshot error:', error);
            if (onError) onError(error as Error);
        });
    }


    /**
     * Generates a default "zero state" for sales analytics.
     */
    static getZeroState(period: string = '30d'): SalesAnalyticsData {
        return {
            conversionRate: { value: 0, trend: 'neutral', formatted: '0%' },
            totalVisitors: { value: 0, trend: 'neutral', formatted: '0' },
            clickRate: { value: 0, trend: 'neutral', formatted: '0%' },
            avgOrderValue: { value: 0, trend: 'neutral', formatted: '$0.00' },
            revenueChart: [],
            period: period,
            lastUpdated: Date.now()
        };
    }

    /**
     * Generates a default "zero state" for dashboard revenue.
     */
    static getRevenueZeroState(): DashboardRevenueStats {
        return {
            mtdRevenue: { value: 0, trend: 'neutral', formatted: '$0' },
            totalRevenue: { value: 0, trend: 'neutral', formatted: '$0' },
            pendingPayouts: { value: 0, trend: 'neutral', formatted: '$0' },
            lastPayout: { value: 0, trend: 'neutral', formatted: '$0' },
            period: 'mtd',
            lastUpdated: Date.now()
        };
    }

    /**
     * Generates a default "zero state" for dashboard streams.
     */
    static getStreamsZeroState(): DashboardStreamsStats {
        return {
            streamsToday: { value: 0, trend: 'neutral', formatted: '0' },
            weeklyStreams: [0, 0, 0, 0, 0, 0, 0],
            period: 'daily',
            lastUpdated: Date.now()
        };
    }
}
