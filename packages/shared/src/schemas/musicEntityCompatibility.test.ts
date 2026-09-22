import { describe, expect, it } from 'vitest';
import {
  projectLegacyReleaseToCanonical,
  projectLegacyTrackToCanonical,
} from './musicEntityCompatibility';
import { ReleaseEntitySchema } from './musicEntity';

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
  it('normalizes valid timestamps and omits invalid legacy dates', () => {
    const valid = projectLegacyReleaseToCanonical({ id: 'valid-date', releaseDate: '2026-09-19T20:00:00Z', originalReleaseDate: '2024-02-29T00:00:00-05:00' }, now);
    expect(valid.release.releaseDate).toBe('2026-09-19');
    expect(valid.release.originalReleaseDate).toBe('2024-02-29');
    expect(ReleaseEntitySchema.safeParse(valid.release).success).toBe(true);
    const invalid = projectLegacyReleaseToCanonical({ id: 'invalid-date', releaseDate: '2026-02-30', originalReleaseDate: 'not-a-date' }, now);
    expect(invalid.release).not.toHaveProperty('releaseDate');
    expect(invalid.release).not.toHaveProperty('originalReleaseDate');
  });
});

describe('projectLegacyReleaseToCanonical', () => {
  it('attaches product identifiers to a release entity rather than a recording', () => {
    const result = projectLegacyReleaseToCanonical({
      id: 'release-123',
      releaseTitle: 'Example Single',
      releaseType: 'Single',
      upc: '012345678905',
      catalogNumber: 'CAT-001',
    }, now);

    expect(result.release.id).toBe('legacy-release:release-123:release');
    expect(result.release.releaseType).toBe('SINGLE');
    expect(result.identifiers.map(item => item.type)).toEqual(['UPC', 'CATALOG_NUMBER']);
    expect(result.identifiers.every(item => item.entityId === result.release.id)).toBe(true);
  });

  it('keeps identical UPC values on distinct imported releases without merging identities', () => {
    const first = projectLegacyReleaseToCanonical({
      id: 'release-a',
      title: 'Release A',
      upc: '012345678905',
    }, now);
    const second = projectLegacyReleaseToCanonical({
      id: 'release-b',
      title: 'Release B',
      upc: '012345678905',
    }, now);

    expect(first.release.id).not.toBe(second.release.id);
    expect(first.identifiers[0]?.value).toBe(second.identifiers[0]?.value);
  });
});
