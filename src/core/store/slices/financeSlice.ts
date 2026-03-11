import { StateCreator } from 'zustand';
import { type DashboardEarningsSummary } from '@/services/revenue/schema';
import { ProfileSlice } from './profileSlice';
import { SubscriptionSlice } from './subscriptionSlice';
import { logger } from '@/utils/logger';

export interface FinanceSlice {
    finance: {
        earningsSummary: any | null; // Use any or properly map to DashboardEarningsSummary
        loading: boolean;
        error: string | null;
    };
    fetchEarnings: (period: { startDate: string; endDate: string }) => Promise<void>;
}

export const createFinanceSlice: StateCreator<FinanceSlice & ProfileSlice & SubscriptionSlice, [], [], FinanceSlice> = (set, get) => ({
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

            // Clear previous subscription before creating a new one
            state.clearSubscription?.('finance-earnings');

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

            // Register the unsubscribe so it's cleaned up when no longer needed
            state.registerSubscription?.('finance-earnings', unsubscribe);
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
