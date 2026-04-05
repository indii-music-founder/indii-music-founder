import { useState, useEffect, useCallback } from 'react';
import { useStore } from '@/core/store';
import { useShallow } from 'zustand/react/shallow';
import { getFirestore, collection, query, where, orderBy, onSnapshot, Timestamp } from 'firebase/firestore';
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
    const { userProfile } = useStore(useShallow(state => ({
        userProfile: state.userProfile
    })));
    const [data, setData] = useState<TimeSeriesDataPoint[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [refreshKey, setRefreshKey] = useState(0);

    const refresh = useCallback(() => {
        setLoading(true);
        setError(null);
        setRefreshKey(prev => prev + 1);
    }, []);

    useEffect(() => {
        if (!userProfile?.id) return;

        const db = getFirestore();
        const analyticsRef = collection(db, `users/${userProfile.id}/analytics`);

        const startDate = new Date(dateRange.start);
        const endDate = new Date(dateRange.end);

        const q = query(
            analyticsRef,
            where('date', '>=', Timestamp.fromDate(startDate)),
            where('date', '<=', Timestamp.fromDate(endDate)),
            orderBy('date', 'asc')
        );

        const unsubscribe = onSnapshot(
            q,
            (snapshot) => {
                const days = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
                const contiguousData: TimeSeriesDataPoint[] = [];
                const dataMap = new Map<string, { streams: number, revenue: number }>();

                snapshot.forEach(doc => {
                    const docData = doc.data();
                    // Fallback to doc.id if date is missing
                    const dateStr = docData.date?.toDate?.()?.toISOString().split('T')[0] || doc.id;
                    dataMap.set(dateStr, {
                        streams: docData.streams || 0,
                        revenue: docData.revenue || 0
                    });
                });

                let hasAnyData = false;

                for (let i = 0; i <= days; i++) {
                    const dateObj = new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000);
                    const dateStr = dateObj.toISOString().split('T')[0]!;
                    const existing = dataMap.get(dateStr);

                    if (existing && (existing.streams > 0 || existing.revenue > 0)) {
                        hasAnyData = true;
                    }

                    contiguousData.push({
                        date: dateStr,
                        streams: existing?.streams || 0,
                        revenue: existing?.revenue || 0
                    });
                }

                setData(contiguousData);
                // Attach a custom property or we can calculate it in the component
                // Actually it's better to just return the data and let the component check
                setLoading(false);
            },
            (err) => {
                const message = err instanceof Error ? err.message : 'Failed to fetch analytics';
                setError(message);
                logger.error('[useAnalytics] Error:', err);
                setData([]);
                setLoading(false);
            }
        );

        return () => unsubscribe();
    }, [userProfile?.id, dateRange.start, dateRange.end, refreshKey]);

    return {
        data,
        loading,
        error,
        refresh
    };
}

/**
 * Fetch payout history from Firestore
 * Collection: users/{userId}/payouts
 */
export function usePayouts() {
    const { userProfile } = useStore(useShallow(state => ({
        userProfile: state.userProfile
    })));
    const [payouts, setPayouts] = useState<PayoutRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [refreshKey, setRefreshKey] = useState(0);

    const refresh = useCallback(() => {
        setLoading(true);
        setError(null);
        setRefreshKey(prev => prev + 1);
    }, []);

    useEffect(() => {
        if (!userProfile?.id) return;

        const db = getFirestore();
        const payoutsRef = collection(db, `users/${userProfile.id}/payouts`);

        const q = query(
            payoutsRef,
            orderBy('date', 'desc')
        );

        const unsubscribe = onSnapshot(
            q,
            (snapshot) => {
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
                setLoading(false);
            },
            (err) => {
                const message = err instanceof Error ? err.message : 'Failed to fetch payouts';
                setError(message);
                logger.error('[usePayouts] Error:', err);
                setPayouts([]);
                setLoading(false);
            }
        );

        return () => unsubscribe();
    }, [userProfile?.id, refreshKey]);

    return {
        payouts,
        loading,
        error,
        refresh
    };
}
