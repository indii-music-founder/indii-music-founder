import {
    collection,
    query,
    where,
    onSnapshot,
    addDoc,
    serverTimestamp,
    QuerySnapshot,
    DocumentData
} from 'firebase/firestore';
import { db } from '@/services/firebase';
import { Campaign, Contact } from '@/modules/publicist/types'; // Updated import path to alias
import { COLLECTIONS } from '@/core/config/collections';
import { z } from 'zod';

// Define Zod schemas for runtime validation
const CampaignSchema = z.object({
    userId: z.string().optional(),
    artist: z.string(),
    title: z.string(),
    status: z.enum(['Draft', 'Live', 'Scheduled', 'Ended']),
}).passthrough();

const ContactSchema = z.object({
    userId: z.string().optional(),
    name: z.string(),
    outlet: z.string(),
    role: z.enum(['Journalist', 'Curator', 'Influencer', 'Editor']),
}).passthrough();

export class PublicistService {
    /**
     * Subscribe to user's campaigns
     */
    static subscribeToCampaigns(userId: string, callback: (campaigns: Campaign[]) => void) {
        if (!userId) return () => { };

        const q = query(
            collection(db, COLLECTIONS.PUBLICIST.CAMPAIGNS),
            where('userId', '==', userId)
        );

        return onSnapshot(q, (snapshot: QuerySnapshot<DocumentData>) => {
            const campaigns: Campaign[] = [];

            snapshot.docs.forEach(doc => {
                const data = doc.data();
                const parseResult = CampaignSchema.safeParse(data);

                if (parseResult.success) {
                    campaigns.push({
                        id: doc.id,
                        ...data
                    } as Campaign);
                } else {
                    console.warn(`[PublicistService] Invalid campaign document ${doc.id}:`, parseResult.error);
                }
            });

            callback(campaigns);
        }, (error) => {
            console.error("[PublicistService] Error fetching campaigns:", error);
            callback([]);
        });
    }

    /**
     * Subscribe to user's contacts
     */
    static subscribeToContacts(userId: string, callback: (contacts: Contact[]) => void) {
        if (!userId) return () => { };

        const q = query(
            collection(db, COLLECTIONS.PUBLICIST.CONTACTS),
            where('userId', '==', userId)
        );

        return onSnapshot(q, (snapshot: QuerySnapshot<DocumentData>) => {
            const contacts: Contact[] = [];

            snapshot.docs.forEach(doc => {
                const data = doc.data();
                const parseResult = ContactSchema.safeParse(data);

                if (parseResult.success) {
                    contacts.push({
                        id: doc.id,
                        ...data
                    } as Contact);
                } else {
                    console.warn(`[PublicistService] Invalid contact document ${doc.id}:`, parseResult.error);
                }
            });

            callback(contacts);
        }, (error) => {
            console.error("[PublicistService] Error fetching contacts:", error);
            callback([]);
        });
    }

    private static validateCampaign(campaign: Omit<Campaign, 'id'>): void {
        const result = CampaignSchema.safeParse(campaign);
        if (!result.success) {
            const errorMessages = result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
            throw new Error(`Invalid campaign data: ${errorMessages}`);
        }
        if (!campaign.title?.trim()) throw new Error('Campaign title is required');
        if (!campaign.artist?.trim()) throw new Error('Artist name is required');
        if (!campaign.status) throw new Error('Campaign status is required');
    }

    private static validateContact(contact: Omit<Contact, 'id'>): void {
        const result = ContactSchema.safeParse(contact);
        if (!result.success) {
            const errorMessages = result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
            throw new Error(`Invalid contact data: ${errorMessages}`);
        }
        if (!contact.name?.trim()) throw new Error('Contact name is required');
    }

    static async addCampaign(userId: string, campaign: Omit<Campaign, 'id'>) {
        this.validateCampaign(campaign);
        return addDoc(collection(db, COLLECTIONS.PUBLICIST.CAMPAIGNS), {
            ...campaign,
            userId,
            createdAt: serverTimestamp()
        });
    }

    static async addContact(userId: string, contact: Omit<Contact, 'id'>) {
        this.validateContact(contact);
        return addDoc(collection(db, COLLECTIONS.PUBLICIST.CONTACTS), {
            ...contact,
            userId,
            createdAt: serverTimestamp()
        });
    }
}

