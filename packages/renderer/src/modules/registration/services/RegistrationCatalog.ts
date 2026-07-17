import { collection, getDocs } from 'firebase/firestore';

import { db } from '@/services/firebase';
import type { CatalogTrack } from '../types';

interface CatalogDocument extends Record<string, unknown> {
  deleted?: boolean;
}

function contributorsFrom(data: CatalogDocument): CatalogTrack['writersAndContributors'] {
  const existing = Array.isArray(data.compositionSplits)
    ? data.compositionSplits
    : Array.isArray(data.writersAndContributors)
      ? data.writersAndContributors
      : Array.isArray(data.contributors)
        ? data.contributors
        : null;

  const source = existing ?? (Array.isArray(data.splits)
    ? data.splits.filter(split => (
      split && typeof split === 'object' && (split as Record<string, unknown>).role === 'songwriter'
    ))
    : []);

  return source.flatMap(split => {
    if (!split || typeof split !== 'object') return [];
    const value = split as Record<string, unknown>;
    const rawName = value.legalName ?? value.name;
    const name = typeof rawName === 'string' ? rawName.trim() : '';
    const role = typeof value.role === 'string' ? value.role : 'other';
    const percentage = typeof value.percentage === 'number' ? value.percentage : Number(value.percentage);
    if (!name || !Number.isFinite(percentage)) return [];
    return [{ name, role, percentage }];
  });
}

export async function loadRegistrationCatalog(userId: string): Promise<CatalogTrack[]> {
  const snapshot = await getDocs(collection(db, `users/${userId}/tracks`));

  return snapshot.docs
    .map(track => ({ id: track.id, data: track.data() as CatalogDocument }))
    .filter(({ data }) => data.deleted !== true)
    .map(({ id, data }) => ({
      id,
      title: String(data.trackTitle ?? data.title ?? 'Untitled'),
      artistName: String(data.artistName ?? data.artist ?? ''),
      writersAndContributors: contributorsFrom(data),
      isrc: typeof data.isrc === 'string' ? data.isrc : undefined,
      iswc: typeof data.iswc === 'string' ? data.iswc : undefined,
      releaseDate: typeof data.releaseDate === 'string' ? data.releaseDate : undefined,
      genre: typeof data.genre === 'string' ? data.genre : undefined,
      duration: typeof data.durationSeconds === 'number'
        ? data.durationSeconds
        : typeof data.duration === 'number' ? data.duration : undefined,
      bpm: typeof data.bpm === 'number' ? data.bpm : undefined,
      musicalKey: typeof (data.key ?? data.musicalKey) === 'string'
        ? String(data.key ?? data.musicalKey)
        : undefined,
      isPublished: data.isPublished === true || data.status === 'live' || data.distributionStatus === 'live',
      yearOfCreation: String(data.yearOfCreation ?? data.pLineYear ?? new Date().getFullYear()),
      copyrightClaimant: String(data.copyrightClaimant ?? data.artistName ?? data.artist ?? ''),
      workForHire: data.workForHire === true,
      countryOfFirstPublication: String(data.countryOfFirstPublication ?? 'United States'),
      publisherName: typeof data.publisherName === 'string' ? data.publisherName : undefined,
      publisherNumber: typeof data.publisherNumber === 'string' ? data.publisherNumber : undefined,
    }));
}
