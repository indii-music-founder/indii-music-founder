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
  durationSeconds?: number;
  duration?: number;
}

export interface LegacyReleaseLike {
  id: string;
  releaseTitle?: string;
  title?: string;
  releaseType?: string;
  releaseDate?: string;
  originalReleaseDate?: string;
  upc?: string;
  ean?: string;
  icpn?: string;
  gridId?: string;
  catalogNumber?: string;
}

export interface CanonicalTrackProjection {
  recording: Extract<CanonicalMusicEntity, { entityType: 'sound_recording' }>;
  musicalWork: Extract<CanonicalMusicEntity, { entityType: 'musical_work' }>;
  identifiers: MusicIdentifier[];
}

export interface CanonicalReleaseProjection {
  release: Extract<CanonicalMusicEntity, { entityType: 'release' }>;
  identifiers: MusicIdentifier[];
}

function importedUnknown(sourceId: string, observedAt: string): Provenance {
  return {
    state: 'UNKNOWN',
    sourceType: 'IMPORT',
    sourceId,
    evidence: [],
    observedAt,
    note: 'Projected from a legacy record; authority has not been re-confirmed.',
  };
}

function normalizeOptional(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function normalizeLegacyDate(value: unknown): string | undefined {
  const normalized = normalizeOptional(value);
  if (!normalized) return undefined;
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,9})?)?(?:Z|([+-])(\d{2}):(\d{2})))?$/.exec(normalized);
  if (!match) return undefined;
  const [year, month, day] = match.slice(1).map(Number);
  const candidate = new Date(Date.UTC(year, month - 1, day));
  if (candidate.getUTCFullYear() !== year || candidate.getUTCMonth() !== month - 1 || candidate.getUTCDate() !== day) {
    return undefined;
  }

  if (match[4] === undefined) return `${match[1]}-${match[2]}-${match[3]}`;

  const [hour, minute, second = '0', offsetHour = '0', offsetMinute = '0'] = [match[4], match[5], match[6], match[8], match[9]];
  if (Number(hour) > 23 || Number(minute) > 59 || Number(second) > 59 || Number(offsetHour) > 14 || Number(offsetMinute) > 59) {
    return undefined;
  }
  if (Number(offsetHour) === 14 && Number(offsetMinute) !== 0) return undefined;

  return `${match[1]}-${match[2]}-${match[3]}`;
}

function mapLegacyReleaseType(value: string | undefined): CanonicalReleaseProjection['release']['releaseType'] {
  switch (value?.trim().toLowerCase()) {
    case 'single': return 'SINGLE';
    case 'ep': return 'EP';
    case 'album': return 'ALBUM';
    case 'compilation': return 'COMPILATION';
    case 'mixtape': return 'MIXTAPE';
    case 'videosingle':
    case 'video single':
      return 'VIDEO_SINGLE';
    default:
      return 'OTHER';
  }
}

/**
 * Non-destructively projects an existing track record into canonical v1 shapes.
 *
 * This function does not persist, mutate, merge, or delete anything. It is a
 * compatibility boundary only. Track-level ISRC and ISWC values remain
 * identifier objects and deliberately do not determine canonical entity IDs.
 *
 * Release identifiers are intentionally NOT accepted here: UPC/EAN/ICPN,
 * catalog numbers, and GRID identify releases/products and must be projected
 * through projectLegacyReleaseToCanonical instead of being attached to a
 * recording just because they happen to be present on a legacy track row.
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

  return { recording, musicalWork, identifiers };
}

/**
 * Projects a legacy release/product record without deriving identity from
 * UPC/EAN/ICPN/GRID/catalog-number values.
 */
export function projectLegacyReleaseToCanonical(
  legacy: LegacyReleaseLike,
  observedAt: string,
): CanonicalReleaseProjection {
  const legacyId = normalizeOptional(legacy.id);
  if (!legacyId) throw new Error('Legacy release id is required');

  const title = normalizeOptional(legacy.releaseTitle)
    ?? normalizeOptional(legacy.title)
    ?? 'Untitled Release';

  const provenance = importedUnknown(`legacy-release:${legacyId}`, observedAt);
  const releaseId = `legacy-release:${legacyId}:release`;
  const releaseDate = normalizeLegacyDate(legacy.releaseDate);
  const originalReleaseDate = normalizeLegacyDate(legacy.originalReleaseDate);

  const release: CanonicalReleaseProjection['release'] = {
    schemaVersion: 'canonical-music-entity.v1',
    id: releaseId,
    entityType: 'release',
    title,
    releaseType: mapLegacyReleaseType(legacy.releaseType),
    ...(releaseDate ? { releaseDate } : {}),
    ...(originalReleaseDate
      ? { originalReleaseDate }
      : {}),
    createdAt: observedAt,
    updatedAt: observedAt,
    provenance,
  };

  const identifiers: MusicIdentifier[] = [];

  const pushIdentifier = (
    type: MusicIdentifier['type'],
    value: string | undefined,
    suffix: string,
  ) => {
    const normalized = normalizeOptional(value);
    if (!normalized) return;
    identifiers.push({
      id: `legacy-release:${legacyId}:identifier:${suffix}`,
      entityId: releaseId,
      type,
      value: normalized,
      status: 'ACTIVE',
      provenance,
    });
  };

  pushIdentifier('UPC', legacy.upc, 'upc');
  pushIdentifier('EAN', legacy.ean, 'ean');
  pushIdentifier('ICPN', legacy.icpn, 'icpn');
  pushIdentifier('GRID', legacy.gridId, 'grid');
  pushIdentifier('CATALOG_NUMBER', legacy.catalogNumber, 'catalog-number');

  return { release, identifiers };
}
