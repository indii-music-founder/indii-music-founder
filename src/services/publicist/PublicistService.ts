import {
    collection,
    query,
    where,
    onSnapshot,
    addDoc,
    QuerySnapshot,
    DocumentData
} from 'firebase/firestore';
import { db } from '@/services/firebase';
import { Campaign, Contact } from '@/modules/publicist/types'; // Updated import path to alias
import { COLLECTIONS } from '@/core/config/collections';
import { z } from 'zod';

// Define Zod schemas for runtime validation
const CampaignSchema = z.object({
    userId: z.string(),
    name: z.string(),
    // Add other fields based on Campaign interface if needed, keeping it loose for now to match interface
    // For strictness we'd define the full schema, but pass-through is safer for refactoring
}).passthrough();

const ContactSchema = z.object({
    userId: z.string(),
    name: z.string(),
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

    static async addCampaign(userId: string, campaign: Omit<Campaign, 'id'>) {
        return addDoc(collection(db, COLLECTIONS.PUBLICIST.CAMPAIGNS), {
            ...campaign,
            userId,
            createdAt: new Date()
        });
    }

    static async addContact(userId: string, contact: Omit<Contact, 'id'>) {
        return addDoc(collection(db, COLLECTIONS.PUBLICIST.CONTACTS), {
            ...contact,
            userId,
            createdAt: new Date()
        });
    }
}

