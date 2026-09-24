import {
    RecordingKindSchema,
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
            songIntake: updatedIntake,
        };

        await trackLibrary.saveTrack(updatedMetadata);
        return updatedMetadata;
    }
}

export const songIntakeReviewService = new SongIntakeReviewService();
