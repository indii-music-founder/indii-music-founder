import { useState, useEffect, useCallback } from 'react';
import { collection, query, where, onSnapshot, doc } from 'firebase/firestore';
import { db, auth } from '@/services/firebase';
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
        // Validation: If no profile, or if "guest" mode but no real auth, skip listeners
        // This prevents the "Internal Assertion Failed" crash when querying prohibited collections without auth
        const isGuestStub = userProfile?.id === 'guest';
        const isReallyAuthenticated = !!auth.currentUser;

        // TEST MODE HOOK: Bypass Firestore listeners if in test mode
        if (userProfile?.id === 'maestro-user-id' || (typeof window !== 'undefined' && (window as any).TEST_MODE)) {
            console.log("[Marketing] Running in Test Mode. Firestore sync bypassed.");
            setCampaigns([]); // Or mock campaigns if needed
            setStats({ totalReach: 1000, engagementRate: 5.5, activeCampaigns: 1 });
            const timer = setTimeout(() => setIsLoading(false), 0);
            return () => clearTimeout(timer);
        }

        if (!userProfile?.id || (isGuestStub && !isReallyAuthenticated)) {
            if (isGuestStub && !isReallyAuthenticated) {
                console.warn("[Marketing] Running in offline/guest stub mode. Firestore sync disabled.");
            }
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
                if (doc.exists()) {
                    setStats(doc.data() as MarketingStats);
                } else {
                    // Initialize default stats if none exist
                    setStats({ totalReach: 0, engagementRate: 0, activeCampaigns: 0 });
                }
            }, (err) => {
                console.error("Error listening to marketing stats:", err);
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
                const campaignsData = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                })) as CampaignAsset[];

                // Client-side Sort
                campaignsData.sort((a, b) => {
                    const dateA = new Date(a.startDate).getTime();
                    const dateB = new Date(b.startDate).getTime();
                    return dateB - dateA; // Descending
                });

                setCampaigns(campaignsData);
                setIsLoading(false);
            }, (err) => {
                console.error("Error listening to campaigns:", err);
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
            return () => {
                unsubscribe();
                clearTimeout(timer);
                if (unsubscribeStats) unsubscribeStats();
                if (unsubscribeCampaigns) unsubscribeCampaigns();
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
            console.error("Failed to create campaign:", err);
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
