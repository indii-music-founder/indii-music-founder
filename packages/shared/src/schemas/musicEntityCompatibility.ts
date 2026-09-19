import type {
  CanonicalMusicEntity,
  MusicIdentifier,
  Provenance,
} from './musicEntity.js';

export interface LegacyTrackLike {
  id: string;
  trackTitle?: string;
  title?: string;
  artistName?: string;
  artist?: string;
  isrc?: string;
  iswc?: string;
  upc?: string;
  ean?: string;
  catalogNumber?: string;
  durationSeconds?: number;
  duration?: number;
  releaseDate?: string;
  originalReleaseDate?: string;
}

export interface CanonicalTrackProjection {
  recording: Extract<CanonicalMusicEntity, { entityType: 'sound_recording' }>;
  musicalWork: Extract<CanonicalMusicEntity, { entityType: 'musical_work' }>;
  identifiers: MusicIdentifier[];
}

function importedUnknown(sourceId: string, observedAt: string): Provenance {
  return {
    state: 'UNKNOWN',
    sourceType: 'IMPORT',
    sourceId,
    evidence: [],
    observedAt,
    note: 'Projected from a legacy track record; authority has not been re-confirmed.',
  };
}

function normalizeOptional(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

/**
 * Non-destructively projects an existing track record into canonical v1 shapes.
 *
 * This function does not persist, mutate, merge, or delete anything. It is a
 * compatibility boundary only. Legacy identifiers are retained as identifier
 * objects and deliberately do not determine the canonical entity IDs.
 */
export function projectLegacyTrackToCanonical(
  track: LegacyTrackLike,
  observedAt: string,
): CanonicalTrackProjection {
  const legacyId = normalizeOptional(track.id);
  if (!legacyId) throw new Error('Legacy track id is required');

  const title = normalizeOptional(track.trackTitle)
    ?? normalizeOptional(track.title)
    ?? 'Untitled';

  const duration = typeof track.durationSeconds === 'number'
    ? track.durationSeconds
    : typeof track.duration === 'number'
      ? track.duration
      : undefined;

  const provenance = importedUnknown(`legacy-track:${legacyId}`, observedAt);

  const recordingId = `legacy-track:${legacyId}:recording`;
  const musicalWorkId = `legacy-track:${legacyId}:work`;

  const recording: CanonicalTrackProjection['recording'] = {
    schemaVersion: 'canonical-music-entity.v1',
    id: recordingId,
    entityType: 'sound_recording',
    title,
    recordingKind: 'UNKNOWN',
    ...(typeof duration === 'number' && Number.isFinite(duration) && duration >= 0
      ? { durationSeconds: duration }
      : {}),
    createdAt: observedAt,
    updatedAt: observedAt,
    provenance,
  };

  const musicalWork: CanonicalTrackProjection['musicalWork'] = {
    schemaVersion: 'canonical-music-entity.v1',
    id: musicalWorkId,
    entityType: 'musical_work',
    title,
    alternateTitles: [],
    createdAt: observedAt,
    updatedAt: observedAt,
    provenance,
  };

  const identifiers: MusicIdentifier[] = [];

  const pushIdentifier = (
    type: MusicIdentifier['type'],
    value: string | undefined,
    entityId: string,
    suffix: string,
  ) => {
    const normalized = normalizeOptional(value);
    if (!normalized) return;
    identifiers.push({
      id: `legacy-track:${legacyId}:identifier:${suffix}`,
      entityId,
      type,
      value: normalized,
      status: 'ACTIVE',
      provenance,
    });
  };

  pushIdentifier('ISRC', track.isrc, recordingId, 'isrc');
  pushIdentifier('ISWC', track.iswc, musicalWorkId, 'iswc');
  pushIdentifier('UPC', track.upc, recordingId, 'upc');
  pushIdentifier('EAN', track.ean, recordingId, 'ean');
  pushIdentifier('CATALOG_NUMBER', track.catalogNumber, recordingId, 'catalog-number');

  return { recording, musicalWork, identifiers };
}
