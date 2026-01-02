import {
    collection,
    query,
    where,
    onSnapshot,
    addDoc
} from 'firebase/firestore';
import { db } from '../firebase'; // Corrected path to src/services/firebase.ts
import { Campaign, Contact } from '../../modules/publicist/types';


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
            const campaigns = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as Campaign[];
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
            const contacts = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as Contact[];
            callback(contacts);
        }, (error) => {
            console.error("Error fetching contacts:", error);
            callback([]);
        });
    }

    static async addCampaign(userId: string, campaign: Omit<Campaign, 'id'>) {
        return addDoc(collection(db, this.campaignsCollection), {
            ...campaign,
            userId,
            createdAt: new Date()
        });
    }

    static async addContact(userId: string, contact: Omit<Contact, 'id'>) {
        return addDoc(collection(db, this.contactsCollection), {
            ...contact,
            userId,
            createdAt: new Date()
        });
    }
}
