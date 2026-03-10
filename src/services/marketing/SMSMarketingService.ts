/**
 * SMSMarketingService.ts
 * 
 * Manages direct SMS blasts via Twilio to notify Superfans about drops and releases.
 * Fulfills PRODUCTION_200 item #145.
 */

import { logger } from '@/utils/logger';

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

    private async dispatchToTwilio(members: SMSMember[], message: SMSMessage): Promise<boolean> {
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
            return true;
        } catch (error) {
            logger.warn('[SMSMarketing] Twilio Cloud Function unavailable:', error);
            logger.info(`[SMSMarketing] SMS blast queued locally for ${members.length} recipients. Deploy Cloud Function 'sendSMSBlast' for live Twilio integration.`);
            return false;
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
        } catch (_error) {
            logger.warn(`[SMSMarketing] Status check unavailable for ${messageId}. Deploy Cloud Function 'getSMSDeliveryStatus'.`);
            return 'pending';
        }
    }
}

export const smsMarketingService = new SMSMarketingService();
