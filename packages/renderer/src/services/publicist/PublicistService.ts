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
import { logger } from '@/utils/logger';
import { AutonomousIntelligence } from '@/services/intelligence/AutonomousIntelligence';
import { INTELLIGENCE_MODELS, INTELLIGENCE_CONFIG } from '@/core/config/intelligence-models';

export class PublicistService {
    private static campaignsCollection = 'publicist_campaigns';
    private static contactsCollection = 'publicist_contacts';

    /**
     * Generate a professional press release using Gemini 3 Pro
     */
    static async generatePressRelease(metadata: {
        artistName: string;
        releaseTitle: string;
        releaseDate: string;
        genre: string;
        story?: string;
        keyFeatures?: string[];
        location?: string;
    }) {
        const prompt = `Write a high-impact, professional music industry press release for the following release:
        
        Artist: ${metadata.artistName}
        Title: ${metadata.releaseTitle}
        Date: ${metadata.releaseDate}
        Genre: ${metadata.genre}
        Location: ${metadata.location || 'Global'}
        Background Story: ${metadata.story || 'Innovative new sounds from an emerging creative force.'}
        Key Highlights: ${metadata.keyFeatures?.join(', ') || 'Unique production, emotional depth, groundbreaking visuals.'}
        
        The press release should follow the standard format:
        - FOR IMMEDIATE RELEASE header
        - Catchy HEADLINE
        - DATELINE (City, State / Date)
        - LEAD PARAGRAPH (Who, What, When, Where, Why)
        - BODY PARAGRAPHS (Quotes from the artist, background on the project)
        - ABOUT THE ARTIST section
        - MEDIA CONTACT placeholder
        
        Style: Sophisticated, trend-aware, and emotionally resonant. Use descriptive but direct language.`;

        const response = await AutonomousIntelligence.generateContent(
            [{ role: 'user', parts: [{ text: prompt }] }],
            INTELLIGENCE_MODELS.TEXT.AGENT, // Gemini 3.1 Pro Preview
            {
                ...INTELLIGENCE_CONFIG.THINKING.HIGH,
                temperature: 1.0 // Creative task
            }
        );

        return response.response.text();
    }

    /**
     * Subscribe to user's campaigns
     */
    static subscribeToCampaigns(
        userId: string,
        callback: (campaigns: Campaign[]) => void,
        errorCallback?: (error: Error | string) => void
    ) {
        if (!userId) return () => { };

        const q = query(
            collection(db, this.campaignsCollection),
            where('userId', '==', userId)
        );

        return onSnapshot(q, (snapshot) => {
            const campaigns = snapshot.docs.flatMap(doc => {
                const data = doc.data();
                // Safe parsing with fallback to ensure UI doesn't crash on schema mismatches
                const parsed = CampaignSchema.safeParse({ id: doc.id, ...data });
                if (parsed.success) {
                    return [{ ...parsed.data, id: doc.id } as Campaign];
                }
                logger.warn(`[PublicistService] Invalid campaign ${doc.id}:`, parsed.error);
                return [];
            });
            callback(campaigns);
            if (errorCallback) errorCallback('');
        }, (error) => {
            logger.error("Error fetching campaigns:", error);
            if (errorCallback) {
                const message = error instanceof Error ? error.message : String(error);
                errorCallback(`Failed to load campaigns: ${message}`);
            }
        });
    }

    /**
     * Subscribe to user's contacts
     */
    static subscribeToContacts(
        userId: string,
        callback: (contacts: Contact[]) => void,
        errorCallback?: (error: Error | string) => void
    ) {
        if (!userId) return () => { };

        const q = query(
            collection(db, this.contactsCollection),
            where('userId', '==', userId)
        );

        return onSnapshot(q, (snapshot) => {
            const contacts = snapshot.docs.flatMap(doc => {
                const data = doc.data();
                const parsed = ContactSchema.safeParse({ id: doc.id, ...data });
                if (parsed.success) {
                    return [{ ...parsed.data, id: doc.id } as Contact];
                }
                logger.warn(`[PublicistService] Invalid contact ${doc.id}:`, parsed.error);
                return [];
            });
            callback(contacts);
            if (errorCallback) errorCallback('');
        }, (error) => {
            logger.error("Error fetching contacts:", error);
            if (errorCallback) {
                const message = error instanceof Error ? error.message : String(error);
                errorCallback(`Failed to load contacts: ${message}`);
            }
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

        // Contacts and campaign status contain no verified audience impression,
        // outlet circulation, or placement valuation receipt. Never turn tiers or
        // budgets into performance claims.

        return {
            globalReach: 'Not available',
            avgOpenRate: `${avgOpenRateVal}%`,
            placementValue: 'Not available'
        };
    }
}
