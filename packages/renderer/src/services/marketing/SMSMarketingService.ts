/**
 * SMSMarketingService.ts
 * 
 * Manages direct SMS blasts via Twilio to notify Superfans about drops and releases.
 * Fulfills PRODUCTION_200 item #145.
 */

import { logger } from '@/utils/logger';
import { MarketingProviderUnavailableError } from './providerErrors';

export interface SMSMember {
    phone: string;
    email?: string;
    isSuperfan: boolean;
    subscribedAt: number;
}

export interface SMSMessage {
    id: string;
    text: string;
    imageUrl?: string; // MMS support
}

export class SMSMarketingService {
    /**
     * Sends an SMS blast to a specific list of members.
     */
    async broadcastSMS(members: SMSMember[], message: SMSMessage): Promise<number> {
        logger.info(`[SMSMarketing] Preparing SMS blast for ${members.length} members.`);

        const superfansOnly = members.filter(m => m.isSuperfan);
        logger.info(`[SMSMarketing] Filtering to Superfans only: ${superfansOnly.length} recipients.`);

        await this.dispatchToTwilio(superfansOnly, message);

        return superfansOnly.length;
    }

    private async dispatchToTwilio(members: SMSMember[], message: SMSMessage): Promise<void> {
        // Item 145: Dispatch SMS via Cloud Function → Twilio API
        try {
            const { functionsWest1 } = await import('@/services/firebase');
            const { httpsCallable } = await import('firebase/functions');

            const sendSMSFn = httpsCallable<
                { phones: string[]; text: string; imageUrl?: string; messageId: string },
                { sent: number; failed: number; status: string }
            >(functionsWest1, 'sendSMSBlast');

            const result = await sendSMSFn({
                phones: members.map(m => m.phone),
                text: message.text,
                imageUrl: message.imageUrl,
                messageId: message.id
            });

            logger.info(`[SMSMarketing] Twilio broadcast complete: ${result.data.sent} sent, ${result.data.failed} failed.`);
        } catch (error: unknown) {
            // ISSUE-667: never pretend a blast was queued when no provider accepted it.
            logger.error('[SMSMarketing] Twilio Cloud Function unavailable — no SMS was sent:', error);
            throw new MarketingProviderUnavailableError('Twilio', "the 'sendSMSBlast' backend is not deployed or rejected the request", { cause: error });
        }
    }

    /**
     * Checks the delivery status for an SMS message.
     */
    async getSMSStatus(messageId: string): Promise<string> {
        logger.info(`[SMSMarketing] Fetching delivery status for message ${messageId}.`);

        try {
            const { functionsWest1 } = await import('@/services/firebase');
            const { httpsCallable } = await import('firebase/functions');

            const getStatusFn = httpsCallable<
                { messageId: string },
                { status: string; deliveredAt?: string }
            >(functionsWest1, 'getSMSDeliveryStatus');

            const result = await getStatusFn({ messageId });
            return result.data.status;
        } catch (error: unknown) {
            // ISSUE-667: 'pending' implied a real delivery pipeline; fail honestly instead.
            logger.error(`[SMSMarketing] Status check unavailable for ${messageId}:`, error);
            throw new MarketingProviderUnavailableError('Twilio', "the 'getSMSDeliveryStatus' backend is not deployed or rejected the request", { cause: error });
        }
    }
}

export const smsMarketingService = new SMSMarketingService();
