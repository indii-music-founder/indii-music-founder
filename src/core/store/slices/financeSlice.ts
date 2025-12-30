import { StateCreator } from 'zustand';
import { EarningsSummary } from '@/services/ddex/types/dsr';
import { ProfileSlice } from './profileSlice';

export interface FinanceSlice {
    finance: {
        earningsSummary: EarningsSummary | null;
        loading: boolean;
        error: string | null;
    };
    fetchEarnings: (period: { startDate: string; endDate: string }) => Promise<void>;
}

export const createFinanceSlice: StateCreator<FinanceSlice & ProfileSlice, [], [], FinanceSlice> = (set, get) => ({
    finance: {
        earningsSummary: null,
        loading: false,
        error: null,
    },
    fetchEarnings: async (period) => {
        const state = get();
        const userId = state.userProfile?.id;

        if (!userId) {
            console.warn('[FinanceSlice] No user ID found for fetching earnings.');
            return;
        }

        set((state) => ({ finance: { ...state.finance, loading: true } }));

        try {
            const { FinanceService } = await import('@/services/finance/FinanceService');
            // Fix: Use userId (from userProfile) instead of user.uid
            const summary = await FinanceService.fetchEarnings(userId);

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
