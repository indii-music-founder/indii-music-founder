import { describe, expect, it } from 'vitest';
import { projectLegacyTrackToCanonical } from './musicEntityCompatibility';

const now = '2026-09-19T20:00:00.000Z';

describe('projectLegacyTrackToCanonical', () => {
  it('projects legacy track data without using ISRC as canonical identity', () => {
    const result = projectLegacyTrackToCanonical({
      id: 'track-123',
      trackTitle: 'Old Catalog Song',
      isrc: 'USABC2600123',
      iswc: 'T-123.456.789-0',
      durationSeconds: 201,
    }, now);

    expect(result.recording.id).toBe('legacy-track:track-123:recording');
    expect(result.musicalWork.id).toBe('legacy-track:track-123:work');
    expect(result.identifiers.find(item => item.type === 'ISRC')?.entityId)
      .toBe(result.recording.id);
    expect(result.identifiers.find(item => item.type === 'ISWC')?.entityId)
      .toBe(result.musicalWork.id);
  });

  it('keeps duplicate legacy ISRC values attached to distinct recording identities', () => {
    const first = projectLegacyTrackToCanonical({
      id: 'track-a',
      title: 'Version A',
      isrc: 'USABC2600999',
    }, now);
    const second = projectLegacyTrackToCanonical({
      id: 'track-b',
      title: 'Version B',
      isrc: 'USABC2600999',
    }, now);

    expect(first.recording.id).not.toBe(second.recording.id);
    expect(first.identifiers[0]?.value).toBe(second.identifiers[0]?.value);
  });

  it('marks legacy projected facts as imported but not authoritative', () => {
    const result = projectLegacyTrackToCanonical({
      id: 'track-legacy',
      title: 'Legacy',
      isrc: 'USABC2600007',
    }, now);

    expect(result.recording.provenance?.sourceType).toBe('IMPORT');
    expect(result.recording.provenance?.state).toBe('UNKNOWN');
    expect(result.identifiers[0]?.provenance.state).toBe('UNKNOWN');
  });

  it('does not fabricate identifiers that are absent', () => {
    const result = projectLegacyTrackToCanonical({
      id: 'track-no-ids',
      title: 'No IDs Yet',
    }, now);

    expect(result.identifiers).toEqual([]);
  });
});
