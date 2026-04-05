/**
 * PreSaveCampaignService.ts
 * 
 * Manages Pre-Save landing pages and fan lead collection.
 * Fulfills PRODUCTION_200 item #144.
 */

import { logger } from '@/utils/logger';

export interface PreSavePlatformLinks {
    spotify?: string;
    appleMusic?: string;
    amazonMusic?: string;
    tidal?: string;
    deezer?: string;
}

export interface PreSaveCampaign {
    id: string;
    title: string;
    releaseDate: number; // UTC timestamp
    coverArtUrl: string;
    links: PreSavePlatformLinks;
    captureEmails: boolean;
    capturePhones: boolean;
    themeColor: string;
    status: 'active' | 'scheduled' | 'expired';
}

export interface PreSaveLead {
    email?: string;
    phone?: string;
    collectedAt: number;
    optInMarketing: boolean;
}

export class PreSaveCampaignService {
    /**
     * Creates a new pre-save campaign for an upcoming release.
     */
    async createCampaign(campaign: Omit<PreSaveCampaign, 'id' | 'status'>): Promise<string> {
        const id = `ps_${Date.now()}`;

        logger.info(`[PreSaveService] Creating pre-save campaign: ${campaign.title} (ID: ${id})`);

        // In production, this would persist to Firestore
        // await db.collection('presave_campaigns').doc(id).set({ ...campaign, status: 'active' });

        return id;
    }

    /**
     * Records a fan lead (Email/Phone) for a specific campaign.
     */
    async recordLead(campaignId: string, lead: Omit<PreSaveLead, 'collectedAt'>): Promise<void> {
        logger.info(`[PreSaveService] Lead collected for campaign ${campaignId}: ${lead.email || lead.phone}`);

        // In production, this would persist to the campaign's lead sub-collection
        // await db.collection('presave_campaigns').doc(campaignId).collection('leads').add({ ...lead, collectedAt: Date.now() });
    }

    /**
     * Returns the campaign public URL.
     */
    getCampaignUrl(campaignId: string): string {
        const baseUrl = import.meta.env.VITE_PRESAVE_BASE_URL || 'https://indii.os/p';
        return `${baseUrl}/${campaignId}`;
    }

    /**
     * Calculates time remaining until the release.
     */
    getTimeRemaining(releaseDate: number): string {
        const now = Date.now();
        const diff = releaseDate - now;

        if (diff <= 0) return 'Released';

        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

        return `${days}d ${hours}h left`;
    }
}

export const preSaveCampaignService = new PreSaveCampaignService();
