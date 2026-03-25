/* eslint-disable @typescript-eslint/no-explicit-any -- Module component with dynamic data */
import { useCallback, useEffect, useState } from 'react';
import { useStore } from '@/core/store';
import { useToast } from '@/core/context/ToastContext';
import { subscriptionService } from '@/services/subscription/SubscriptionService';
import type { Subscription, UsageStats } from '@/services/subscription/types';
import { logger } from '@/utils/logger';

export function useSubscription() {
    const { userProfile } = useStore();
    const [subscription, setSubscription] = useState<Subscription | null>(null);
    const [usage, setUsage] = useState<UsageStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const toast = useToast();

    const fetchSubscriptionData = useCallback(async (forceRefresh = false) => {
        if (!userProfile?.id || userProfile.id === 'pending') return;

        setLoading(true);
        setError(null);

        try {
            const [subData, usageData] = await Promise.all([
                subscriptionService.getSubscription(userProfile.id, forceRefresh),
                subscriptionService.getUsageStats(userProfile.id, forceRefresh)
            ]);

            setSubscription(subData);
            setUsage(usageData);
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to fetch subscription data';
            logger.error('[useSubscription] Error:', err);
            setError(message);
            toast.error(message);
        } finally {
            setLoading(false);
        }
    }, [userProfile?.id, toast]);

    useEffect(() => {
        fetchSubscriptionData();
    }, [fetchSubscriptionData]);

    const createCheckoutSession = useCallback(async (tier: string) => {
        if (!userProfile?.id) return;

        try {
            const result = await subscriptionService.createCheckoutSession({
                userId: userProfile.id,
                tier: tier as any,
                successUrl: window.location.origin + '/finance?session_id={CHECKOUT_SESSION_ID}',
                cancelUrl: window.location.origin + '/finance'
            });

            if (result.checkoutUrl) {
                window.location.href = result.checkoutUrl;
            }
        } catch (err) {
            logger.error('[useSubscription] Checkout failed:', err);
            toast.error('Failed to start checkout. Please try again.');
        }
    }, [userProfile?.id, toast]);

    const getPortalUrl = useCallback(async () => {
        try {
            const result = await subscriptionService.getCustomerPortalUrl(window.location.origin + '/finance');
            if (result.url) {
                window.location.href = result.url;
            }
        } catch (err) {
            logger.error('[useSubscription] Portal failed:', err);
            toast.error('Failed to access billing portal.');
        }
    }, [toast]);

    return {
        subscription,
        usage,
        loading,
        error,
        refresh: () => fetchSubscriptionData(true),
        createCheckoutSession,
        getPortalUrl
    };
}
