import { logger } from '@/utils/logger';
import { IngestionParser } from './IngestionParser';
import { IngestionNotificationMapper } from './IngestionNotificationMapper';
import type { IngestionNotificationMessage } from './types/ern';
import type { ExtendedGoldenMetadata } from '@/services/metadata/types';
import type { ReleaseAssets } from '@/services/distribution/types/distributor';
import { INGESTION_CONFIG } from '@/core/config/ingestion';
import { IdentifierService } from '@/services/identity/IdentifierService';
import { ddexBuilder } from '@indii/shared';

/**
 * IngestionNotification Service
 * Manages creation and parsing of Electronic Release Notification (IngestionNotification) messages
 */
export class IngestionNotificationService {
    /**
     * Generate an IngestionNotification message from ExtendedGoldenMetadata
     * Defaults to TestMessage unless explicitly requested otherwise via options.forceIsTestMode
     */
    async generateIngestionNotification(
        metadata: ExtendedGoldenMetadata,
        senderSystemIdentifier: string = INGESTION_CONFIG.SYSTEM_IDENTIFIER,
        distributorKey: string = 'merlin',
        assets?: ReleaseAssets,
        options?: {
            isTestMode?: boolean;
            forceIsTestMode?: boolean;
            action?: 'NewRelease' | 'Update' | 'Takedown';
        }
    ): Promise<{ success: boolean; xml?: string; error?: string; structuralLintPassed?: boolean; xsdValidated?: boolean }> {
        try {
            const { DISTRIBUTORS } = await import('@/core/config/distributors');
            const distributor = (DISTRIBUTORS[distributorKey as keyof typeof DISTRIBUTORS] || DISTRIBUTORS.merlin)!;
            const recipientSystemIdentifier = distributor.systemIdentifier;
            const timestamp = new Date().toISOString();

            // 1. Auto-assign identifiers if missing
            if (!metadata.isrc) {
                metadata.isrc = await IdentifierService.nextISRC();
                logger.debug(`[IngestionNotificationService] Auto-assigned ISRC: ${metadata.isrc}`);
            }

            // ISSUE-783: singles require a release-level UPC/ICPN too — DDEX
            // packaging and release-identity validation apply uniformly.
            if (!metadata.upc) {
                metadata.upc = await IdentifierService.nextUPC();
                logger.debug(`[IngestionNotificationService] Auto-assigned UPC: ${metadata.upc}`);
            }

            // 2. Use the Mapper to generate a complete IngestionNotification object
            // FAIL-CLOSED: default to TestMessage unless explicitly confirmed for live mode
            const isLiveMessage = options?.forceIsTestMode === false && options?.isTestMode === false;
            const ern = IngestionNotificationMapper.mapMetadataToIngestionNotification(metadata, {
                messageId: `MSG-${Date.now()}`,
                sender: {
                    systemIdentifier: senderSystemIdentifier,
                    entityName: metadata.labelName || INGESTION_CONFIG.ENTITY_NAME,
                },
                recipient: {
                    systemIdentifier: recipientSystemIdentifier,
                    entityName: 'Distributor', // Ideally fetched from distributor config
                },
                createdDateTime: timestamp,
                messageControlType: isLiveMessage ? 'LiveMessage' : 'TestMessage',
                action: options?.action,
            }, assets);

            // Generate XML using the shared canonical DDEX builder
            const xml = ddexBuilder.buildIngestionNotification(ern);

            // Item 219: Structural XML validation before returning
            const structureErrors = IngestionNotificationService.validateIngestionNotificationXML(xml);
            if (structureErrors.length > 0) {
                logger.warn('[IngestionNotificationService] IngestionNotification structural validation failed:', structureErrors);
                return {
                    success: false,
                    error: `IngestionNotification structural validation failed: ${structureErrors.join('; ')}`,
                    structuralLintPassed: false,
                    xsdValidated: false,
                };
            }

            // ISSUE-862: structuralLintPassed means required tags are present —
            // it is NOT a schema/profile pass. No XSD validator is wired up yet.
            return { success: true, xml, structuralLintPassed: true, xsdValidated: false };
        } catch (error: unknown) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error generating IngestionNotification',
            };
        }
    }

    /**
     * Parse an IngestionNotification XML string into a structured object
     */
    parseIngestionNotification(xml: string): { success: boolean; data?: IngestionNotificationMessage; error?: string } {
        return IngestionParser.parseIngestionNotification(xml);
    }

    /**
     * Item 219 / ISSUE-862: Structural LINT ONLY — checks required tag presence
     * via substring matching. This is NOT XSD/profile schema validation; no
     * real DDEX schema is consulted, so a structurally-tagged-correct document
     * can still be a malformed or non-conformant ERN. Callers that need a
     * delivery-ready guarantee must not treat an empty error array as
     * "XSD validated" — see `structuralLintPassed` / `xsdValidated` on
     * `generateIngestionNotification()`'s return value.
     * Returns an array of error strings; empty array = structural lint passed.
     */
    static validateIngestionNotificationXML(xml: string): string[] {
        const errors: string[] = [];

        if (!xml || xml.trim().length === 0) {
            errors.push('IngestionNotification XML is empty');
            return errors;
        }

        const required = [
            { tag: 'NewReleaseMessage', label: '<NewReleaseMessage> root element' },
            { tag: 'MessageHeader', label: '<MessageHeader> block' },
            { tag: 'MessageId', label: '<MessageId> identifier' },
            { tag: 'MessageSender', label: '<MessageSender> party' },
            { tag: 'MessageRecipient', label: '<MessageRecipient> party' },
            { tag: 'ResourceList', label: '<ResourceList> (audio/image resources)' },
            { tag: 'ReleaseList', label: '<ReleaseList> (release metadata)' },
        ];

        for (const { tag, label } of required) {
            if (!xml.includes(`<${tag}`) && !xml.includes(`<ern:${tag}`)) {
                errors.push(`Missing required element: ${label}`);
            }
        }

        return errors;
    }

    /**
     * Validate an IngestionNotification object against logical business rules
     * (Schema validation is handled separately by IngestionValidator)
     */
    validateIngestionNotificationContent(ern: IngestionNotificationMessage): { valid: boolean; errors: string[] } {
        const errors: string[] = [];

        // Check Header
        if (!ern.messageHeader.messageId) errors.push('MessageId is missing');
        if (!ern.messageHeader.messageSender.systemIdentifier) errors.push('MessageSender SystemIdentifier is missing');

        // Check Releases
        if (!ern.releaseList || ern.releaseList.length === 0) {
            errors.push('No releases found in IngestionNotification');
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

    // =========================================================================
    // Legacy ERN Method Aliases for Backward Compatibility
    // =========================================================================
    
    async generateERN(
        metadata: ExtendedGoldenMetadata,
        senderSystemIdentifier?: string,
        distributorKey?: string,
        assets?: ReleaseAssets,
        options?: { isTestMode?: boolean; action?: 'NewRelease' | 'Update' | 'Takedown'; }
    ) {
        return this.generateIngestionNotification(metadata, senderSystemIdentifier, distributorKey, assets, options);
    }

    parseERN(xml: string) {
        return this.parseIngestionNotification(xml);
    }

    validateERNContent(ern: IngestionNotificationMessage) {
        return this.validateIngestionNotificationContent(ern);
    }

    static validateERNXML(xml: string) {
        return IngestionNotificationService.validateIngestionNotificationXML(xml);
    }
}

export const ingestionNotificationService = new IngestionNotificationService();
