import { StateCreator } from 'zustand';
import { type EarningsSummary } from '@/services/revenue/schema';
import type { ProfileSlice } from './profileSlice';
import type { SubscriptionSlice } from './subscriptionSlice';
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
            }, (error: Error) => {
                // ISSUE-1278: the try/catch below only covers synchronous setup. A
                // snapshot listener that fails later (permission-denied, outage) never
                // reached it, so `loading` stayed true forever and `error` stayed null.
                set((state) => ({
                    finance: {
                        ...state.finance,
                        loading: false,
                        error: error.message || 'Failed to fetch earnings'
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

export function resetFinanceListener() {
    if (financeUnsubscribe) {
        financeUnsubscribe();
        financeUnsubscribe = null;
    }
}

