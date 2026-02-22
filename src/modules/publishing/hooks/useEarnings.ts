import { useState, useEffect, useCallback } from 'react';
import { useStore } from '@/core/store';

export function useEarnings(period: { startDate: string; endDate: string }) {
    const { finance, fetchEarnings } = useStore();
    const [localLoading, setLocalLoading] = useState(false);

    const refresh = useCallback(async () => {
        setLocalLoading(true);
        try {
            await fetchEarnings(period);
        } finally {
            setLocalLoading(false);
        }
    }, [fetchEarnings, period]);

    useEffect(() => {
        if (!finance.earningsSummary && !finance.loading) {
            refresh();
        }
    }, [refresh, finance.earningsSummary, finance.loading]);

    return {
        earnings: finance.earningsSummary,
        loading: finance.loading || localLoading,
        error: finance.error,
        refresh
    };
}
