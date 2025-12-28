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

        // TODO: Replace with real DSR parsing when backend is ready
        // const summary = await FinanceService.fetchEarnings(orgId, period);

        set((state) => ({
            finance: {
                ...state.finance,
                loading: false,
                earningsSummary: null // No data until real backend integration
            }
        }));
    }
});
