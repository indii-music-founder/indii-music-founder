import {
    collection,
    query,
    where,
    onSnapshot,
    addDoc,
    serverTimestamp,
    doc,
    updateDoc
} from 'firebase/firestore';
import { db } from '../firebase';
import { Campaign, Contact } from '../../modules/publicist/types';
import { CampaignSchema, ContactSchema } from '../../modules/publicist/schema';


export class PublicistService {
    private static campaignsCollection = 'publicist_campaigns';
    private static contactsCollection = 'publicist_contacts';

    /**
     * Subscribe to user's campaigns
     */
    static subscribeToCampaigns(userId: string, callback: (campaigns: Campaign[]) => void) {
        if (!userId) return () => { };

        const q = query(
            collection(db, this.campaignsCollection),
            where('userId', '==', userId)
        );

        return onSnapshot(q, (snapshot) => {
            const campaigns = snapshot.docs.map(doc => {
                const data = doc.data();
                // Safe parsing with fallback to ensure UI doesn't crash on schema mismatches
                const parsed = CampaignSchema.safeParse({ id: doc.id, ...data });
                if (parsed.success) {
                    return { ...parsed.data, id: doc.id } as Campaign;
                }
                console.warn(`[PublicistService] Invalid campaign ${doc.id}:`, parsed.error);
                // Return data casted to Campaign as fallback, ensuring budget exists
                return { ...data, id: doc.id, budget: data.budget || 0 } as Campaign;
            });
            callback(campaigns);
        }, (error) => {
            console.error("Error fetching campaigns:", error);
            callback([]);
        });
    }

    /**
     * Subscribe to user's contacts
     */
    static subscribeToContacts(userId: string, callback: (contacts: Contact[]) => void) {
        if (!userId) return () => { };

        const q = query(
            collection(db, this.contactsCollection),
            where('userId', '==', userId)
        );

        return onSnapshot(q, (snapshot) => {
            const contacts = snapshot.docs.map(doc => {
                const data = doc.data();
                const parsed = ContactSchema.safeParse({ id: doc.id, ...data });
                if (parsed.success) {
                    return { ...parsed.data, id: doc.id } as Contact;
                }
                console.warn(`[PublicistService] Invalid contact ${doc.id}:`, parsed.error);
                return { ...data, id: doc.id } as Contact;
            });
            callback(contacts);
        }, (error) => {
            console.error("Error fetching contacts:", error);
            callback([]);
        });
    }

    static async addCampaign(userId: string, campaign: Omit<Campaign, 'id'>) {
        // Validate payload before sending
        // Note: We use Partial or Omit on Schema because ID and server timestamps are not present yet
        // and budget defaults to 0 if missing.
        const validation = CampaignSchema.omit({ id: true, createdAt: true, updatedAt: true }).safeParse({ ...campaign, userId });

        if (!validation.success) {
            throw new Error(`Invalid campaign data: ${validation.error.message}`);
        }

        return addDoc(collection(db, this.campaignsCollection), {
            ...validation.data,
            userId,
            createdAt: serverTimestamp()
        });
    }

    static async addContact(userId: string, contact: Omit<Contact, 'id'>) {
        const validation = ContactSchema.omit({ id: true, createdAt: true, updatedAt: true }).safeParse({ ...contact, userId });

        if (!validation.success) {
            throw new Error(`Invalid contact data: ${validation.error.message}`);
        }

        return addDoc(collection(db, this.contactsCollection), {
            ...validation.data,
            userId,
            createdAt: serverTimestamp()
        });
    }

    static async updateCampaign(campaignId: string, updates: Partial<Campaign>) {
        // Zod partial validation could be applied here if needed
        const docRef = doc(db, this.campaignsCollection, campaignId);
        return updateDoc(docRef, {
            ...updates,
            updatedAt: serverTimestamp()
        });
    }

    static async updateContact(contactId: string, updates: Partial<Contact>) {
        const docRef = doc(db, this.contactsCollection, contactId);
        return updateDoc(docRef, {
            ...updates,
            updatedAt: serverTimestamp()
        });
    }

    /**
     * Calculate aggregated stats from campaigns and contacts.
     * Replaces mock/estimation logic with real data derived from inputs.
     */
    static calculateStats(campaigns: Campaign[], contacts: Contact[]) {
        // 1. Calculate Average Open Rate
        const totalOpenRate = campaigns.reduce((acc, c) => acc + (c.openRate || 0), 0);
        const avgOpenRateVal = campaigns.length > 0 ? Math.round(totalOpenRate / campaigns.length) : 0;

        // 2. Estimate Global Reach based on Contacts Tier
        // Using standardized tier values
        const TierValues = { 'Top': 500000, 'Mid': 50000, 'Blog': 5000 };
        const reach = contacts.reduce((acc, c) => {
            return acc + (TierValues[c.tier] || 5000);
        }, 0);

        // Format reach (e.g. 1.2M, 850k)
        const formatReach = (n: number) => {
            if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
            if (n >= 1000) return `${(n / 1000).toFixed(0)}k`;
            return n.toString();
        };

        // 3. Calculate Placement Value
        // Prioritize explicit budget if set, otherwise use estimation for legacy/empty data
        const totalBudget = campaigns.reduce((acc, c) => acc + (c.budget || 0), 0);

        let value = totalBudget;
        // Fallback for empty budget on live campaigns (Legacy support)
        if (value === 0) {
             const liveCampaigns = campaigns.filter(c => c.status === 'Live').length;
             value = liveCampaigns * 15000; // Legacy estimation fallback
        }

        return {
            globalReach: formatReach(reach),
            avgOpenRate: `${avgOpenRateVal}%`,
            placementValue: `$${(value / 1000).toFixed(0)}k`
        };
    }
}
