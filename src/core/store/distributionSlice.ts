import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import type { DistributorConnection, DistributorId } from '@/services/distribution/types/distributor';

// Mock fetching distributors
export const fetchDistributors = createAsyncThunk(
    'distribution/fetchDistributors',
    async () => {
        await new Promise(resolve => setTimeout(resolve, 800)); // Simulate latency

        // Mock data based on DistributorConnection interface
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
        return mockDistributors;
    }
);

// Mock connecting
export const connectDistributor = createAsyncThunk(
    'distribution/connect',
    async (distributorId: DistributorId) => {
        await new Promise(resolve => setTimeout(resolve, 1500));
        return distributorId;
    }
);

interface DistributionState {
    connections: DistributorConnection[];
    loading: boolean;
    error: string | null;
}

const initialState: DistributionState = {
    connections: [],
    loading: false,
    error: null,
};

export const distributionSlice = createSlice({
    name: 'distribution',
    initialState,
    reducers: {},
    extraReducers: (builder) => {
        builder
            .addCase(fetchDistributors.pending, (state) => {
                state.loading = true;
            })
            .addCase(fetchDistributors.fulfilled, (state, action) => {
                state.loading = false;
                state.connections = action.payload;
            })
            .addCase(fetchDistributors.rejected, (state, action) => {
                state.loading = false;
                state.error = action.error.message || 'Failed to fetch';
            })
            // Handle connect mock
            .addCase(connectDistributor.fulfilled, (state, action) => {
                const dist = state.connections.find(d => d.distributorId === action.payload);
                if (dist) {
                    dist.isConnected = true;
                    dist.lastSyncedAt = new Date().toISOString();
                }
            });
    },
});

export default distributionSlice.reducer;
