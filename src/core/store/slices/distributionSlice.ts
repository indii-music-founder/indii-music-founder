import { StateCreator } from 'zustand';
import { DistributorConnection, DistributorId, DashboardRelease, DistributorCredentials } from '@/services/distribution/types/distributor';
import { DistributorService } from '@/services/distribution/DistributorService';

import { DistributionSyncService } from '@/services/distribution/DistributionSyncService';
import type { StoreState } from '../index';

export interface DistributionSlice {
    distribution: {
        connections: DistributorConnection[];
        availableDistributors: DistributorId[];
        releases: DashboardRelease[];
        loading: boolean;
        isConnecting: boolean;
        error: string | null;
    };
    fetchDistributors: () => Promise<void>;
    connectDistributor: (distributorId: DistributorId, credentials?: DistributorCredentials) => Promise<void>;
    fetchReleases: () => Promise<void>;
    setReleases: (releases: DashboardRelease[]) => void;
    subscribeToReleases: () => () => void;
}

export const createDistributionSlice: StateCreator<DistributionSlice> = (set, get) => ({
    distribution: {
        connections: [],
        availableDistributors: [],
        releases: [],
        loading: false,
        isConnecting: false,
        error: null,
    },
    fetchDistributors: async () => {
        set((state) => ({ distribution: { ...state.distribution, loading: true } }));

        try {
            const available = DistributorService.getRegisteredDistributors();

            // Attempt to auto-connect using stored credentials for all available distributors
            await Promise.all(available.map(async (id) => {
                try {
                    await DistributorService.connect(id);
                } catch {
                    // Ignore connection failures during fetch (e.g. no credentials stored)
                }
            }));

            const connections = await DistributorService.getConnectionStatus();

            set((state) => ({
                distribution: {
                    ...state.distribution,
                    loading: false,
                    connections,
                    availableDistributors: available,
                    error: null
                }
            }));
        } catch (error) {
            set((state) => ({
                distribution: {
                    ...state.distribution,
                    loading: false,
                    error: error instanceof Error ? error.message : 'Failed to fetch distributors'
                }
            }));
        }
    },
    connectDistributor: async (distributorId: DistributorId, credentials?: DistributorCredentials) => {
        set((state) => ({ distribution: { ...state.distribution, isConnecting: true, error: null } }));

        try {
            await DistributorService.connect(distributorId, credentials);

            // Refresh connections after successful connect
            const connections = await DistributorService.getConnectionStatus();

            set((state) => ({
                distribution: {
                    ...state.distribution,
                    loading: false,
                    isConnecting: false,
                    connections,
                    error: null
                }
            }));
        } catch (error) {
            set((state) => ({
                distribution: {
                    ...state.distribution,
                    loading: false,
                    isConnecting: false,
                    error: error instanceof Error ? error.message : 'Failed to connect distributor'
                }
            }));
        }
    },
    fetchReleases: async () => {
        const { currentOrganizationId } = get() as StoreState;

        if (!currentOrganizationId) {
            return;
        }

        set((state) => ({ distribution: { ...state.distribution, loading: true } }));

        try {
            const releases = await DistributionSyncService.fetchReleases(currentOrganizationId);
            set((state) => ({
                distribution: {
                    ...state.distribution,
                    loading: false,
                    releases,
                    error: null
                }
            }));
        } catch (error) {
            set((state) => ({
                distribution: {
                    ...state.distribution,
                    loading: false,
                    error: error instanceof Error ? error.message : 'Failed to fetch releases'
                }
            }));
        }
    },
    setReleases: (releases: DashboardRelease[]) => {
        set((state) => ({
            distribution: {
                ...state.distribution,
                releases,
                loading: false,
                error: null
            }
        }));
    },
    subscribeToReleases: () => {
        const { currentOrganizationId } = get() as StoreState;

        if (!currentOrganizationId) {
            return () => { };
        }

        set((state) => ({ distribution: { ...state.distribution, loading: true } }));

        return DistributionSyncService.subscribeToReleases(
            currentOrganizationId,
            (releases) => {
                get().setReleases(releases);
            },
            (error) => {
                set((state) => ({
                    distribution: {
                        ...state.distribution,
                        loading: false,
                        error: error.message
                    }
                }));
            }
        );
    }
});
