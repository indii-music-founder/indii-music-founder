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
        const { user } = (get() as any);
        if (!user) return;

        set((state) => ({ finance: { ...state.finance, loading: true } }));

        try {
            const { FinanceService } = await import('@/services/finance/FinanceService');
            const summary = await FinanceService.fetchEarnings(user.uid);

            set((state) => ({
                finance: {
                    ...state.finance,
                    loading: false,
                    earningsSummary: summary,
                    error: null
                }
            }));
        } catch (error: any) {
            set((state) => ({
                finance: {
                    ...state.finance,
                    loading: false,
                    error: error.message
                }
            }));
        }
    }

});
