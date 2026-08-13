import { useCallback, useEffect, useState, useRef } from 'react';
import { useStore } from '@/core/store';
import { useShallow } from 'zustand/react/shallow';
import { useToast } from '@/core/context/ToastContext';
import { subscriptionService } from '@/services/subscription/SubscriptionService';
import type { Subscription, UsageStats, SubscriptionTier } from '@/services/subscription/types';
import { logger } from '@/utils/logger';

export function useSubscription() {
    const { userProfile, user, authLoading } = useStore(useShallow(state => ({
        userProfile: state.userProfile,
        user: state.user,
        authLoading: state.authLoading
    })));
    const [subscription, setSubscription] = useState<Subscription | null>(null);
    const [usage, setUsage] = useState<UsageStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const toast = useToast();

    const isMounted = useRef(true);

    useEffect(() => {
        isMounted.current = true;
        return () => {
            isMounted.current = false;
        };
    }, []);

    const fetchSubscriptionData = useCallback(async (forceRefresh = false) => {
        if (authLoading) {
            setLoading(true);
            return;
        }

        if (!user?.uid) {
            setSubscription(null);
            setUsage(null);
            setLoading(false);
            setError(null);
            return;
        }

        const billingUserId = user.uid;
        if (userProfile?.id && userProfile.id !== 'pending' && userProfile.id !== billingUserId) {
            logger.warn('[useSubscription] Ignoring stale userProfile id for billing lookup.', {
                profileId: userProfile.id,
                authUid: billingUserId
            });
        }

        setLoading(true);
        setError(null);

        try {
            const [subData, usageData] = await Promise.all([
                subscriptionService.getSubscription(billingUserId, forceRefresh),
                subscriptionService.getUsageStats(billingUserId, forceRefresh)
            ]);

            if (!isMounted.current) return;

            setSubscription(subData);
            setUsage(usageData);

            // If we got a fallback during a manual refresh, warn the user
            if (forceRefresh && subData.isFallback) {
                toast.error('Could not sync with billing server. Using local cache.');
            }
        } catch (err: unknown) {
            if (!isMounted.current) return;

            // This block should technically never be hit now that the service has fallbacks,
            // but we keep it for extra safety.
            const message = err instanceof Error ? err.message : 'Failed to fetch subscription data';
            logger.error('[useSubscription] Error:', err);
            
            // Only show toast for manual refreshes to avoid navigation spam
            if (forceRefresh) {
                toast.error(message);
            }
            setError(message);
        } finally {
            if (isMounted.current) {
                setLoading(false);
            }
        }
    }, [authLoading, user?.uid, userProfile?.id, toast]);

    useEffect(() => {
        fetchSubscriptionData();
    }, [fetchSubscriptionData]);

    const createCheckoutSession = useCallback(async (tier: SubscriptionTier) => {
        if (!user?.uid) return;

        try {
            const result = await subscriptionService.createCheckoutSession({
                userId: user.uid,
                tier: tier,
                successUrl: window.location.origin + '/finance?session_id={CHECKOUT_SESSION_ID}',
                cancelUrl: window.location.origin + '/finance'
            });

            if (result.checkoutUrl) {
                window.location.href = result.checkoutUrl;
            }
        } catch (err: unknown) {
            logger.error('[useSubscription] Checkout failed:', err);
            toast.error('Failed to start checkout. Please try again.');
        }
    }, [user?.uid, toast]);

    const getPortalUrl = useCallback(async () => {
        try {
            const result = await subscriptionService.getCustomerPortalUrl(window.location.origin + '/finance');
            if (result.url) {
                window.location.href = result.url;
            }
        } catch (err: unknown) {
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
