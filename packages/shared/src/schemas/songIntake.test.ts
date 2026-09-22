import { describe, expect, it } from 'vitest';
import { declaredContextFact, type ArtistContext } from './artistContext.js';
import { withPlannedSongIntakeQuestions } from './songIntake.js';

const now = '2026-09-22T12:00:00.000Z';
const base = {
  schemaVersion: 'song-intake.v1' as const, intakeId: 'intake-1', ownerUid: 'owner-1', recordingEntityId: 'recording-1',
  contentHash: 'a'.repeat(64), fingerprint: 'SONIC-1', originalFileName: 'song.wav', recordingKind: 'UNKNOWN' as const,
  technicalAnalysisComplete: true, embeddedTags: {}, catalogMatches: [], possibleExistingRelease: 'UNKNOWN' as const,
  createdAt: now, updatedAt: now,
};

describe('SongIntake', () => {
  it('asks only gaps and keeps detected identifiers behind confirmation', () => {
    const intake = withPlannedSongIntakeQuestions({ ...base, embeddedTags: {
      title: { key: 'title', value: 'Signal', requiresHumanConfirmation: true, provenance: { state: 'DETECTED', sourceType: 'SYSTEM', evidence: [], observedAt: now } },
      isrc: { key: 'isrc', value: 'USABC2600001', requiresHumanConfirmation: true, provenance: { state: 'DETECTED', sourceType: 'SYSTEM', evidence: [], observedAt: now } },
    }});
    expect(intake.questions.some(q => q.key === 'recording.title')).toBe(false);
    expect(intake.questions.some(q => q.key === 'identifier.confirm.isrc')).toBe(true);
    expect(intake.recordingEntityId).not.toContain('USABC');
  });

  it('uses artist context to materially reduce repeated questions', () => {
    const withoutContext = withPlannedSongIntakeQuestions(base);
    const artistContext: ArtistContext = { schemaVersion: 'artist-context.v1', facts: {
      'identity.artistType': declaredContextFact('identity.artistType', 'Singer-songwriter', now),
    }, updatedAt: now };
    const withContext = withPlannedSongIntakeQuestions({ ...base, artistContext });
    expect(withoutContext.questions.some(q => q.key === 'recording.artist')).toBe(true);
    expect(withContext.questions.some(q => q.key === 'recording.artist')).toBe(false);
    expect(withContext.questions.length).toBeLessThan(withoutContext.questions.length);
  });

  it.each(['REMIX', 'REMASTER', 'LIVE', 'ALTERNATE', 'INSTRUMENTAL', 'ACAPELLA', 'EDIT', 'COVER'] as const)(
    'branches %s intake to its source relationship', recordingKind => {
      const intake = withPlannedSongIntakeQuestions({ ...base, recordingKind });
      expect(intake.questions.some(q => q.key === 'recording.sourceRelationship')).toBe(true);
    }
  );

  it('records exact catalog matches as evidence without merging identity', () => {
    const intake = withPlannedSongIntakeQuestions({ ...base, catalogMatches: [{
      legacyTrackId: 'legacy-1', entityId: 'canonical-1', matchType: 'EXACT_FINGERPRINT', confidence: 1,
      provenance: { state: 'DETECTED', sourceType: 'SYSTEM', evidence: [], observedAt: now },
    }] });
    expect(intake.recordingEntityId).toBe('recording-1');
    expect(intake.catalogMatches[0]?.entityId).toBe('canonical-1');
  });
});
