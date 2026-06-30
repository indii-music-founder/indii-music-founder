import type { CatalogTrack } from '../types';

/**
 * ISSUE-567: Song Passport hash for approval freshness validation.
 *
 * Computes a SHA-256 hash of the legally-material fields of a CatalogTrack
 * so that we can detect if the Song Passport changed after approval.
 *
 * If the user edits splits, claimant, publisher, or IPI data after approving
 * a filing, the hash will differ and we block submission, requiring re-approval.
 */

async function sha256(data: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(data);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function computePassportHash(track: CatalogTrack): Promise<string> {
  // Canonical representation of rights-relevant fields only
  const canonical = {
    title: track.title,
    copyrightClaimant: track.copyrightClaimant,
    publisherName: track.publisherName,
    publisherNumber: track.publisherNumber,
    writers: (track.writersAndContributors || []).map(w => ({
      name: w.name,
      role: w.role,
      percentage: w.percentage,
      ipiNumber: w.ipiNumber,
    })),
    isPublished: track.isPublished,
    iswc: track.iswc,
  };

  const canonicalJson = JSON.stringify(canonical);
  return sha256(canonicalJson);
}

export async function validateApprovalFreshness(
  currentTrack: CatalogTrack,
  storedApprovalHash?: string
): Promise<{ isFresh: boolean; reason?: string }> {
  if (!storedApprovalHash) {
    return { isFresh: false, reason: 'No prior approval on record' };
  }

  const currentHash = await computePassportHash(currentTrack);
  if (currentHash === storedApprovalHash) {
    return { isFresh: true };
  }

  return {
    isFresh: false,
    reason: 'Song Passport changed since approval — re-approval required',
  };
}
