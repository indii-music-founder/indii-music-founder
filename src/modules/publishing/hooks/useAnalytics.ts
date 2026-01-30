import { useState, useEffect, useCallback } from 'react';
import { useStore } from '@/core/store';
import { revenueService } from '@/services/RevenueService';
import { financeService } from '@/services/finance/FinanceService';

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
 * Hook to fetch analytics time-series data
 * In production, this would query Firestore collections or an analytics API
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
            // TODO: Replace with actual API call
            // const analyticsData = await revenueService.getTimeSeriesData(userProfile.id, dateRange);

            // For now, generate mock data based on date range
            const start = new Date(dateRange.start);
            const end = new Date(dateRange.end);
            const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));

            const mockData: TimeSeriesDataPoint[] = [];
            for (let i = 0; i <= days; i++) {
                const date = new Date(start.getTime() + i * 24 * 60 * 60 * 1000);
                mockData.push({
                    date: date.toISOString().split('T')[0],
                    streams: 1000 + (i * 123) % 4000,
                    revenue: 10 + (i * 45) % 50
                });
            }

            setData(mockData);
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to fetch analytics';
            setError(message);
            console.error('[useAnalytics] Error:', err);
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
 * Hook to fetch payout history
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
            // TODO: Replace with actual Firestore query
            // const firestorePayouts = await getPayoutsForUser(userProfile.id);

            // Mock data for now
            const mockPayouts: PayoutRecord[] = [
                {
                    id: 'p-1',
                    date: '2026-01-25T10:00:00Z',
                    amount: 824.12,
                    currencyCode: 'USD',
                    status: 'paid',
                    method: 'PayPal (****8293)',
                    releases: [
                        { id: '1', title: 'Midnight Pulse', amount: 450.00 },
                        { id: '2', title: 'Neon Dreams', amount: 374.12 }
                    ]
                },
                {
                    id: 'p-2',
                    date: '2025-12-26T14:30:00Z',
                    amount: 1240.50,
                    currencyCode: 'USD',
                    status: 'paid',
                    method: 'Bank Transfer (****0192)',
                    releases: [
                        { id: '1', title: 'Midnight Pulse', amount: 900.00 },
                        { id: '3', title: 'Cyber City', amount: 340.50 }
                    ]
                }
            ];

            setPayouts(mockPayouts);
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to fetch payouts';
            setError(message);
            console.error('[usePayouts] Error:', err);
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
