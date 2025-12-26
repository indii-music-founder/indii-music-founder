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
        await new Promise(resolve => setTimeout(resolve, 800)); // Simulate latency

        const mockDistributors: DistributorConnection[] = [
            {
                distributorId: 'distrokid',
                isConnected: true,
                accountId: 'dk_12345',
                accountEmail: 'artist@indii.os',
                lastSyncedAt: new Date().toISOString(),
                features: {
                    canCreateRelease: true,
                    canUpdateRelease: true,
                    canTakedown: true,
                    canFetchEarnings: true,
                    canFetchAnalytics: false
                }
            },
            {
                distributorId: 'cdbaby',
                isConnected: false,
                features: {
                    canCreateRelease: true,
                    canUpdateRelease: false,
                    canTakedown: true,
                    canFetchEarnings: true,
                    canFetchAnalytics: true
                }
            },
            {
                distributorId: 'tunecore',
                isConnected: false,
                features: {
                    canCreateRelease: true,
                    canUpdateRelease: true,
                    canTakedown: true,
                    canFetchEarnings: true,
                    canFetchAnalytics: true
                }
            }
        ];

        set((state) => ({
            distribution: {
                ...state.distribution,
                loading: false,
                connections: mockDistributors
            }
        }));
    },
    connectDistributor: async (distributorId: DistributorId) => {
        set((state) => ({ distribution: { ...state.distribution, loading: true } }));
        await new Promise(resolve => setTimeout(resolve, 1500));

        set((state) => {
            const newConnections = state.distribution.connections.map(d => {
                if (d.distributorId === distributorId) {
                    return {
                        ...d,
                        isConnected: true,
                        lastSyncedAt: new Date().toISOString()
                    };
                }
                return d;
            });

            return {
                distribution: {
                    ...state.distribution,
                    loading: false,
                    connections: newConnections
                }
            };
        });
    }
});
