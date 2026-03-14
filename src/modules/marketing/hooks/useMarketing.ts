import { useState, useEffect, useCallback, useRef } from 'react';
import { collection, query, where, onSnapshot, doc } from 'firebase/firestore';
import { safeUnsubscribe } from '@/utils/safeUnsubscribe';
import { db, auth } from '@/services/firebase';
import { useStore } from '@/core/store';
import { CampaignAsset, MarketingStats } from '../types';
import { MarketingService } from '@/services/marketing/MarketingService';
import { useToast } from '@/core/context/ToastContext';
import * as Sentry from '@sentry/react';
import { logger } from '@/utils/logger';

export function useMarketing() {
    const { userProfile } = useStore();
    const toast = useToast();

    // Data State
    const [stats, setStats] = useState<MarketingStats>({ totalReach: 0, engagementRate: 0, activeCampaigns: 0 });
    const [campaigns, setCampaigns] = useState<CampaignAsset[]>([]);

    // UI State
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    // Mounted guard to prevent state updates on unmounted component (Firestore b815 crash fix)
    const isMountedRef = useRef(true);
    useEffect(() => {
        isMountedRef.current = true;
        return () => { isMountedRef.current = false; };
    }, []);

    // Initial Data Fetch & Realtime Listeners
    useEffect(() => {
        // Validation: If no profile, skip listeners
        if (!userProfile?.id) {
            const timer = setTimeout(() => setIsLoading(false), 0);
            return () => clearTimeout(timer);
        }

        const timer = setTimeout(() => setIsLoading(true), 0);
        const unsubscribe = () => clearTimeout(timer);

        let unsubscribeStats: () => void = () => { };
        let unsubscribeCampaigns: () => void = () => { };

        try {
            // 1. Listen to Stats
            const statsRef = doc(db, 'users', userProfile.id, 'stats', 'marketing');
            unsubscribeStats = onSnapshot(statsRef, (doc) => {
                if (!isMountedRef.current) return;
                if (doc.exists()) {
                    setStats(doc.data() as MarketingStats);
                } else {
                    // Initialize default stats if none exist
                    setStats({ totalReach: 0, engagementRate: 0, activeCampaigns: 0 });
                }
            }, (err) => {
                logger.error("Error listening to marketing stats:", err);
                // Sentry.captureException(err); // Optional: Silence expected permission errors
                setError(err);
            });

            // 2. Listen to Campaigns
            // NOTE: Removed orderBy('startDate', 'desc') to prevent Index-Required crashes or Assertions
            // We sort in-memory instead.
            const campaignsQuery = query(
                collection(db, 'campaigns'),
                where('userId', '==', userProfile.id)
            );

            unsubscribeCampaigns = onSnapshot(campaignsQuery, (snapshot) => {
                if (!isMountedRef.current) return;
                const campaignsData = snapshot.docs.map(doc => {
                    const data = doc.data();
                    let startDate = data.startDate;

                    // Normalize Firestore Timestamp to ISO string to prevent UI crashes
                    if (startDate && typeof startDate === 'object' && 'toDate' in startDate) {
                        startDate = (startDate as any).toDate().toISOString();
                    }

                    return {
                        id: doc.id,
                        ...data,
                        startDate
                    };
                }) as CampaignAsset[];

                // Client-side Sort
                campaignsData.sort((a, b) => {
                    const dateA = new Date(a.startDate).getTime();
                    const dateB = new Date(b.startDate).getTime();
                    return dateB - dateA; // Descending
                });

                setCampaigns(campaignsData);
                setIsLoading(false);
            }, (err) => {
                logger.error("Error listening to campaigns:", err);
                // Sentry.captureException(err);
                setError(err);
                setIsLoading(false);
                // Don't toast on initial load failure if it's just permissions
                if (err.code !== 'permission-denied') {
                    toast.error("Failed to sync campaigns.");
                }
            });

            return () => {
                unsubscribe();
                safeUnsubscribe(unsubscribeStats);
                safeUnsubscribe(unsubscribeCampaigns);
            };
        } catch (err) {
            logger.error("Setup failed:", err);
            Sentry.captureException(err);
            const timer = setTimeout(() => {
                setError(err as Error);
                setIsLoading(false);
            }, 0);
            return () => {
                unsubscribe();
                clearTimeout(timer);
                safeUnsubscribe(unsubscribeStats);
                safeUnsubscribe(unsubscribeCampaigns);
            };
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [userProfile?.id]);

    // Actions
    const createCampaign = useCallback(async (campaign: Omit<CampaignAsset, 'id'>) => {
        if (!userProfile?.id) return;

        try {
            await MarketingService.createCampaign(campaign);
            toast.success("Campaign created successfully!");
            return true;
        } catch (err: any) {
            logger.error("Failed to create campaign:", err);
            Sentry.captureException(err);

            if (err.code === 'permission-denied') {
                toast.error("You must be logged in to create campaigns.");
            } else {
                toast.error("Failed to create campaign.");
            }
            return false;
        }
    }, [userProfile?.id, toast]);

    const refreshDashboard = useCallback(async () => {
        try {
            await MarketingService.getMarketingStats();
        } catch (err) {
            logger.error("Refresh failed:", err);
        }
    }, []);

    return {
        // Data
        stats,
        campaigns,

        // UI State
        isLoading,
        error,

        // Actions
        actions: {
            createCampaign,
            refreshDashboard
        }
    };
}
