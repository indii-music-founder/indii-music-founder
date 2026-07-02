/**
 * EmailMarketingService.ts
 * 
 * Manages two-way sync with Mailchimp and Klaviyo for newsletter deployment.
 * Fulfills PRODUCTION_200 item #143.
 */

import { logger } from '@/utils/logger';
import { MarketingProviderUnavailableError } from './providerErrors';

export type EmailProvider = 'mailchimp' | 'klaviyo';

export interface EmailMember {
    email: string;
    firstName?: string;
    lastName?: string;
    tags?: string[];
    subscribedAt: number;
}

export interface NewstletterTemplate {
    id: string;
    name: string;
    subject: string;
    htmlContent: string;
}

export class EmailMarketingService {
    /**
     * Synchronizes a list of members to a specific provider and list.
     */
    async syncMembers(members: EmailMember[], provider: EmailProvider, listId: string): Promise<void> {
        logger.info(`[EmailMarketing] Syncing ${members.length} members to ${provider} list ${listId}.`);

        members.forEach(m => logger.debug(`[EmailMarketing] Prepped: ${m.email}`));

        await this.syncToProvider(provider, listId, members);
    }

    private async syncToProvider(provider: string, listId: string, members: EmailMember[]): Promise<boolean> {
        // Item 143: Sync members to Mailchimp/Klaviyo via Cloud Function
        try {
            const { functionsWest1 } = await import('@/services/firebase');
            const { httpsCallable } = await import('firebase/functions');

            const syncFn = httpsCallable<
                { provider: string; listId: string; members: EmailMember[] },
                { synced: number; failed: number; status: string }
            >(functionsWest1, 'syncEmailList');

            const result = await syncFn({
                provider,
                listId,
                members
            });

            logger.info(`[EmailMarketing] ${provider} sync complete: ${result.data.synced} synced, ${result.data.failed} failed.`);
            return true;
        } catch (error: unknown) {
            // ISSUE-667: never pretend a sync was queued when no provider accepted it.
            logger.error(`[EmailMarketing] ${provider} sync Cloud Function unavailable — nothing was synced:`, error);
            throw new MarketingProviderUnavailableError(provider, "the 'syncEmailList' backend is not deployed or rejected the request", { cause: error });
        }
    }

    /**
     * Deploys a newsletter campaign using a template.
     */
    async deployCampaign(template: NewstletterTemplate, listId: string, provider: EmailProvider): Promise<string> {
        logger.info(`[EmailMarketing] Deploying newsletter: ${template.name} via ${provider}.`);

        try {
            const { functionsWest1 } = await import('@/services/firebase');
            const { httpsCallable } = await import('firebase/functions');

            const deployFn = httpsCallable<
                { templateId: string; subject: string; htmlContent: string; listId: string; provider: string },
                { campaignId: string; status: string }
            >(functionsWest1, 'deployEmailCampaign');

            const result = await deployFn({
                templateId: template.id,
                subject: template.subject,
                htmlContent: template.htmlContent,
                listId,
                provider
            });

            logger.info(`[EmailMarketing] Campaign ${result.data.campaignId} successfully queued for sending.`);
            return result.data.campaignId;
        } catch (error: unknown) {
            logger.error('[EmailMarketing] Deploy Cloud Function unavailable. No campaign was queued.', error);
            throw error;
        }
    }

    /**
     * Fetches reporting stats for a specific campaign.
     */
    async getCampaignStats(campaignId: string, provider: EmailProvider) {
        logger.info(`[EmailMarketing] Fetching stats for campaign ${campaignId} on ${provider}.`);

        try {
            const { functionsWest1 } = await import('@/services/firebase');
            const { httpsCallable } = await import('firebase/functions');

            const getStatsFn = httpsCallable<
                { campaignId: string; provider: string },
                { openRate: number; clickRate: number; unsubscribes: number; delivered: number }
            >(functionsWest1, 'getEmailCampaignStats');

            const result = await getStatsFn({ campaignId, provider });
            return result.data;
        } catch (error: unknown) {
            // ISSUE-667: zero-filled stats read as "0% open rate", not "unavailable". Fail honestly.
            logger.error(`[EmailMarketing] Stats Cloud Function unavailable for campaign ${campaignId}:`, error);
            throw new MarketingProviderUnavailableError(provider, "the 'getEmailCampaignStats' backend is not deployed or rejected the request", { cause: error });
        }
    }
}

export const emailMarketingService = new EmailMarketingService();
