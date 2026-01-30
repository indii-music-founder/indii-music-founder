import { useState, useEffect, useCallback } from 'react';
import { useStore } from '@/core/store';
import { DistributorService } from '@/services/distribution/DistributorService';
import type { DistributorId, DistributorCredentials, DistributorConnection } from '@/services/distribution/types/distributor';

export interface DistributorConnectionState extends DistributorConnection {
    // Add any additional UI-specific state here if needed
}

export function useDistributorConnections() {
    const { distribution, fetchDistributors, connectDistributor } = useStore();
    const [localLoading, setLocalLoading] = useState(false);

    const refresh = useCallback(async () => {
        await fetchDistributors();
    }, [fetchDistributors]);

    const connect = useCallback(async (id: DistributorId, credentials?: DistributorCredentials) => {
        setLocalLoading(true);
        try {
            await connectDistributor(id, credentials);
            await refresh();
        } finally {
            setLocalLoading(false);
        }
    }, [connectDistributor, refresh]);

    const disconnect = useCallback(async (id: DistributorId) => {
        setLocalLoading(true);
        try {
            await DistributorService.disconnect(id);
            await refresh();
        } finally {
            setLocalLoading(false);
        }
    }, [refresh]);

    useEffect(() => {
        if (distribution.connections.length === 0 && !distribution.loading) {
            refresh();
        }
    }, [refresh, distribution.connections.length, distribution.loading]);

    return {
        connections: distribution.connections,
        availableDistributors: distribution.availableDistributors,
        loading: distribution.loading || localLoading,
        isConnecting: distribution.isConnecting,
        error: distribution.error,
        connect,
        disconnect,
        refresh
    };
}
