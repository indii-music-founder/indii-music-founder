import { ExtendedGoldenMetadata, GoldenMetadata } from '@/services/metadata/types';
import { INGESTION_CONFIG } from '@/core/config/ingestion';
import { RecordingInformationMessage, RecordingInformationContent, RecordingInformationSoundRecording, RecordingInformationContributor } from './types/rin';

/**
 * Optional session/studio fields available on tracks for RecordingInformation messages.
 * These may be populated when extended track metadata is captured during recording.
 */
interface RecordingInformationTrackMetadata extends GoldenMetadata {
    sessionDate?: string;
    studioName?: string;
    studioCountry?: string;
}

/**
 * RecordingInformation Service
 * Manages creation of RecordingInformation Notification messages (Studio data)
 */
export class RecordingInformationService {

    /**
     * Generate a RecordingInformation message from GoldenMetadata
     * Focuses on detailed contributors, sessions, and instrumentation
     */
    generateRecordingInformation(
        metadata: ExtendedGoldenMetadata,
        messageId: string = `MSG-${Date.now()}`
    ): RecordingInformationMessage {

        const rinContent: RecordingInformationContent = {
            soundRecordings: this.buildSoundRecordings(metadata)
        };

        return {
            messageSchemaVersionId: '1.1',
            messageHeader: {
                messageId,
                messageSender: {
                    systemIdentifier: INGESTION_CONFIG.SYSTEM_IDENTIFIER,
                    entityName: INGESTION_CONFIG.ENTITY_NAME
                },
                messageRecipient: {
                    systemIdentifier: 'GenericRecipient',
                    entityName: 'Distributor'
                },
                messageCreatedDateTime: new Date().toISOString(),
                messageControlType: 'LiveMessage'
            },
            rinMessageContent: rinContent
        };
    }

    private buildSoundRecordings(metadata: ExtendedGoldenMetadata): RecordingInformationSoundRecording[] {
        if (!metadata.tracks) return [];

        // Tracks may carry optional session metadata for RecordingInformation purposes
        const tracks = metadata.tracks as RecordingInformationTrackMetadata[];

        return tracks.map((track, index) => {
            // In a real app, track extended metadata would contain session info.
            // For now, we infer/map from available contributor fields.

            const contributors: RecordingInformationContributor[] = [];

            // Map Release-level splits to track contributors (simplified inheritance)
            metadata.splits.forEach(split => {
                contributors.push({
                    entityName: split.legalName,
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
                // Session data sourced from track.credits when available;
                // falls back to release-level metadata (date, contributors)
                studioSessions: [({
                    sessionDate: track.sessionDate || metadata.releaseDate || '',
                    studioLocation: {
                        studioName: track.studioName || '',
                        countryCode: track.studioCountry || 'US'
                    },
                    participants: contributors.map(c => ({
                        entityName: c.entityName,
                        role: c.roles[0]!
                    }))
                })] as RecordingInformationSoundRecording['studioSessions']
            };
        });
    }
}

export const recordingInformationService = new RecordingInformationService();
