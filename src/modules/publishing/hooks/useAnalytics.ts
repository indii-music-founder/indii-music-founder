import { useState, useEffect, useCallback } from 'react';
import { useStore } from '@/core/store';
import { getFirestore, collection, query, where, orderBy, getDocs, Timestamp } from 'firebase/firestore';
import { logger } from '@/utils/logger';

export interface TimeSeriesDataPoint {
    date: string;
    revenue: number;
    streams: number;
}

export interface PayoutRecord {
    id: string;
    date: string;
    amount: number;
    currencyCode: string;
    status: 'pending' | 'processing' | 'paid' | 'failed';
    method: string;
    releases: { id: string; title: string; amount: number }[];
}

/**
 * Fetch analytics time-series data from Firestore
 * Collection: users/{userId}/analytics/daily/{date}
 */
export function useAnalytics(dateRange: { start: string; end: string }) {
    const userProfile = useStore(state => state.userProfile);
    const [data, setData] = useState<TimeSeriesDataPoint[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchAnalytics = useCallback(async () => {
        if (!userProfile?.id) return;

        setLoading(true);
        setError(null);

        try {
            const db = getFirestore();
            const analyticsRef = collection(db, `users/${userProfile.id}/analytics`);

            // Query for daily analytics within the date range
            const startDate = new Date(dateRange.start);
            const endDate = new Date(dateRange.end);

            const q = query(
                analyticsRef,
                where('date', '>=', Timestamp.fromDate(startDate)),
                where('date', '<=', Timestamp.fromDate(endDate)),
                orderBy('date', 'asc')
            );

            const snapshot = await getDocs(q);

            if (snapshot.empty) {
                // Generate placeholder data if no real data exists yet
                const days = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
                const placeholderData: TimeSeriesDataPoint[] = [];
                for (let i = 0; i <= days; i++) {
                    const date = new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000);
                    placeholderData.push({
                        date: date.toISOString().split('T')[0]!,
                        streams: 0,
                        revenue: 0
                    });
                }
                setData(placeholderData);
            } else {
                const analyticsData: TimeSeriesDataPoint[] = snapshot.docs.map(doc => {
                    const docData = doc.data();
                    return {
                        date: docData.date?.toDate?.()?.toISOString().split('T')[0] || doc.id,
                        streams: docData.streams || 0,
                        revenue: docData.revenue || 0
                    };
                });
                setData(analyticsData);
            }
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to fetch analytics';
            setError(message);
            logger.error('[useAnalytics] Error:', err);

            // Fallback to empty data on error
            setData([]);
        } finally {
            setLoading(false);
        }
    }, [userProfile?.id, dateRange.start, dateRange.end]);

    useEffect(() => {
        fetchAnalytics();
    }, [fetchAnalytics]);

    return {
        data,
        loading,
        error,
        refresh: fetchAnalytics
    };
}

/**
 * Fetch payout history from Firestore
 * Collection: users/{userId}/payouts
 */
export function usePayouts() {
    const userProfile = useStore(state => state.userProfile);
    const [payouts, setPayouts] = useState<PayoutRecord[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchPayouts = useCallback(async () => {
        if (!userProfile?.id) return;

        setLoading(true);
        setError(null);

        try {
            const db = getFirestore();
            const payoutsRef = collection(db, `users/${userProfile.id}/payouts`);

            const q = query(
                payoutsRef,
                orderBy('date', 'desc')
            );

            const snapshot = await getDocs(q);

            if (snapshot.empty) {
                setPayouts([]);
            } else {
                const payoutData: PayoutRecord[] = snapshot.docs.map(doc => {
                    const docData = doc.data();
                    return {
                        id: doc.id,
                        date: docData.date?.toDate?.()?.toISOString() || new Date().toISOString(),
                        amount: docData.amount || 0,
                        currencyCode: docData.currencyCode || 'USD',
                        status: docData.status || 'pending',
                        method: docData.method || 'Unknown',
                        releases: docData.releases || []
                    };
                });
                setPayouts(payoutData);
            }
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to fetch payouts';
            setError(message);
            logger.error('[usePayouts] Error:', err);
            setPayouts([]);
        } finally {
            setLoading(false);
        }
    }, [userProfile?.id]);

    useEffect(() => {
        fetchPayouts();
    }, [fetchPayouts]);

    return {
        payouts,
        loading,
        error,
        refresh: fetchPayouts
    };
}
