import { ExtendedGoldenMetadata } from '@/services/metadata/types';
import { DDEX_CONFIG } from '@/core/config/ddex';
import { RINMessage, RINContent, RINSoundRecording, RINContributor } from './types/rin';

/**
 * RIN Service
 * Manages creation of Recording Information Notification messages (Studio data)
 */
export class RINService {

    /**
     * Generate a RIN message from GoldenMetadata
     * Focuses on detailed contributors, sessions, and instrumentation
     */
    generateRIN(
        metadata: ExtendedGoldenMetadata,
        messageId: string = `MSG-${Date.now()}`
    ): RINMessage {

        const rinContent: RINContent = {
            soundRecordings: this.buildSoundRecordings(metadata)
        };

        return {
            messageSchemaVersionId: '1.1',
            messageHeader: {
                messageId,
                messageSender: {
                    partyId: DDEX_CONFIG.PARTY_ID,
                    partyName: DDEX_CONFIG.PARTY_NAME
                },
                messageRecipient: {
                    partyId: 'GenericRecipient',
                    partyName: 'Distributor'
                },
                messageCreatedDateTime: new Date().toISOString(),
                messageControlType: 'LiveMessage'
            },
            rinMessageContent: rinContent
        };
    }

    private buildSoundRecordings(metadata: ExtendedGoldenMetadata): RINSoundRecording[] {
        if (!metadata.tracks) return [];

        return metadata.tracks.map((track, index) => {
            // In a real app, track extended metadata would contain session info.
            // For now, we infer/map from available contributor fields.

            const contributors: RINContributor[] = [];

            // Map Release-level splits to track contributors (simplified inheritance)
            metadata.splits.forEach(split => {
                contributors.push({
                    partyName: split.legalName,
                    roles: [split.role]
                });
            });

            // Add specific track features if any (mock logic for now)
            // If we had `track.credits`, we'd map them here.

            return {
                resourceReference: `A${index + 1}`,
                resourceId: {
                    isrc: track.isrc || ''
                },
                title: track.trackTitle,
                contributors: contributors,
                // Mock session for demonstration
                studioSessions: [{
                    sessionDate: metadata.releaseDate, // Fallback to release date
                    studioLocation: {
                        studioName: 'Home Studio', // Placeholder
                        countryCode: 'US'
                    },
                    participants: contributors.map(c => ({
                        partyName: c.partyName,
                        role: c.roles[0]
                    }))
                }]
            };
        });
    }
}

export const rinService = new RINService();
