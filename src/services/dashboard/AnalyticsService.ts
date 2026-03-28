
import { SalesAnalyticsData, SalesAnalyticsSchema } from './schema';
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
}
