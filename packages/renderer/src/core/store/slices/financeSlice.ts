import { StateCreator } from 'zustand';
import { type EarningsSummary } from '@/services/revenue/schema';
import { ProfileSlice } from './profileSlice';
import { SubscriptionSlice } from './subscriptionSlice';
import { logger } from '@/utils/logger';

let financeUnsubscribe: (() => void) | null = null;

export interface FinanceSlice {
    finance: {
        earningsSummary: EarningsSummary | null;
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
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
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
            if (financeUnsubscribe) {
                financeUnsubscribe();
                financeUnsubscribe = null;
            }

            const unsubscribe = financeService.subscribeToEarnings(userId, (data: EarningsSummary | null) => {
                set((state) => ({
                    finance: {
                        ...state.finance,
                        loading: false,
                        earningsSummary: data,
                        error: null
                    }
                }));
            });

            financeUnsubscribe = unsubscribe;
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

