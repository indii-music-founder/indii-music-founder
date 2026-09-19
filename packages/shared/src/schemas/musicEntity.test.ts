import { describe, expect, it } from 'vitest';
import {
  CanonicalMusicEntitySchema,
  MusicIdentifierSchema,
  ProvenanceSchema,
  RightsClaimSchema,
  isAuthoritativeProvenance,
} from './musicEntity';

const now = '2026-09-19T16:00:00.000Z';

const detected = {
  state: 'DETECTED' as const,
  sourceType: 'SYSTEM' as const,
  sourceId: 'embedded-metadata',
  confidence: 0.96,
  evidence: [],
  observedAt: now,
};

describe('CanonicalMusicEntitySchema', () => {
  it('keeps canonical identity separate from an ISRC', () => {
    const recording = CanonicalMusicEntitySchema.parse({
      schemaVersion: 'canonical-music-entity.v1',
      id: 'recording_internal_001',
      entityType: 'sound_recording',
      title: 'Example Track',
      recordingKind: 'ORIGINAL',
      createdAt: now,
      updatedAt: now,
    });

    const identifier = MusicIdentifierSchema.parse({
      id: 'identifier_001',
      entityId: recording.id,
      type: 'ISRC',
      value: 'USABC2600001',
      provenance: detected,
    });

    expect(recording.id).toBe('recording_internal_001');
    expect(identifier.entityId).toBe(recording.id);
    expect(identifier.value).toBe('USABC2600001');
    expect('isrc' in recording).toBe(false);
  });

  it('allows two canonical recordings to carry the same detected ISRC without merging them', () => {
    const first = MusicIdentifierSchema.parse({
      id: 'identifier_a',
      entityId: 'recording_a',
      type: 'ISRC',
      value: 'USABC2600002',
      provenance: detected,
    });
    const second = MusicIdentifierSchema.parse({
      id: 'identifier_b',
      entityId: 'recording_b',
      type: 'ISRC',
      value: 'USABC2600002',
      provenance: detected,
    });

    expect(first.entityId).not.toBe(second.entityId);
    expect(first.value).toBe(second.value);
  });

  it('distinguishes detected information from authoritative confirmation', () => {
    expect(isAuthoritativeProvenance('DETECTED')).toBe(false);
    expect(isAuthoritativeProvenance('INFERRED')).toBe(false);
    expect(isAuthoritativeProvenance('USER_CONFIRMED')).toBe(true);
    expect(isAuthoritativeProvenance('DOCUMENTED')).toBe(true);
    expect(isAuthoritativeProvenance('EXTERNAL_VERIFIED')).toBe(true);
  });

  it('supports evidence-backed provenance', () => {
    const parsed = ProvenanceSchema.parse({
      state: 'DOCUMENTED',
      sourceType: 'DOCUMENT',
      sourceId: 'license_pdf_001',
      observedAt: now,
      confirmedAt: now,
      evidence: [{
        id: 'evidence_001',
        type: 'LICENSE',
        description: 'Sample license',
        contentSha256: 'a'.repeat(64),
      }],
    });

    expect(parsed.evidence[0]?.type).toBe('LICENSE');
    expect(parsed.state).toBe('DOCUMENTED');
  });

  it('rejects unknown fields on canonical entities', () => {
    expect(() => CanonicalMusicEntitySchema.parse({
      schemaVersion: 'canonical-music-entity.v1',
      id: 'recording_001',
      entityType: 'sound_recording',
      title: 'Example',
      recordingKind: 'ORIGINAL',
      createdAt: now,
      updatedAt: now,
      isrc: 'USABC2600003',
    })).toThrow();
  });
  it('models rights claims as assertions with provenance and optional RDR weight', () => {
    const claim = RightsClaimSchema.parse({
      schemaVersion: 'rights-claim.v1',
      id: 'claim_001',
      targetEntityId: 'recording_internal_001',
      claimantEntityId: 'organization_001',
      type: 'MASTER',
      status: 'ASSERTED',
      sharePercentage: 50,
      weight: 2,
      territoryCodes: ['US'],
      provenance: {
        state: 'USER_DECLARED',
        sourceType: 'USER',
        sourceId: 'intake',
        evidence: [],
        observedAt: now,
      },
      createdAt: now,
      updatedAt: now,
    });

    expect(claim.status).toBe('ASSERTED');
    expect(claim.weight).toBe(2);
    expect(isAuthoritativeProvenance(claim.provenance.state)).toBe(false);
  });

  it('rejects invalid rights-claim date ranges', () => {
    expect(() => RightsClaimSchema.parse({
      schemaVersion: 'rights-claim.v1',
      id: 'claim_bad_dates',
      targetEntityId: 'recording_internal_001',
      type: 'MASTER',
      validFrom: '2026-09-20',
      validThrough: '2026-09-19',
      provenance: detected,
      createdAt: now,
      updatedAt: now,
    })).toThrow();
  });

});
