import { StateCreator } from 'zustand';
import { DistributorConnection, DistributorId, DashboardRelease } from '@/services/distribution/types/distributor';
import { DistributorService } from '@/services/distribution/DistributorService';
import { DistributionSyncService } from '@/services/distribution/DistributionSyncService';

export interface DistributionSlice {
    distribution: {
        connections: DistributorConnection[];
        availableDistributors: DistributorId[];
        releases: DashboardRelease[];
        loading: boolean;
        error: string | null;
    };
    fetchDistributors: () => Promise<void>;
    connectDistributor: (distributorId: DistributorId) => Promise<void>;
    fetchReleases: () => Promise<void>;
}

export const createDistributionSlice: StateCreator<DistributionSlice> = (set, get) => ({
    distribution: {
        connections: [],
        availableDistributors: [],
        releases: [],
        loading: false,
        error: null,
    },
    fetchDistributors: async () => {
        set((state) => ({ distribution: { ...state.distribution, loading: true } }));

        try {
            const connections = await DistributorService.getConnectionStatus();
            const available = DistributorService.getRegisteredDistributors();

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
    connectDistributor: async (distributorId: DistributorId) => {
        set((state) => ({ distribution: { ...state.distribution, loading: true, error: null } }));

        try {
            // For Alpha, we simulate connection with mock credentials if none provided
            await DistributorService.connect(distributorId, { apiKey: 'ALPHA_MOCK_KEY' });

            // Refresh connections after successful connect
            const connections = await DistributorService.getConnectionStatus();

            set((state) => ({
                distribution: {
                    ...state.distribution,
                    loading: false,
                    connections,
                    error: null
                }
            }));
        } catch (error) {
            set((state) => ({
                distribution: {
                    ...state.distribution,
                    loading: false,
                    error: error instanceof Error ? error.message : 'Failed to connect distributor'
                }
            }));
        }
    },
    fetchReleases: async () => {
        const { currentOrganizationId } = get() as any;

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
    }
});
