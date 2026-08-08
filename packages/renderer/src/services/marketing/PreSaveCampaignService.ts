/**
 * Durable pre-save campaign and fan-lead client.
 *
 * All writes go through Cloud Functions. Firestore Rules intentionally deny
 * direct client writes so a forged browser request cannot manufacture
 * conversions or expose fan contact data.
 */

import { httpsCallable } from 'firebase/functions';
import { functions } from '@/services/firebase';
import { logger } from '@/utils/logger';

export type PreSaveDsp = 'spotify' | 'appleMusic' | 'amazonMusic';

export interface PreSavePlatformLinks {
    spotify?: string;
    appleMusic?: string;
    amazonMusic?: string;
}

export interface PreSaveCampaign {
    id: string;
    title: string;
    releaseDate: number;
    coverArtUrl: string;
    links: PreSavePlatformLinks;
    captureEmails: boolean;
    capturePhones: boolean;
    themeColor: string;
    status: 'active' | 'expired';
}

export type NewPreSaveCampaign = Omit<PreSaveCampaign, 'id' | 'status'>;

export interface PreSaveLeadInput {
    leadId: string;
    dsp: PreSaveDsp;
    email?: string;
    phone?: string;
    optInMarketing: boolean;
    fbclid?: string;
}

export type PreSaveRegisterResponse =
    | { presaved: true; campaignId: string; leadId: string }
    | {
        presaved: false;
        reason: 'INVALID_INPUT' | 'CAMPAIGN_NOT_FOUND' | 'CAMPAIGN_UNAVAILABLE' | 'FIRESTORE_ERROR';
        message: string;
    };

export class PreSaveCampaignService {
    async createCampaign(campaign: NewPreSaveCampaign, campaignId?: string): Promise<string> {
        const create = httpsCallable<
            NewPreSaveCampaign & { campaignId?: string },
            { campaignId: string }
        >(functions, 'createPreSaveCampaign');
        const result = await create({ ...campaign, ...(campaignId ? { campaignId } : {}) });
        if (!/^[A-Za-z0-9_-]{8,128}$/.test(result.data?.campaignId ?? '')) {
            throw new Error('Campaign persistence returned no valid campaign ID.');
        }
        logger.info('[PreSaveService] Campaign persisted', { campaignId: result.data.campaignId });
        return result.data.campaignId;
    }

    async getCampaign(campaignId: string): Promise<PreSaveCampaign> {
        const getCampaign = httpsCallable<{ campaignId: string }, PreSaveCampaign>(
            functions,
            'getPreSaveCampaign',
        );
        const result = await getCampaign({ campaignId });
        return result.data;
    }

    async recordLead(
        campaignId: string,
        lead: PreSaveLeadInput,
    ): Promise<PreSaveRegisterResponse> {
        try {
            const register = httpsCallable<
                PreSaveLeadInput & { campaignId: string },
                PreSaveRegisterResponse
            >(functions, 'presaveRegister');
            const result = await register({ campaignId, ...lead });
            return result.data;
        } catch (error) {
            logger.error('[PreSaveService] Lead submission failed', {
                campaignId,
                error: error instanceof Error ? error.message : String(error),
            });
            return {
                presaved: false,
                reason: 'FIRESTORE_ERROR',
                message: 'Your pre-save could not be saved. Please try again.',
            };
        }
    }

    getCampaignUrl(campaignId: string): string {
        if (!/^[A-Za-z0-9_-]{8,128}$/.test(campaignId)) {
            throw new Error('Campaign persistence returned an invalid campaign ID.');
        }
        return `https://app.indii.music/presave/${campaignId}`;
    }

    getTimeRemaining(releaseDate: number): string {
        const diff = releaseDate - Date.now();
        if (diff <= 0) return 'Released';
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        return `${days}d ${hours}h left`;
    }
}

export const preSaveCampaignService = new PreSaveCampaignService();
