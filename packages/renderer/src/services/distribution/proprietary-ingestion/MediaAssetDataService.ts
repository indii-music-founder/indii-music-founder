import { ExtendedGoldenMetadata } from '@/services/metadata/types';
import { INGESTION_CONFIG } from '@/core/config/ingestion';
import { MediaAssetDataMessage, MediaAssetDataContent, MediaAssetDataRelease, MediaAssetDataResource, Biography } from './types/mead';
/**
 * MediaAssetData Service
 * Manages creation of Media Enrichment and Description messages (Lyrics, Bios, etc.)
 */
export class MediaAssetDataService {

    /**
     * Generate a MediaAssetData message from GoldenMetadata
     * Focuses on extracting lyrics, biographies, and descriptions
     */
    generateMediaAssetData(
        metadata: ExtendedGoldenMetadata,
        messageId: string = `MSG-${Date.now()}`,
        recipientSystemIdentifier: string = 'GenericRecipient'
    ): MediaAssetDataMessage {

        // 1. Build Content
        const meadContent: MediaAssetDataContent = {
            releases: [this.buildRelease(metadata)]
        };

        return {
            messageSchemaVersionId: '1.0', // Standard MediaAssetData version
            messageHeader: {
                messageId,
                messageSender: {
                    systemIdentifier: INGESTION_CONFIG.SYSTEM_IDENTIFIER,
                    entityName: INGESTION_CONFIG.ENTITY_NAME
                },
                messageRecipient: {
                    systemIdentifier: recipientSystemIdentifier,
                    entityName: 'Distributor'
                },
                messageCreatedDateTime: new Date().toISOString(),
                messageControlType: 'LiveMessage'
            },
            meadMessageContent: meadContent
        };
    }

    private buildRelease(metadata: ExtendedGoldenMetadata): MediaAssetDataRelease {
        const resources = this.buildResources(metadata);

        return {
            releaseId: {
                icpn: metadata.upc,
                catalogNumber: undefined // Map if available
            },
            releaseReference: 'R1',
            detailsByTerritory: [{
                territoryCode: 'Worldwide',
                displayArtistName: metadata.artistName,
                artistBiographies: this.extractBiographies(metadata),
                promotionalDetails: {
                    headline: metadata.releaseTitle || metadata.trackTitle || 'Untitled Release',
                    marketingMessage: metadata.marketingComment // Assuming description is used for marketing
                }
            }],
            resourceList: resources
        };
    }

    private buildResources(metadata: ExtendedGoldenMetadata): MediaAssetDataResource[] {
        // Map tracks to resources
        if (!metadata.tracks) return [];

        return metadata.tracks.map((track, index) => {
            const resource: MediaAssetDataResource = {
                resourceReference: `A${index + 1}`,
                resourceId: {
                    isrc: track.isrc || ''
                },
                resourceType: 'SoundRecording',
                lyrics: track.lyrics ? [{
                    textType: 'Lyrics',
                    text: track.lyrics,
                    languageAndScriptCode: 'en' // Default to English, should come from metadata
                }] : undefined
            };
            return resource;
        });
    }

    private extractBiographies(metadata: ExtendedGoldenMetadata): Biography[] | undefined {
        // metadata.description is often just a liner note or promo text
        // If we had a specific 'artistBio' field, we'd map it here.
        // For now, mapping description as a biography if it looks long enough?
        // Or just omitting for now until metadata model extends.
        if (metadata.marketingComment) {
            return [{
                artistName: metadata.artistName,
                biographyText: metadata.marketingComment,
                biographyType: 'Promotional'
            }];
        }
        return undefined;
    }
}

export const mediaAssetDataService = new MediaAssetDataService();
