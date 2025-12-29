import { useState, useEffect } from 'react';
import { collection, query, where, orderBy, onSnapshot, doc } from 'firebase/firestore';
import { db } from '@/services/firebase';
import { useStore } from '@/core/store';
import { CampaignAsset } from '../types';
import { MarketingService } from '@/services/marketing/MarketingService';

export interface MarketingStats {
    totalReach: number;
    engagementRate: number;
    activeCampaigns: number;
}

export function useMarketing() {
    const { userProfile } = useStore();
    const [stats, setStats] = useState<MarketingStats | null>(null);
    const [campaigns, setCampaigns] = useState<CampaignAsset[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    useEffect(() => {
        if (!userProfile?.id) {
            setLoading(false);
            return;
        }

        setLoading(true);

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
            setError(err);
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
            setLoading(false);
        }, (err) => {
            console.error("Error listening to campaigns:", err);
            setError(err);
            setLoading(false);
        });

        return () => {
            unsubscribeStats();
            unsubscribeCampaigns();
        };
    }, [userProfile?.id]);

    const createCampaign = async (campaign: Omit<CampaignAsset, 'id'>) => {
        try {
            return await MarketingService.createCampaign(campaign);
        } catch (err) {
            setError(err as Error);
            throw err;
        }
    };

    return { stats, campaigns, loading, error, createCampaign };
}
