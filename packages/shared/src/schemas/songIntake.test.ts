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
    expect(intake.questions.some(q => q.key === 'recording.title')).toBe(true);
    expect(intake.questions.find(q => q.key === 'recording.title')?.prompt).toContain('Signal');
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
    // An artist type is useful context, but is never a credited-artist
    // confirmation. Rights-sensitive questions must remain unchanged.
    expect(withContext.questions.some(q => q.key === 'recording.artist')).toBe(true);
    expect(withContext.questions.filter(q => q.authoritative).length).toBe(withoutContext.questions.filter(q => q.authoritative).length);
  });

  it('requires human confirmation for detected artist tags even when profile context exists', () => {
    const artistContext: ArtistContext = { schemaVersion: 'artist-context.v1', facts: {
      'identity.displayName': {
        key: 'identity.displayName',
        value: 'Confirmed Artist',
        requiresHumanConfirmation: false,
        provenance: { state: 'USER_CONFIRMED', sourceType: 'USER', evidence: [], observedAt: now, confirmedAt: now },
      },
    }, updatedAt: now };
    const intake = withPlannedSongIntakeQuestions({ ...base, artistContext, embeddedTags: {
      artist: { key: 'artist', value: 'Different Embedded Name', requiresHumanConfirmation: true, provenance: { state: 'DETECTED', sourceType: 'SYSTEM', evidence: [], observedAt: now } },
    } });

    expect(intake.questions.find(question => question.key === 'recording.artist')?.prompt).toContain('Different Embedded Name');
  });

  it('asks every authority-required fact and removes only explicitly confirmed gaps', () => {
    const unanswered = withPlannedSongIntakeQuestions(base);
    expect(unanswered.questions.map(q => q.key)).toEqual(expect.arrayContaining([
      'rights.masterOwnership', 'rights.compositionWriters', 'rights.samples',
      'video.officialDesignation', 'migration.intent', 'dispute.intent',
    ]));
    const intake = withPlannedSongIntakeQuestions({ ...base, confirmations: {
      'rights.masterOwnership': { value: 'Artist controls 100% of master.', provenance: { state: 'USER_CONFIRMED', sourceType: 'USER', evidence: [], observedAt: now, confirmedAt: now } },
      'rights.samples': { value: false, provenance: { state: 'USER_CONFIRMED', sourceType: 'USER', evidence: [], observedAt: now, confirmedAt: now } },
    }});
    expect(intake.questions.some(q => q.key === 'rights.masterOwnership')).toBe(false);
    expect(intake.questions.some(q => q.key === 'rights.samples')).toBe(false);
    expect(intake.questions.some(q => q.key === 'rights.compositionWriters')).toBe(true);
  });

  it.each(['UNKNOWN', 'DETECTED', 'INFERRED', 'DISPUTED', 'USER_CONFIRMED', 'DOCUMENTED'] as const)(
    'does not let imported %s evidence satisfy a human checkpoint', state => {
      const intake = withPlannedSongIntakeQuestions({ ...base, embeddedTags: {
        isrc: { key: 'isrc', value: 'USABC2600001', requiresHumanConfirmation: true, provenance: { state: 'DETECTED', sourceType: 'SYSTEM', evidence: [], observedAt: now } },
      }, confirmations: {
        'rights.masterOwnership': { value: '100%', provenance: { state, sourceType: 'IMPORT', evidence: [], observedAt: now } },
        'rights.compositionWriters': { value: 'Imported writers', provenance: { state, sourceType: 'IMPORT', evidence: [], observedAt: now } },
        'rights.samples': { value: false, provenance: { state, sourceType: 'IMPORT', evidence: [], observedAt: now } },
        'identifier.confirm.isrc': { value: 'USABC2600001', provenance: { state, sourceType: 'IMPORT', evidence: [], observedAt: now } },
      }});
      expect(intake.questions.map(question => question.key)).toEqual(expect.arrayContaining([
        'rights.masterOwnership', 'rights.compositionWriters', 'rights.samples', 'identifier.confirm.isrc',
      ]));
    }
  );

  it('accepts a documented human checkpoint only when its evidence is present', () => {
    const noEvidence = withPlannedSongIntakeQuestions({ ...base, confirmations: {
      'rights.masterOwnership': { value: 'Documented', provenance: { state: 'DOCUMENTED', sourceType: 'DOCUMENT', evidence: [], observedAt: now } },
    }});
    const withEvidence = withPlannedSongIntakeQuestions({ ...base, confirmations: {
      'rights.masterOwnership': { value: 'Documented', provenance: {
        state: 'DOCUMENTED', sourceType: 'DOCUMENT', evidence: [{ id: 'agreement-1', type: 'AGREEMENT' }], observedAt: now,
      } },
    }});
    expect(noEvidence.questions.some(question => question.key === 'rights.masterOwnership')).toBe(true);
    expect(withEvidence.questions.some(question => question.key === 'rights.masterOwnership')).toBe(false);
  });

  it('does not let a system-tagged user confirmation satisfy a human checkpoint', () => {
    const intake = withPlannedSongIntakeQuestions({ ...base, confirmations: {
      'rights.masterOwnership': { value: '100%', provenance: { state: 'USER_CONFIRMED', sourceType: 'SYSTEM', evidence: [], observedAt: now } },
    }});
    expect(intake.questions.some(question => question.key === 'rights.masterOwnership')).toBe(true);
  });

  it.each(['REMIX', 'REMASTER', 'LIVE', 'ALTERNATE', 'INSTRUMENTAL', 'ACAPELLA', 'EDIT', 'COVER'] as const)(
    'branches %s intake to its source relationship', recordingKind => {
      const intake = withPlannedSongIntakeQuestions({ ...base, recordingKind });
      expect(intake.questions.some(q => q.key === 'recording.sourceRelationship')).toBe(true);
    }
  );

  it('stops asking for a source relationship only after a canonical source entity is recorded', () => {
    const linked = withPlannedSongIntakeQuestions({ ...base, recordingKind: 'REMIX', sourceEntityId: 'work:source-1' });
    expect(linked.questions.some(question => question.key === 'recording.sourceRelationship')).toBe(false);
    expect(() => withPlannedSongIntakeQuestions({ ...base, recordingKind: 'REMIX', sourceEntityId: 'USABC2600001' })).toThrow(/canonical work or recording ID/i);
  });

  it('records exact catalog matches as evidence without merging identity', () => {
    const intake = withPlannedSongIntakeQuestions({ ...base, catalogMatches: [{
      legacyTrackId: 'legacy-1', entityId: 'canonical-1', matchType: 'EXACT_FINGERPRINT', confidence: 1,
      provenance: { state: 'DETECTED', sourceType: 'SYSTEM', evidence: [], observedAt: now },
    }] });
    expect(intake.recordingEntityId).toBe('recording-1');
    expect(intake.catalogMatches[0]?.entityId).toBe('canonical-1');
  });
});
