import { StateCreator } from 'zustand';
import { logger } from '@/utils/logger';

export type SubscriptionId = string;
export type UnsubscribeFunction = () => void;

export interface SubscriptionSlice {
    activeSubscriptions: Record<SubscriptionId, UnsubscribeFunction>;

    /**
     * Registers a new Firestore onSnapshot unsubscribe function.
     * If an existing subscription with the same ID exists, it will be unsubscribed first.
     */
    registerSubscription: (id: SubscriptionId, unsubscribe: UnsubscribeFunction) => void;

    /**
     * Unsubscribes and removes a specific subscription by its ID.
     */
    clearSubscription: (id: SubscriptionId) => void;

    /**
     * Aggressively tears down all subscriptions that start with the given prefix.
     * Useful for clearing module-specific listeners when unmounting/navigating.
     */
    clearSubscriptionsByPrefix: (prefix: string) => void;

    /**
     * Clears all active subscriptions (e.g., on logout).
     */
    clearAllSubscriptions: () => void;
}

export const createSubscriptionSlice: StateCreator<SubscriptionSlice> = (set, get) => ({
    activeSubscriptions: {},

    registerSubscription: (id, unsubscribe) => {
        const { activeSubscriptions } = get();

        // Clean up existing subscription if overwriting
        if (activeSubscriptions[id]) {
            logger.warn(`[SubscriptionManager] Overwriting existing subscription for ID: ${id}`);
            activeSubscriptions[id]();
        }

        set((state) => ({
            activeSubscriptions: {
                ...state.activeSubscriptions,
                [id]: unsubscribe
            }
        }));

        logger.debug(`[SubscriptionManager] Registered subscription: ${id}`);
    },

    clearSubscription: (id) => {
        const { activeSubscriptions } = get();
        const unsubscribe = activeSubscriptions[id];

        if (unsubscribe) {
            unsubscribe();
            logger.debug(`[SubscriptionManager] Cleared subscription: ${id}`);

            set((state) => {
                const newSubscriptions = { ...state.activeSubscriptions };
                delete newSubscriptions[id];
                return { activeSubscriptions: newSubscriptions };
            });
        }
    },

    clearSubscriptionsByPrefix: (prefix) => {
        const { activeSubscriptions } = get();
        const keysToRemove = Object.keys(activeSubscriptions).filter(key => key.startsWith(prefix));

        if (keysToRemove.length === 0) return;

        set((state) => {
            const newSubscriptions = { ...state.activeSubscriptions };
            keysToRemove.forEach(key => {
                newSubscriptions[key](); // Execute unsubscribe
                delete newSubscriptions[key];
                logger.debug(`[SubscriptionManager] Cleared subscription by prefix: ${key}`);
            });
            return { activeSubscriptions: newSubscriptions };
        });
    },

    clearAllSubscriptions: () => {
        const { activeSubscriptions } = get();
        const keys = Object.keys(activeSubscriptions);

        if (keys.length === 0) return;

        keys.forEach(key => {
            activeSubscriptions[key]();
        });

        logger.info(`[SubscriptionManager] Cleared all (${keys.length}) active subscriptions`);
        set({ activeSubscriptions: {} });
    }
});
