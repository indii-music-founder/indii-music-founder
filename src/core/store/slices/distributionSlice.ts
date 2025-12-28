import { StateCreator } from 'zustand';
import { DistributorConnection, DistributorId } from '@/services/distribution/types/distributor';

export interface DistributionSlice {
    distribution: {
        connections: DistributorConnection[];
        loading: boolean;
        error: string | null;
    };
    fetchDistributors: () => Promise<void>;
    connectDistributor: (distributorId: DistributorId) => Promise<void>;
}

export const createDistributionSlice: StateCreator<DistributionSlice> = (set, get) => ({
    distribution: {
        connections: [],
        loading: false,
        error: null,
    },
    fetchDistributors: async () => {
        set((state) => ({ distribution: { ...state.distribution, loading: true } }));

        // TODO: Replace with real Firestore query when backend is ready
        // const connections = await DistributionService.fetchConnections(orgId);

        set((state) => ({
            distribution: {
                ...state.distribution,
                loading: false,
                connections: [] // Empty until real backend integration
            }
        }));
    },
    connectDistributor: async (distributorId: DistributorId) => {
        set((state) => ({ distribution: { ...state.distribution, loading: true } }));

        // TODO: Replace with real OAuth flow when backend is ready
        // await DistributionService.initiateOAuth(distributorId);

        set((state) => ({
            distribution: {
                ...state.distribution,
                loading: false,
                error: 'Distributor connections coming soon. Backend integration required.'
            }
        }));
    }
});
