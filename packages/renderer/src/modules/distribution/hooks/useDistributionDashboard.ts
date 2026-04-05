import { useEffect, useCallback } from 'react';
import { useStore } from '@/core/store';
import { useShallow } from 'zustand/react/shallow';
import { safeUnsubscribe } from '@/utils/safeUnsubscribe';

export function useDistributionDashboard() {
    const { releases, loading, error, subscribeToReleases } = useStore(
        useShallow((s) => ({
            releases: s.distribution.releases,
            loading: s.distribution.loading,
            error: s.distribution.error,
            subscribeToReleases: s.subscribeToReleases,
        }))
    );

    useEffect(() => {
        const unsubscribe = subscribeToReleases();
        return () => safeUnsubscribe(unsubscribe);
    }, [subscribeToReleases]);

    const handleRetry = useCallback(() => {
        subscribeToReleases();
    }, [subscribeToReleases]);

    return {
        releases,
        loading,
        error,
        handleRetry,
    };
}
