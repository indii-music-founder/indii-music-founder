import { beforeEach, describe, expect, it, vi } from 'vitest';
import { INITIAL_METADATA } from '@/services/metadata/types';
import { trackLibrary } from '@/services/metadata/TrackLibraryService';
import { SongIntakeReviewService } from './SongIntakeReviewService';

vi.mock('@/services/metadata/TrackLibraryService', () => ({
    trackLibrary: { saveTrack: vi.fn() },
}));

const now = '2026-09-24T12:00:00.000Z';
const metadata = () => ({
    ...INITIAL_METADATA,
    userId: 'user-1',
    masterFingerprint: 'fingerprint-1',
    songIntake: {
        schemaVersion: 'song-intake.v1' as const,
        intakeId: 'intake-1', ownerUid: 'user-1', recordingEntityId: 'recording:1',
        contentHash: 'a'.repeat(64), fingerprint: 'fingerprint-1', originalFileName: 'demo.wav',
        recordingKind: 'UNKNOWN' as const, technicalAnalysisComplete: true, embeddedTags: {}, catalogMatches: [],
        possibleExistingRelease: 'UNKNOWN' as const, confirmations: {},
        questions: [
            { key: 'recording.kind', prompt: 'Kind?', reason: 'Needs confirmation.', authoritative: true },
            { key: 'recording.title', prompt: 'Title?', reason: 'Needs confirmation.', authoritative: true },
            { key: 'release.history', prompt: 'Released before?', reason: 'Needs confirmation.', authoritative: true },
            { key: 'recording.sourceRelationship', prompt: 'Source?', reason: 'Needs canonical link.', authoritative: true },
            { key: 'rights.masterOwnership', prompt: 'Who controls it?', reason: 'Needs a human checkpoint.', authoritative: true },
        ],
        createdAt: now, updatedAt: now,
    },
});

describe('SongIntakeReviewService', () => {
    beforeEach(() => vi.clearAllMocks());

    it('persists a human-confirmed answer, updates release history, and replans questions', async () => {
        const result = await new SongIntakeReviewService().answer(metadata(), 'release.history', false, undefined, now);

        expect(result.songIntake?.possibleExistingRelease).toBe('NO');
        expect(result.songIntake?.questions.some(question => question.key === 'release.history')).toBe(false);
        expect(result.songIntake?.confirmations['release.history']).toMatchObject({
            value: false,
            provenance: { state: 'USER_CONFIRMED', sourceType: 'USER', sourceId: 'user-1', confirmedAt: now },
        });
        expect(trackLibrary.saveTrack).toHaveBeenCalledWith(result);
    });

    it('projects confirmed recording kind and title without using either as legal authority', async () => {
        const service = new SongIntakeReviewService();
        const withKind = await service.answer(metadata(), 'recording.kind', 'REMIX', undefined, now);
        const withTitle = await service.answer(withKind, 'recording.title', '  New Mix  ', undefined, now);

        expect(withTitle.songIntake?.recordingKind).toBe('REMIX');
        expect(withTitle.trackTitle).toBe('New Mix');
        expect(withTitle.songIntake?.questions.some(question => question.key === 'recording.kind')).toBe(false);
        expect(withTitle.songIntake?.questions.some(question => question.key === 'recording.title')).toBe(false);
        expect(withTitle.songIntake?.questions.some(question => question.key === 'recording.sourceRelationship')).toBe(true);
        expect(withTitle.isGolden).toBe(false);
    });

    it('records rights declarations but does not convert them into ownership fields', async () => {
        const result = await new SongIntakeReviewService().answer(metadata(), 'rights.masterOwnership', 'Artist controls the master', undefined, now);

        expect(result.songIntake?.questions.some(question => question.key === 'rights.masterOwnership')).toBe(false);
        expect(result.songIntake?.confirmations['rights.masterOwnership']?.provenance.state).toBe('USER_CONFIRMED');
        expect(result).not.toHaveProperty('recordingSplits');
        expect(result.splits).toEqual([]);
    });

    it('keeps source relationship pending until a canonical relationship can be made', async () => {
        const original = metadata();
        const remix = { ...original, songIntake: { ...original.songIntake, recordingKind: 'REMIX' as const } };
        const result = await new SongIntakeReviewService().answer(remix, 'recording.sourceRelationship', 'Older canonical recording', undefined, now);

        expect(result.songIntake?.confirmations['recording.sourceRelationship']?.value).toBe('Older canonical recording');
        expect(result.songIntake?.questions.some(question => question.key === 'recording.sourceRelationship')).toBe(true);
    });

    it('rejects stale questions and mismatched track/intake owners', async () => {
        const service = new SongIntakeReviewService();
        await expect(service.answer(metadata(), 'identifier.confirm.isrc', 'USABC2600001', undefined, now)).rejects.toThrow(/no longer pending/i);
        await expect(service.answer({ ...metadata(), userId: 'other-user' }, 'recording.title', 'Title', undefined, now)).rejects.toThrow(/owner does not match/i);
        expect(trackLibrary.saveTrack).not.toHaveBeenCalled();
    });
});
