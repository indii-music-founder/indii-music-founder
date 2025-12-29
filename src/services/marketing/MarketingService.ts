import { db } from '@/services/firebase';
import {
    collection,
    doc,
    addDoc,
    getDoc,
    getDocs,
    query,
    where,
    orderBy,
    serverTimestamp,
    increment,
    updateDoc,
    Timestamp
} from 'firebase/firestore';
import { useStore } from '@/core/store';
import { CampaignAsset, CampaignStatus } from '@/modules/marketing/types';

export class MarketingService {
    /**
     * Get Marketing Stats
     * In a real app, this would be periodically aggregated by a cloud function.
     * Fallback to mock data if no real stats exist yet.
     */
    static async getMarketingStats() {
        const userProfile = useStore.getState().userProfile;
        if (!userProfile?.id) return { totalReach: 0, engagementRate: 0, activeCampaigns: 0 };

        const statsRef = doc(db, 'users', userProfile.id, 'stats', 'marketing');
        const snapshot = await getDoc(statsRef);

        if (snapshot.exists()) {
            return snapshot.data();
        }

        // Aggregate active campaigns count manually as a fallback
        const campaigns = await this.getCampaigns();
        const activeCount = campaigns.filter(c => (c as any).status === CampaignStatus.EXECUTING).length;

        return {
            totalReach: 124500, // Still returning a mock total if not tracked yet
            engagementRate: 4.8,
            activeCampaigns: activeCount
        };
    }

    /**
     * Fetch campaigns from Firestore
     */
    static async getCampaigns(): Promise<CampaignAsset[]> {
        const userProfile = useStore.getState().userProfile;
        if (!userProfile?.id) return [];

        const q = query(
            collection(db, 'campaigns'),
            where('userId', '==', userProfile.id),
            orderBy('startDate', 'desc')
        );

        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => {
            const data = doc.data();
            return {
                ...data,
                id: doc.id,
            } as any; // Cast as any then back to CampaignAsset for flexibility
        }) as CampaignAsset[];
    }

    /**
     * Create a new campaign
     */
    static async createCampaign(campaign: Omit<CampaignAsset, 'id'>): Promise<string> {
        const userProfile = useStore.getState().userProfile;
        if (!userProfile?.id) throw new Error("User not authenticated");

        const campaignData = {
            ...campaign,
            userId: userProfile.id,
            createdAt: serverTimestamp(),
            status: CampaignStatus.PENDING
        };

        const docRef = await addDoc(collection(db, 'campaigns'), campaignData);
        return docRef.id;
    }
}
