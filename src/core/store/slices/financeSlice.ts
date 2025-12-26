import { StateCreator } from 'zustand';
import { EarningsSummary } from '@/services/ddex/types/dsr';

export interface FinanceSlice {
    finance: {
        earningsSummary: EarningsSummary | null;
        loading: boolean;
        error: string | null;
    };
    fetchEarnings: (period: { startDate: string; endDate: string }) => Promise<void>;
}

export const createFinanceSlice: StateCreator<FinanceSlice> = (set, get) => ({
    finance: {
        earningsSummary: null,
        loading: false,
        error: null,
    },
    fetchEarnings: async (period) => {
        set((state) => ({ finance: { ...state.finance, loading: true } }));
        await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate latency

        // Mock Data matching EarningsSummary structure
        const mockSummary: EarningsSummary = {
            period: {
                startDate: period.startDate,
                endDate: period.endDate
            },
            totalNetRevenue: 1250.50,
            totalGrossRevenue: 1500.00,
            totalStreams: 154000,
            totalDownloads: 500,
            currencyCode: 'USD',
            byPlatform: [
                { platformName: 'Spotify', revenue: 800.00, streams: 120000, downloads: 0 },
                { platformName: 'Apple Music', revenue: 350.50, streams: 34000, downloads: 0 },
                { platformName: 'iTunes', revenue: 100.00, streams: 0, downloads: 500 }
            ],
            byTerritory: [
                { territoryCode: 'US', territoryName: 'United States', revenue: 600.00, streams: 90000, downloads: 300 },
                { territoryCode: 'GB', territoryName: 'United Kingdom', revenue: 300.00, streams: 30000, downloads: 100 },
                { territoryCode: 'DE', territoryName: 'Germany', revenue: 150.00, streams: 14000, downloads: 50 },
                { territoryCode: 'JP', territoryName: 'Japan', revenue: 200.50, streams: 20000, downloads: 50 }
            ],
            byRelease: []
        };

        set((state) => ({
            finance: {
                ...state.finance,
                loading: false,
                earningsSummary: mockSummary
            }
        }));
    }
});
