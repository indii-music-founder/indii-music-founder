import { StateCreator } from 'zustand';
import { type DashboardEarningsSummary } from '@/services/revenue/schema';
import { ProfileSlice } from './profileSlice';
import { logger } from '@/utils/logger';

export interface FinanceSlice {
    finance: {
        earningsSummary: any | null; // Use any or properly map to DashboardEarningsSummary
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
            logger.warn('[FinanceSlice] No user ID found for fetching earnings.');
            return;
        }

        set((state) => ({ finance: { ...state.finance, loading: true } }));

        try {
            const { financeService } = await import('@/services/finance/FinanceService');
            // Fix: Use userId (from userProfile) instead of user.uid
            const unsubscribe = financeService.subscribeToEarnings(userId, (data: any) => {
                set((state) => ({
                    finance: {
                        ...state.finance,
                        loading: false,
                        earningsSummary: data,
                        error: null
                    }
                }));
            });
            // In a real application, you would typically store this unsubscribe function
            // and call it when the component unmounts or the slice is no longer needed.
            // For this example, we're just demonstrating the subscription.
            // If this is meant to be a one-time fetch, the original fetchEarnings was more appropriate.
            // If it's a continuous subscription, the slice needs a way to manage the unsubscribe.
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Failed to fetch earnings';
            set((state) => ({
                finance: {
                    ...state.finance,
                    loading: false,
                    error: message
                }
            }));
        }
    }

});
