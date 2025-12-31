import {
    collection,
    query,
    where,
    onSnapshot,
    addDoc,
    doc,
    setDoc,
    getDocs,
    writeBatch
} from 'firebase/firestore';
import { db } from '../firebase'; // Corrected path to src/services/firebase.ts
import { Campaign, Contact } from '../../modules/publicist/types';


export class PublicistService {
    private static campaignsCollection = 'publicist_campaigns';
    private static contactsCollection = 'publicist_contacts';

    // Mock data for seeding
    private static initialCampaigns: Omit<Campaign, 'id'>[] = [
        {
            artist: 'LUNA',
            title: 'Eclipse Album Launch',
            type: 'Album',
            status: 'Live',
            progress: 65,
            releaseDate: '2025-11-15',
            openRate: 42,
            coverUrl: 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=300&h=300&fit=crop'
        },
        {
            artist: 'The Apollo',
            title: 'World Tour Announcement',
            type: 'Tour',
            status: 'Scheduled',
            progress: 30,
            releaseDate: '2026-01-20',
            openRate: 0,
            coverUrl: 'https://images.unsplash.com/photo-1493225255756-d9584f8606e9?w=300&h=300&fit=crop'
        },
        {
            artist: 'Neon Vibe',
            title: 'Midnight Single',
            type: 'Single',
            status: 'Draft',
            progress: 10,
            releaseDate: 'TBD',
            openRate: 0
        }
    ];

    private static initialContacts: Omit<Contact, 'id'>[] = [
        {
            name: 'Sarah Jenkins',
            outlet: 'Rolling Stone',
            role: 'Journalist',
            tier: 'Top',
            influenceScore: 95,
            relationshipStrength: 'Strong',
            avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop'
        },
        {
            name: 'David Cho',
            outlet: 'Pitchfork',
            role: 'Editor',
            tier: 'Top',
            influenceScore: 88,
            relationshipStrength: 'Neutral',
            avatarUrl: 'https://images.unsplash.com/photo-1599566150163-29194dcaad36?w=100&h=100&fit=crop'
        },
        {
            name: 'Allyn Regione',
            outlet: 'Indie Shuffle',
            role: 'Curator',
            tier: 'Mid',
            influenceScore: 72,
            relationshipStrength: 'Strong',
            avatarUrl: 'https://images.unsplash.com/photo-1527980965255-d3b416303d12?w=100&h=100&fit=crop'
        },
        {
            name: 'Global Hits Playlist',
            outlet: 'Spotify',
            role: 'Curator',
            tier: 'Top',
            influenceScore: 99,
            relationshipStrength: 'Weak'
        }
    ];

    /**
     * Seeds the database with initial data if it's empty for the user
     */
    static async seedDatabase(userId: string) {
        if (!userId) return;

        try {
            // Check for existing campaigns
            const q = query(
                collection(db, this.campaignsCollection),
                where('userId', '==', userId)
            );
            const snapshot = await getDocs(q);

            if (!snapshot.empty) {
                console.log('Publicist data already exists. Skipping seed.');
                return;
            }

            console.log('Seeding Publicist database...');
            const batch = writeBatch(db);

            // Seed Campaigns
            this.initialCampaigns.forEach(campaign => {
                const docRef = doc(collection(db, this.campaignsCollection));
                batch.set(docRef, { ...campaign, userId, createdAt: new Date() });
            });

            // Seed Contacts
            this.initialContacts.forEach(contact => {
                const docRef = doc(collection(db, this.contactsCollection));
                batch.set(docRef, { ...contact, userId, createdAt: new Date() });
            });

            await batch.commit();
            console.log('Publicist database seeded successfully.');

        } catch (error) {
            console.error('Error seeding Publicist database:', error);
            throw error;
        }
    }

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
