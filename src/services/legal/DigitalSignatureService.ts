import { logger } from '@/utils/logger';

/**
 * Requirement 111: Legal Agent Draft Verification
 * Mocks a Docusign/PandaDoc API to send generated split sheets for signature.
 */

export interface Collaborator {
    name: string;
    email: string;
    role: "Producer" | "Songwriter" | "Feature" | "Publisher";
    splitPercentage: number;
}

export interface SignatureEnvelope {
    envelopeId: string;
    status: 'sent' | 'delivered' | 'signed' | 'declined';
    recipients: string[];
    sentAt: string;
}

export class DigitalSignatureService {
    /**
     * Sends a generated split sheet to collaborators for signature.
     */
    async sendSplitSheetForSignature(trackName: string, collaborators: Collaborator[]): Promise<SignatureEnvelope> {
        try {
            logger.info(`[DigitalSignatureService] Generating split sheet for "${trackName}"...`);

            // Validate math
            const totalSplit = collaborators.reduce((sum, c) => sum + c.splitPercentage, 0);
            if (Math.abs(totalSplit - 100) > 0.1) {
                throw new Error(`Splits must equal 100%. Current total: ${totalSplit}%`);
            }

            // Mocking API delay
            await new Promise(resolve => setTimeout(resolve, 1500));

            const envelopeId = `env_${Math.random().toString(36).substring(2, 11)}`;
            const emails = collaborators.map(c => c.email);

            logger.info(`[DigitalSignatureService] Dispatched envelope ${envelopeId} to: ${emails.join(', ')}`);

            return {
                envelopeId,
                status: 'sent',
                recipients: emails,
                sentAt: new Date().toISOString()
            };
        } catch (error: any) {
            logger.error('[DigitalSignatureService] Failed to send split sheet', error);
            throw new Error(`Failed to send split sheet: ${error.message}`);
        }
    }
}

export const digitalSignatureService = new DigitalSignatureService();