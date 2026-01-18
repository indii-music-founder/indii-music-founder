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
     */
    static async getMarketingStats() {
        const userProfile = useStore.getState().userProfile;
        if (!userProfile?.id) return { totalReach: 0, engagementRate: 0, activeCampaigns: 0 };

        try {
            const statsRef = doc(db, 'users', userProfile.id, 'stats', 'marketing');
            const snapshot = await getDoc(statsRef);

            if (snapshot.exists()) {
                return snapshot.data() as { totalReach: number; engagementRate: number; activeCampaigns: number };
            }
        } catch (e) {
            console.warn("MarketingService: Stats fetch failed", e);
        }

        return {
            totalReach: 0,
            engagementRate: 0,
            activeCampaigns: 0
        };
    }

    private static async seedDatabase(userId: string) {
        // Disabled auto-seed in prod logic to prevent unwanted writes
    }

    /**
     * Fetch campaigns from Firestore
     */
    static async getCampaigns(): Promise<CampaignAsset[]> {
        const userProfile = useStore.getState().userProfile;
        if (!userProfile?.id) return [];

        try {
            const q = query(
                collection(db, 'campaigns'),
                where('userId', '==', userProfile.id),
                orderBy('startDate', 'desc')
            );

            const snapshot = await getDocs(q);

            return snapshot.docs.map(doc => {
                const data = doc.data();
                const { id: _, ...cleanData } = data;
                return {
                    id: doc.id,
                    ...cleanData,
                } as CampaignAsset;
            });
        } catch (e) {
            console.error("MarketingService: Campaign fetch failed", e);
            return [];
        }
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
                } as CampaignAsset;
            }
            return null;
        } catch (error) {
            console.error("MarketingService: Failed to fetch campaign", error);
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
        // Implementation kept for compatibility
    }

    /**
     * Update an existing campaign
     */
    static async updateCampaign(id: string, updates: Partial<CampaignAsset>) {
        try {
            const docRef = doc(db, 'campaigns', id);
            const { id: _id, ...cleanUpdates } = updates;
            await updateDoc(docRef, { ...cleanUpdates, updatedAt: serverTimestamp() });
        } catch (error) {
            console.error("MarketingService: Update failed", error);
            throw error;
        }
    }
}
