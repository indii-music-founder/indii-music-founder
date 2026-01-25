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
    updateDoc,
} from 'firebase/firestore';
import { useStore } from '@/core/store';
import { CampaignAsset, CampaignStatus, MarketingStats } from '@/modules/marketing/types';
import { CampaignAssetSchema, MarketingStatsSchema } from '@/modules/marketing/schemas';

export class MarketingService {
    /**
     * Get Marketing Stats
     */
    static async getMarketingStats(): Promise<MarketingStats> {
        const userProfile = useStore.getState().userProfile;
        if (!userProfile?.id) return { totalReach: 0, engagementRate: 0, activeCampaigns: 0 };

        try {
            const statsRef = doc(db, 'users', userProfile.id, 'stats', 'marketing');
            const snapshot = await getDoc(statsRef);

            if (snapshot.exists()) {
                const data = snapshot.data();
                const validation = MarketingStatsSchema.safeParse(data);
                if (validation.success) {
                    return validation.data;
                } else {
                    console.warn("[MarketingService] Invalid marketing stats data:", validation.error);
                }
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

            const results: CampaignAsset[] = [];
            for (const doc of snapshot.docs) {
                const data = { id: doc.id, ...doc.data() };

                // 🛡️ Sentinel: Strict schema validation
                const parseResult = CampaignAssetSchema.safeParse(data);
                if (parseResult.success) {
                    results.push(parseResult.data as CampaignAsset);
                } else {
                    console.warn(`[MarketingService] Skipping invalid campaign ${doc.id}:`, parseResult.error);
                }
            }
            return results;
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
                const data = { id: snapshot.id, ...snapshot.data() };
                const parseResult = CampaignAssetSchema.safeParse(data);
                if (parseResult.success) {
                    return parseResult.data as CampaignAsset;
                }
                console.error(`[MarketingService] Invalid campaign data for ${id}:`, parseResult.error);
                return null;
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

        // Validate input structure before write (ignoring id)
        const validation = CampaignAssetSchema.safeParse(campaign);
        if (!validation.success) {
             console.error("[MarketingService] Invalid campaign input:", validation.error);
             throw new Error("Invalid campaign data");
        }

        const campaignData = {
            ...validation.data, // Use validated data to strip unknown fields
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
            // Partial validation could be complex, but let's assume partial updates are trusted for now
            // or we validate known fields.
            // Removing 'id' to prevent overwriting document key
            const { id: _id, ...cleanUpdates } = updates;
            await updateDoc(docRef, { ...cleanUpdates, updatedAt: serverTimestamp() });
        } catch (error) {
            console.error("MarketingService: Update failed", error);
            throw error;
        }
    }
}
