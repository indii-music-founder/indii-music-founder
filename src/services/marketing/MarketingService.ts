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
    Timestamp,
    setDoc
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
            return snapshot.data() as { totalReach: number; engagementRate: number; activeCampaigns: number };
        }

        return {
            totalReach: 0,
            engagementRate: 0,
            activeCampaigns: 0
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
        console.log('DEBUG: Campaigns Snapshot Size:', snapshot.docs.length);
        return snapshot.docs.map(doc => {
            const data = doc.data();
            // validate data structure if needed, or cast with caution
            return {
                id: doc.id,
                ...data,
            } as unknown as CampaignAsset;
        });
    }

    /**
     * Get a single campaign by ID
     */
    static async getCampaignById(id: string): Promise<CampaignAsset | null> {
        try {
            const docRef = doc(db, 'campaigns', id);
            const snapshot = await getDoc(docRef);

            if (snapshot.exists()) {
                const data = snapshot.data();
                return {
                    id: snapshot.id,
                    ...data,
                } as unknown as CampaignAsset;
            }
            return null;
        } catch (error) {
            console.error('Error fetching campaign:', error);
            return null;
        }
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

    /**
     * Update Marketing Stats
     */
    static async updateMarketingStats(stats: { totalReach?: number; engagementRate?: number; activeCampaigns?: number }) {
        const userProfile = useStore.getState().userProfile;
        if (!userProfile?.id) throw new Error("User not authenticated");

        const statsRef = doc(db, 'users', userProfile.id, 'stats', 'marketing');
        await setDoc(statsRef, {
            ...stats,
            lastUpdated: serverTimestamp()
        }, { merge: true });
    }
}
