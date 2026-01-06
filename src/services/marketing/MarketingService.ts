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

        // Auto-seed if missing
        return this.seedDatabase(userProfile.id);
    }

    private static async seedDatabase(userId: string) {
        const initialStats = {
            totalReach: 15400,
            engagementRate: 4.2,
            activeCampaigns: 1
        };

        const statsRef = doc(db, 'users', userId, 'stats', 'marketing');
        await setDoc(statsRef, {
            ...initialStats,
            lastUpdated: serverTimestamp()
        });

        // Seed a default campaign
        const campaignData = {
            name: 'Launch Campaign (Demo)',
            platform: 'instagram',
            startDate: Timestamp.now().toMillis(), // Store as number for consistency with types often used
            status: CampaignStatus.EXECUTING,
            userId: userId,
            budget: 500,
            spent: 120,
            performance: {
                reach: 5400,
                clicks: 320
            },
            createdAt: serverTimestamp()
        };
        await addDoc(collection(db, 'campaigns'), campaignData);

        return initialStats;
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
            // validate data structure if needed, or cast with caution
            const { id: _, ...cleanData } = data;
            return {
                id: doc.id,
                ...cleanData,
            } as CampaignAsset;
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
                } as CampaignAsset;
            }
            return null;
        } catch (error) {
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

    /**
     * Update an existing campaign
     */
    static async updateCampaign(id: string, updates: Partial<CampaignAsset>) {
        const docRef = doc(db, 'campaigns', id);
        // Remove undefined fields to prevent firestore errors? Firestore handles undefined by ignoring or errors depending on config
        // But let's assume valid partial
        // Also remove 'id' if present in updates
        const { id: _id, ...cleanUpdates } = updates;
        await updateDoc(docRef, { ...cleanUpdates, updatedAt: serverTimestamp() });
    }
}
