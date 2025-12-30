import { DDEXParser } from './DDEXParser';
import { ERNMapper } from './ERNMapper';
import type { ERNMessage } from './types/ern';
import type { ExtendedGoldenMetadata } from '@/services/metadata/types';
import type { ReleaseAssets } from '@/services/distribution/types/distributor';
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
        distributorKey: string = 'generic',
        assets?: ReleaseAssets,
        options?: { isTestMode?: boolean } // Added options for Test Mode
    ): Promise<{ success: boolean; xml?: string; error?: string }> {
        try {
            const { DISTRIBUTORS } = await import('@/core/config/distributors');
            const distributor = DISTRIBUTORS[distributorKey as keyof typeof DISTRIBUTORS] || DISTRIBUTORS.generic;
            const recipientPartyId = distributor.ddexPartyId;
            const timestamp = new Date().toISOString();
            // Removed unused variable releaseId which was causing lint warning

            // Use the Mapper to generate a complete ERN object
            const ern = ERNMapper.mapMetadataToERN(metadata, {
                messageId: `MSG-${Date.now()}`,
                sender: {
                    partyId: senderPartyId,
                    partyName: metadata.labelName || DDEX_CONFIG.PARTY_NAME,
                },
                recipient: {
                    partyId: recipientPartyId,
                    partyName: 'Distributor', // Ideally fetched from distributor config
                },
                createdDateTime: timestamp,
                messageControlType: options?.isTestMode ? 'TestMessage' : 'LiveMessage' // Set Test Flag
            }, assets);

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
