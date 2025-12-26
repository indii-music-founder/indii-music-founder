import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import type { EarningsSummary } from '@/services/ddex/types/dsr';

// Async thunk to fetch earnings (mocked for now)
export const fetchEarnings = createAsyncThunk(
    'finance/fetchEarnings',
    async (period: { startDate: string; endDate: string }) => {
        // In a real app, this would call an API or DB service
        // For now, return mock data
        await new Promise(resolve => setTimeout(resolve, 1000));

        const mockSummary: EarningsSummary = {
            period,
            totalGrossRevenue: 15430.50,
            totalNetRevenue: 12344.40,
            totalStreams: 4500000,
            totalDownloads: 1200,
            currencyCode: 'USD',
            byPlatform: [
                { platformName: 'Spotify', streams: 3000000, downloads: 0, revenue: 9000 },
                { platformName: 'Apple Music', streams: 1000000, downloads: 200, revenue: 4500 },
                { platformName: 'Tidal', streams: 500000, downloads: 0, revenue: 1930.50 }
            ],
            byTerritory: [
                { territoryCode: 'US', territoryName: 'United States', streams: 2500000, downloads: 800, revenue: 8000 },
                { territoryCode: 'GB', territoryName: 'United Kingdom', streams: 1000000, downloads: 200, revenue: 4000 }
            ],
            byRelease: [
                { releaseId: 'R1', releaseName: 'Summer Hits', isrc: 'US1234567890', streams: 2000000, downloads: 500, revenue: 6000 }
            ]
        };
        return mockSummary;
    }
);

interface FinanceState {
    earningsSummary: EarningsSummary | null;
    loading: boolean;
    error: string | null;
}

const initialState: FinanceState = {
    earningsSummary: null,
    loading: false,
    error: null,
};

export const financeSlice = createSlice({
    name: 'finance',
    initialState,
    reducers: {},
    extraReducers: (builder) => {
        builder
            .addCase(fetchEarnings.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(fetchEarnings.fulfilled, (state, action) => {
                state.loading = false;
                state.earningsSummary = action.payload;
            })
            .addCase(fetchEarnings.rejected, (state, action) => {
                state.loading = false;
                state.error = action.error.message || 'Failed to fetch earnings';
            });
    },
});

export default financeSlice.reducer;
