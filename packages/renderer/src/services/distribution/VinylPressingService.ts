import { db } from '../firebase';
import { collection, addDoc, getDoc, doc, updateDoc, serverTimestamp, query, where, getDocs } from 'firebase/firestore';
import { logger } from '@/utils/logger';

export interface VinylCampaignSpec {
    projectId: string;
    userId: string;
    title: string;
    size: '12"' | '7"';
    color: string;
    weight: '140g' | '180g';
    sleeveType: 'standard' | 'gatefold' | 'center-hole';
    targetCopies: number;
    retailPrice: number;
    designUrl: string;
    tracklist: string[];
}

export interface VinylCampaign extends VinylCampaignSpec {
    id: string;
    status: 'draft' | 'campaign_active' | 'pressing' | 'shipped' | 'failed';
    copiesSold: number;
    createdAt: any;
    updatedAt: any;
}

export class VinylPressingService {
    /**
     * Create a new vinyl pressing campaign in Firestore.
     */
    static async createCampaign(spec: VinylCampaignSpec): Promise<string> {
        try {
            const docRef = await addDoc(collection(db, 'vinyl_campaigns'), {
                ...spec,
                status: 'campaign_active',
                copiesSold: 0,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            });
            logger.info(`[VinylPressingService] Created vinyl campaign: ${docRef.id}`);
            return docRef.id;
        } catch (error: unknown) {
            logger.error('[VinylPressingService] Failed to create campaign:', error);
            throw error instanceof Error ? error : new Error('Failed to create vinyl pressing campaign.');
        }
    }

    /**
     * Fetch a specific vinyl campaign.
     */
    static async getCampaign(campaignId: string): Promise<VinylCampaign | null> {
        try {
            const docRef = doc(db, 'vinyl_campaigns', campaignId);
            const snap = await getDoc(docRef);
            if (!snap.exists()) return null;
            return { id: snap.id, ...snap.data() } as VinylCampaign;
        } catch (error: unknown) {
            logger.error('[VinylPressingService] Failed to fetch campaign:', error);
            return null;
        }
    }

    /**
     * List all vinyl campaigns for a user.
     */
    static async getUserCampaigns(userId: string): Promise<VinylCampaign[]> {
        try {
            const q = query(collection(db, 'vinyl_campaigns'), where('userId', '==', userId));
            const snap = await getDocs(q);
            return snap.docs.map(d => ({ id: d.id, ...d.data() } as VinylCampaign));
        } catch (error: unknown) {
            logger.error('[VinylPressingService] Failed to list user campaigns:', error);
            return [];
        }
    }

    /**
     * Record a preorder/sale on a vinyl campaign.
     * Triggers production order if threshold target is reached.
     */
    static async recordSale(campaignId: string, copies: number): Promise<void> {
        try {
            const campaign = await this.getCampaign(campaignId);
            if (!campaign) throw new Error('Campaign not found');

            const newSold = campaign.copiesSold + copies;
            const updates: Partial<VinylCampaign> = {
                copiesSold: newSold,
                updatedAt: serverTimestamp()
            };

            if (newSold >= campaign.targetCopies && campaign.status === 'campaign_active') {
                updates.status = 'pressing';
                logger.info(`[VinylPressingService] Threshold met for campaign ${campaignId}! Initiating production press.`);
            }

            const docRef = doc(db, 'vinyl_campaigns', campaignId);
            await updateDoc(docRef, updates);
        } catch (error: unknown) {
            logger.error('[VinylPressingService] Failed to record sale:', error);
            throw error;
        }
    }
}
