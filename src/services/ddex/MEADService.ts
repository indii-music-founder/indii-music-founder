import { ExtendedGoldenMetadata } from '@/services/metadata/types';
import { DDEX_CONFIG } from '@/core/config/ddex';
import { MEADMessage, MEADContent, MEADRelease, MEADResource } from './types/mead';
import { DDEXParser } from './DDEXParser'; // We might need to extend parser for MEAD if we output XML

/**
 * MEAD Service
 * Manages creation of Media Enrichment and Description messages (Lyrics, Bios, etc.)
 */
export class MEADService {

    /**
     * Generate a MEAD message from GoldenMetadata
     * Focuses on extracting lyrics, biographies, and descriptions
     */
    generateMEAD(
        metadata: ExtendedGoldenMetadata,
        messageId: string = `MSG-${Date.now()}`
    ): MEADMessage {

        // 1. Build Content
        const meadContent: MEADContent = {
            releases: [this.buildRelease(metadata)]
        };

        return {
            messageSchemaVersionId: '1.0', // Standard MEAD version
            messageHeader: {
                messageId,
                messageSender: {
                    partyId: DDEX_CONFIG.PARTY_ID,
                    partyName: DDEX_CONFIG.PARTY_NAME
                },
                messageRecipient: {
                    partyId: 'GenericRecipient', // TODO: Parameterize
                    partyName: 'Distributor'
                },
                messageCreatedDateTime: new Date().toISOString(),
                messageControlType: 'LiveMessage'
            },
            meadMessageContent: meadContent
        };
    }

    private buildRelease(metadata: ExtendedGoldenMetadata): MEADRelease {
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

    private buildResources(metadata: ExtendedGoldenMetadata): MEADResource[] {
        // Map tracks to resources
        if (!metadata.tracks) return [];

        return metadata.tracks.map((track, index) => {
            const resource: MEADResource = {
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

    private extractBiographies(metadata: ExtendedGoldenMetadata): any[] | undefined {
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

export const meadService = new MEADService();
