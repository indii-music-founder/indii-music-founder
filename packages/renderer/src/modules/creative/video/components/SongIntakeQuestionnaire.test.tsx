import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { INITIAL_METADATA } from '@/services/metadata/types';
import { songIntakeReviewService } from '@/services/ingestion/SongIntakeReviewService';
import { SongIntakeQuestionnaire } from './SongIntakeQuestionnaire';

vi.mock('@/services/ingestion/SongIntakeReviewService', () => ({
    songIntakeReviewService: { answer: vi.fn() },
}));

const now = '2026-09-24T12:00:00.000Z';
const metadata = (questionKey = 'release.history') => ({
    ...INITIAL_METADATA,
    userId: 'user-1',
    masterFingerprint: 'fingerprint-1',
    songIntake: {
        schemaVersion: 'song-intake.v1' as const,
        intakeId: 'intake-1', ownerUid: 'user-1', recordingEntityId: 'recording:1',
        contentHash: 'a'.repeat(64), fingerprint: 'fingerprint-1', originalFileName: 'demo.wav',
        recordingKind: 'UNKNOWN' as const, technicalAnalysisComplete: true, embeddedTags: {}, catalogMatches: [],
        possibleExistingRelease: 'UNKNOWN' as const, confirmations: {},
        questions: [{ key: questionKey, prompt: 'Has this been released before?', reason: 'Preserve history.', authoritative: true }],
        createdAt: now, updatedAt: now,
    },
});

describe('SongIntakeQuestionnaire', () => {
    beforeEach(() => vi.clearAllMocks());

    it('offers a non-blocking later option and records a yes/no answer', async () => {
        const onSaved = vi.fn();
        const onDismiss = vi.fn();
        const input = metadata();
        vi.mocked(songIntakeReviewService.answer).mockResolvedValue({ ...input, songIntake: { ...input.songIntake, questions: [] } });

        render(<SongIntakeQuestionnaire metadata={input} onSaved={onSaved} onDismiss={onDismiss} />);

        fireEvent.click(screen.getByRole('button', { name: /nothing will be discarded/i }));
        expect(onDismiss).toHaveBeenCalledOnce();
        fireEvent.click(screen.getByRole('button', { name: 'Yes' }));

        expect(songIntakeReviewService.answer).toHaveBeenCalledWith(input, 'release.history', true, undefined);
        await waitFor(() => expect(onSaved).toHaveBeenCalledOnce());
    });

    it('explains that source relationships require canonical IDs', () => {
        render(<SongIntakeQuestionnaire metadata={metadata('recording.sourceRelationship')} onSaved={vi.fn()} onDismiss={vi.fn()} />);

        expect(screen.getByText(/canonical DERIVED_FROM relationship/i)).toBeInTheDocument();
        expect(screen.getByRole('textbox', { name: 'Your answer' })).toBeInTheDocument();
    });
});
