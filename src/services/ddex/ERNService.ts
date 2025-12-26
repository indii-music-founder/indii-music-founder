import { DDEXParser } from './DDEXParser';
import type { ERNMessage } from './types/ern';
import type { ExtendedGoldenMetadata } from '@/services/metadata/types';
import { DDEX_CONFIG } from '@/core/config/ddex';

/**
 * ERN Service
 * Manages creation and parsing of Electronic Release Notification (ERN) messages
 */
export class ERNService {
    /**
     * Generate an ERN message from ExtendedGoldenMetadata
     */
    async generateERN(
        metadata: ExtendedGoldenMetadata,
        senderPartyId: string = DDEX_CONFIG.PARTY_ID,
        distributorKey: string = 'generic'
    ): Promise<{ success: boolean; xml?: string; error?: string }> {
        try {
            const { DISTRIBUTORS } = await import('@/core/config/distributors');
            const distributor = DISTRIBUTORS[distributorKey as keyof typeof DISTRIBUTORS] || DISTRIBUTORS.generic;
            const recipientPartyId = distributor.ddexPartyId;
            const timestamp = new Date().toISOString();
            const releaseId = metadata.upc || `R-${Date.now()}`;

            const ern: ERNMessage = {
                messageSchemaVersionId: DDEX_CONFIG.ERN_VERSION,
                messageHeader: {
                    messageId: `MSG-${Date.now()}`,
                    messageThreadId: `THREAD-${Date.now()}`,
                    messageSender: {
                        partyId: senderPartyId,
                        partyName: metadata.labelName || DDEX_CONFIG.PARTY_NAME,
                    },
                    messageRecipient: {
                        partyId: recipientPartyId,
                        partyName: 'Distributor',
                    },
                    messageCreatedDateTime: timestamp,
                    messageControlType: 'LiveMessage',
                },
                releaseList: [
                    {
                        releaseId: {
                            icpn: metadata.upc || '',
                            catalogNumber: metadata.catalogNumber || '',
                        },
                        releaseReference: 'R1',
                        releaseType: metadata.releaseType || 'Single',
                        releaseTitle: {
                            titleText: metadata.releaseTitle || metadata.trackTitle || 'Untitled Release',
                        },
                        displayArtistName: metadata.artistName || 'Unknown Artist',
                        contributors: [], // TODO: Map contributors from metadata
                        labelName: metadata.labelName || 'Independent',
                        genre: { genre: metadata.genre || 'Pop' },
                        parentalWarningType: metadata.explicit ? 'Explicit' : 'NotExplicit',
                        releaseResourceReferenceList: [], // Populated below
                    },
                ],
                resourceList: [], // TODO: Map resources (audio/image) from metadata
                dealList: [], // TODO: Define deals
            };

            // Generate XML using the parser
            const xml = DDEXParser.buildERN(ern);

            return { success: true, xml };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error generating ERN',
            };
        }
    }

    /**
     * Parse an ERN XML string into a structured object
     */
    parseERN(xml: string): { success: boolean; data?: ERNMessage; error?: string } {
        return DDEXParser.parseERN(xml);
    }

    /**
     * Validate an ERN object against logical business rules
     * (Schema validation is handled separately by DDEXValidator)
     */
    validateERNContent(ern: ERNMessage): { valid: boolean; errors: string[] } {
        const errors: string[] = [];

        // Check Header
        if (!ern.messageHeader.messageId) errors.push('MessageId is missing');
        if (!ern.messageHeader.messageSender.partyId) errors.push('MessageSender PartyId is missing');

        // Check Releases
        if (!ern.releaseList || ern.releaseList.length === 0) {
            errors.push('No releases found in ERN');
        } else {
            ern.releaseList.forEach((release, index) => {
                if (!release.releaseId.icpn && !release.releaseId.catalogNumber) {
                    errors.push(`Release ${index + 1}: Must have ICPN or CatalogNumber`);
                }
                if (!release.releaseTitle.titleText) {
                    errors.push(`Release ${index + 1}: Title is missing`);
                }
            });
        }

        return {
            valid: errors.length === 0,
            errors,
        };
    }
}

export const ernService = new ERNService();
