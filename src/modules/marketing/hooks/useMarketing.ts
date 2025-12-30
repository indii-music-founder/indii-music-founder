import { useState, useEffect, useCallback } from 'react';
import { collection, query, where, orderBy, onSnapshot, doc } from 'firebase/firestore';
import { db } from '@/services/firebase';
import { useStore } from '@/core/store';
import { CampaignAsset, MarketingStats } from '../types';
import { MarketingService } from '@/services/marketing/MarketingService';
import { useToast } from '@/core/context/ToastContext';
import * as Sentry from '@sentry/react';

export function useMarketing() {
    const { userProfile } = useStore();
    const toast = useToast();

    // Data State
    const [stats, setStats] = useState<MarketingStats>({ totalReach: 0, engagementRate: 0, activeCampaigns: 0 });
    const [campaigns, setCampaigns] = useState<CampaignAsset[]>([]);

    // UI State
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    // Initial Data Fetch & Realtime Listeners
    useEffect(() => {
        if (!userProfile?.id) {
            const timer = setTimeout(() => setIsLoading(false), 0);
            return () => clearTimeout(timer);
        }

        const timer = setTimeout(() => setIsLoading(true), 0);

        const unsubscribe = () => clearTimeout(timer);

        try {
            // 1. Listen to Stats
            const statsRef = doc(db, 'users', userProfile.id, 'stats', 'marketing');
            const unsubscribeStats = onSnapshot(statsRef, (doc) => {
                if (doc.exists()) {
                    setStats(doc.data() as MarketingStats);
                } else {
                    // Initialize default stats if none exist
                    setStats({ totalReach: 0, engagementRate: 0, activeCampaigns: 0 });
                }
            }, (err) => {
                console.error("Error listening to marketing stats:", err);
                Sentry.captureException(err);
                setError(err);
                // Don't toast here to avoid spamming user on connection jitters
            });

            // 2. Listen to Campaigns
            const campaignsQuery = query(
                collection(db, 'campaigns'),
                where('userId', '==', userProfile.id),
                orderBy('startDate', 'desc')
            );

            const unsubscribeCampaigns = onSnapshot(campaignsQuery, (snapshot) => {
                const campaignsData = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                })) as CampaignAsset[];
                setCampaigns(campaignsData);
                setIsLoading(false);
            }, (err) => {
                console.error("Error listening to campaigns:", err);
                Sentry.captureException(err);
                setError(err);
                setIsLoading(false);
                toast.error("Failed to sync campaigns.");
            });

            return () => {
                unsubscribe();
                unsubscribeStats();
                unsubscribeCampaigns();
            };
        } catch (err) {
            console.error("Setup failed:", err);
            Sentry.captureException(err);
            const timer = setTimeout(() => {
                setError(err as Error);
                setIsLoading(false);
            }, 0);
            return () => clearTimeout(timer);
        }
    }, [userProfile?.id, toast]);

    // Actions
    const createCampaign = useCallback(async (campaign: Omit<CampaignAsset, 'id'>) => {
        if (!userProfile?.id) return;

        try {
            await MarketingService.createCampaign(campaign);
            toast.success("Campaign created successfully!");
            return true;
        } catch (err) {
            console.error("Failed to create campaign:", err);
            Sentry.captureException(err);
            toast.error("Failed to create campaign.");
            return false;
        }
    }, [userProfile?.id, toast]);

    const refreshDashboard = useCallback(async () => {
        // Since we use real-time listeners, this might just force a re-fetch of non-realtime data if any
        // For now, it's a no-op or could trigger a manual sync if we had one
        try {
            await MarketingService.getMarketingStats(); // Just to verify connection
        } catch (err) {
            console.error("Refresh failed:", err);
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
