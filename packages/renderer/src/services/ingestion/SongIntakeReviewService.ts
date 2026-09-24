import {
    RecordingKindSchema,
    MusicRelationshipSchema,
    SongIntakeConfirmationSchema,
    withPlannedSongIntakeQuestions,
    type ArtistContext,
    type SongIntakeQuestion,
} from '@indii/shared';
import type { ExtendedGoldenMetadata } from '@/services/metadata/types';
import { trackLibrary } from '@/services/metadata/TrackLibraryService';

const yesNoQuestions = new Set([
    'release.history',
    'video.officialDesignation',
    'migration.intent',
    'dispute.intent',
]);

/** Saves artist responses while keeping legal and rights authority review separate. */
export class SongIntakeReviewService {
    async answer(
        metadata: ExtendedGoldenMetadata,
        questionKey: SongIntakeQuestion['key'],
        value: string | boolean | string[],
        artistContext?: ArtistContext,
        answeredAt = new Date().toISOString(),
    ): Promise<ExtendedGoldenMetadata> {
        const intake = metadata.songIntake;
        if (!intake) throw new Error('This track has no song intake to review.');
        if (metadata.userId && metadata.userId !== intake.ownerUid) {
            throw new Error('Song intake owner does not match the track owner.');
        }
        if (!intake.questions.some(question => question.key === questionKey)) {
            throw new Error('This question is no longer pending. Refresh the intake before answering.');
        }

        let normalizedValue: string | boolean | string[] = value;
        if (typeof value === 'string') normalizedValue = value.trim();
        if (typeof normalizedValue === 'string' && normalizedValue.length === 0) {
            throw new Error('Enter an answer or choose “Not sure yet.”');
        }
        if (questionKey === 'recording.kind') normalizedValue = RecordingKindSchema.parse(normalizedValue);
        if (yesNoQuestions.has(questionKey) && typeof normalizedValue !== 'boolean') {
            throw new Error('Choose yes or no to answer this question.');
        }
        if (questionKey === 'release.history' && typeof normalizedValue !== 'boolean') {
            throw new Error('Choose yes or no to answer release history.');
        }
        const sourceEntityId = questionKey === 'recording.sourceRelationship'
            ? this.requireCanonicalSourceEntityId(normalizedValue, intake.recordingEntityId)
            : intake.sourceEntityId;

        const confirmation = SongIntakeConfirmationSchema.parse({
            value: normalizedValue,
            provenance: {
                state: 'USER_CONFIRMED',
                sourceType: 'USER',
                sourceId: intake.ownerUid,
                evidence: [],
                observedAt: answeredAt,
                confirmedAt: answeredAt,
            },
        });
        const confirmations = { ...intake.confirmations, [questionKey]: confirmation };
        const recordingKind = questionKey === 'recording.kind'
            ? RecordingKindSchema.parse(normalizedValue)
            : intake.recordingKind;
        const possibleExistingRelease = questionKey === 'release.history'
            ? (normalizedValue ? 'YES' : 'NO')
            : intake.possibleExistingRelease;
        const updatedIntake = withPlannedSongIntakeQuestions({
            ...intake,
            recordingKind,
            sourceEntityId,
            possibleExistingRelease,
            confirmations,
            artistContext,
            updatedAt: answeredAt,
        });
        const updatedMetadata: ExtendedGoldenMetadata = {
            ...metadata,
            ...(questionKey === 'recording.title' && typeof normalizedValue === 'string'
                ? { trackTitle: normalizedValue }
                : {}),
            ...(questionKey === 'recording.artist' && typeof normalizedValue === 'string'
                ? { artistName: normalizedValue }
                : {}),
            ...(questionKey === 'recording.sourceRelationship' && sourceEntityId
                ? { musicRelationships: this.addSourceRelationship(metadata, intake, sourceEntityId, answeredAt) }
                : {}),
            songIntake: updatedIntake,
        };

        await trackLibrary.saveTrack(updatedMetadata);
        return updatedMetadata;
    }

    private requireCanonicalSourceEntityId(value: string | boolean | string[], currentEntityId: string): string {
        if (typeof value !== 'string') throw new Error('Enter a canonical work or recording ID.');
        const sourceEntityId = value.trim();
        if (!(sourceEntityId.startsWith('recording:') || sourceEntityId.startsWith('work:')) || sourceEntityId.length <= sourceEntityId.indexOf(':') + 1) {
            throw new Error('Use an indii canonical ID beginning with “recording:” or “work:”; ISRC and platform IDs are not canonical identity.');
        }
        if (sourceEntityId === currentEntityId) throw new Error('A recording cannot be its own source.');
        return sourceEntityId;
    }

    private addSourceRelationship(
        metadata: ExtendedGoldenMetadata,
        intake: NonNullable<ExtendedGoldenMetadata['songIntake']>,
        sourceEntityId: string,
        answeredAt: string,
    ) {
        const current = metadata.musicRelationships ?? [];
        const existing = current.find(relationship => relationship.fromEntityId === intake.recordingEntityId
            && relationship.toEntityId === sourceEntityId && relationship.type === 'DERIVED_FROM');
        if (existing) return current;

        const relationshipId = `rel:${intake.fingerprint.slice(0, 96)}:${Date.parse(answeredAt).toString(36)}`;
        const relationship = MusicRelationshipSchema.parse({
            schemaVersion: 'music-relationship.v1',
            id: relationshipId,
            fromEntityId: intake.recordingEntityId,
            toEntityId: sourceEntityId,
            type: 'DERIVED_FROM',
            status: 'ACTIVE',
            attributes: { confirmedDuring: 'song-intake' },
            provenance: {
                state: 'USER_CONFIRMED', sourceType: 'USER', sourceId: intake.ownerUid,
                evidence: [], observedAt: answeredAt, confirmedAt: answeredAt,
            },
            createdAt: answeredAt,
            updatedAt: answeredAt,
        });
        return [...current, relationship];
    }
}

export const songIntakeReviewService = new SongIntakeReviewService();
