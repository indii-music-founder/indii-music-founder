import { randomUUID } from 'node:crypto';
import { getFirestore, FieldPath } from 'firebase-admin/firestore';
import { HttpsError } from 'firebase-functions/v2/https';
import { SdkCreateDistribution, SdkSubmitDistribution, sdkPagination } from './sdkInput';
import { validSdkIdentifier } from './sdkRoute';

const ALLOWED_PLATFORMS = new Set(['spotify', 'apple', 'amazon', 'youtube', 'tiktok']);
const DISALLOWED_CLEARANCE_STATES = new Set([
  'uncleared',
  'rejected',
  'disputed',
  'blocked',
  'denied',
  'declared-but-unverified',
  'pending',
]);

function hasNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function hasVerifiedTrackAudio(track: Record<string, unknown>): boolean {
  return hasNonEmptyString(track.audioUrl)
    || hasNonEmptyString(track.storageUri)
    || hasNonEmptyString(track.masterAudioUrl)
    || hasNonEmptyString(track.masterStorageUri);
}

function hasVerifiedReleaseAudio(release: Record<string, unknown>, track: Record<string, unknown>): boolean {
  const assets = (release.assets && typeof release.assets === 'object') ? release.assets as Record<string, unknown> : undefined;
  return hasNonEmptyString(release.audioUrl)
    || hasNonEmptyString(release.masterAudioUrl)
    || hasNonEmptyString(release.storageUri)
    || hasNonEmptyString(assets?.audioUrl)
    || hasNonEmptyString(assets?.masterAudioUrl)
    || hasVerifiedTrackAudio(track);
}

function hasVerifiedCoverArt(release: Record<string, unknown>): boolean {
  const assets = (release.assets && typeof release.assets === 'object') ? release.assets as Record<string, unknown> : undefined;
  return hasNonEmptyString(release.coverArtUrl)
    || hasNonEmptyString(release.coverUrl)
    || hasNonEmptyString(release.artworkUrl)
    || hasNonEmptyString(assets?.coverArtUrl)
    || hasNonEmptyString(assets?.coverUrl);
}

function isClearanceVerified(release: Record<string, unknown>, track: Record<string, unknown>): boolean {
  const trackClearance = typeof track.clearanceStatus === 'string' ? track.clearanceStatus.trim().toLowerCase() : '';
  if (trackClearance && DISALLOWED_CLEARANCE_STATES.has(trackClearance)) {
    return false;
  }
  const releaseClearance = typeof release.clearanceStatus === 'string' ? release.clearanceStatus.trim().toLowerCase() : '';
  if (releaseClearance && DISALLOWED_CLEARANCE_STATES.has(releaseClearance)) {
    return false;
  }
  if (release.rightsCleared === true || release.clearanceVerified === true) {
    return true;
  }
  if (releaseClearance === 'cleared' || releaseClearance === 'verified' || releaseClearance === 'none-declared') {
    return true;
  }
  if (trackClearance === 'cleared' || trackClearance === 'verified' || trackClearance === 'none-declared') {
    return true;
  }
  return false;
}

function isOwnedByCaller(docData: Record<string, unknown>, uid: string): boolean {
  const ownerField = docData.userId ?? docData.ownerId ?? docData.artistId;
  return ownerField === uid;
}

/**
 * SDK distribution operations.
 * Draft metadata operations remain lightweight; `submitDistribution` enforces
 * fail-closed verification of release ownership, verified audio & cover media,
 * rights clearance, and distributor delivery targets before transitioning status.
 */
export async function executeSdkDistribution(
  uid: string,
  operation: 'listDistributions' | 'createDistribution' | 'getDistribution' | 'submitDistribution',
  id: string | undefined,
  body: unknown,
  query: Record<string, unknown>,
): Promise<unknown> {
  if (!uid || uid.includes('/') || uid.length > 128) throw new HttpsError('unauthenticated', 'A verified account is required.');
  const db = getFirestore();
  const owner = db.collection('users').doc(uid);
  const records = owner.collection('distributions');
  const receipts = owner.collection('distributionReceipts');

  const project = (key: string, value: Record<string, unknown>) => ({
    id: key,
    trackId: value.trackId,
    ...(hasNonEmptyString(value.releaseId) ? { releaseId: value.releaseId } : {}),
    platforms: value.platforms,
    status: value.status,
    scheduledDate: value.scheduledDate,
    ...(hasNonEmptyString(value.submittedAt) ? { submittedAt: value.submittedAt } : {}),
    ...(hasNonEmptyString(value.submissionReceiptId) ? { submissionReceiptId: value.submissionReceiptId } : {}),
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
  });

  if (operation === 'listDistributions') {
    const { limit, offset } = sdkPagination(query);
    const result = await records.orderBy(FieldPath.documentId()).offset(offset).limit(limit).get();
    return result.docs.filter(doc => doc.data().userId === uid).map(doc => project(doc.id, doc.data()));
  }

  if (operation === 'createDistribution') {
    const parsed = SdkCreateDistribution.safeParse(body);
    if (!parsed.success) throw new HttpsError('invalid-argument', 'Invalid distribution draft fields.');
    const key = randomUUID();
    return db.runTransaction(async transaction => {
      const track = await transaction.get(owner.collection('tracks').doc(parsed.data.trackId));
      const data = track.data();
      if (!track.exists || !data || (data.userId !== undefined && data.userId !== uid)) {
        throw new HttpsError('not-found', 'Owned track not found.');
      }
      const now = new Date().toISOString();
      const draft = { ...parsed.data, userId: uid, status: 'draft', createdAt: now, updatedAt: now };
      transaction.create(records.doc(key), draft);
      return project(key, draft);
    });
  }

  if (!validSdkIdentifier(id)) {
    throw new HttpsError('invalid-argument', 'Invalid distribution identifier.');
  }

  if (operation === 'submitDistribution') {
    const bodyObject = body && typeof body === 'object' && !Array.isArray(body) ? body : {};
    const parsedSubmit = SdkSubmitDistribution.safeParse(bodyObject);
    if (!parsedSubmit.success) {
      throw new HttpsError('invalid-argument', 'Invalid distribution submission payload.');
    }

    return db.runTransaction(async transaction => {
      const distRef = records.doc(id);
      const distSnap = await transaction.get(distRef);
      const distData = distSnap.data();
      if (!distSnap.exists || !distData || distData.userId !== uid) {
        throw new HttpsError('not-found', 'Distribution draft not found.');
      }
      if (distData.status !== 'draft') {
        throw new HttpsError('already-exists', `Distribution is already in '${String(distData.status)}' status and cannot be resubmitted.`);
      }

      const platforms = Array.isArray(distData.platforms)
        ? distData.platforms.filter((p): p is string => typeof p === 'string' && ALLOWED_PLATFORMS.has(p))
        : [];
      if (platforms.length === 0) {
        throw new HttpsError('failed-precondition', 'Submission requires at least one supported distributor platform.');
      }

      const trackId = typeof distData.trackId === 'string' ? distData.trackId : '';
      if (!validSdkIdentifier(trackId)) {
        throw new HttpsError('failed-precondition', 'Distribution draft is missing a valid owned track reference.');
      }

      const releaseId = parsedSubmit.data.releaseId
        ?? (hasNonEmptyString(distData.releaseId) ? distData.releaseId.trim() : '');
      if (!releaseId || !validSdkIdentifier(releaseId)) {
        throw new HttpsError(
          'failed-precondition',
          'Submission needs a verified release binding (provide releaseId referencing an owned release with verified media and clearance).',
        );
      }

      const trackSnap = await transaction.get(owner.collection('tracks').doc(trackId));
      const trackData = trackSnap.data();
      if (!trackSnap.exists || !trackData || (trackData.userId !== undefined && trackData.userId !== uid)) {
        throw new HttpsError('failed-precondition', 'Owned track referenced by this distribution was not found.');
      }

      // Resolve the bound release across canonical owner-scoped and ingestion/DDEX collections.
      const [userReleaseSnap, ingestionReleaseSnap, ddexReleaseSnap] = await Promise.all([
        transaction.get(owner.collection('releases').doc(releaseId)),
        transaction.get(db.collection('proprietaryIngestionReleases').doc(releaseId)),
        transaction.get(db.collection('ddexReleases').doc(releaseId)),
      ]);

      let releaseData: Record<string, unknown> | undefined;
      let releaseSource: string | undefined;
      if (userReleaseSnap.exists) {
        const candidate = userReleaseSnap.data() ?? {};
        if (candidate.userId === undefined || isOwnedByCaller(candidate, uid)) {
          releaseData = candidate;
          releaseSource = `users/${uid}/releases/${releaseId}`;
        }
      }
      if (!releaseData && ingestionReleaseSnap.exists) {
        const candidate = ingestionReleaseSnap.data() ?? {};
        if (isOwnedByCaller(candidate, uid)) {
          releaseData = candidate;
          releaseSource = `proprietaryIngestionReleases/${releaseId}`;
        }
      }
      if (!releaseData && ddexReleaseSnap.exists) {
        const candidate = ddexReleaseSnap.data() ?? {};
        if (isOwnedByCaller(candidate, uid)) {
          releaseData = candidate;
          releaseSource = `ddexReleases/${releaseId}`;
        }
      }

      if (!releaseData || !releaseSource) {
        throw new HttpsError('failed-precondition', 'Bound release was not found or is not owned by the authenticated account.');
      }

      if (!hasVerifiedReleaseAudio(releaseData, trackData)) {
        throw new HttpsError('failed-precondition', 'Submission requires verified master audio media on the track or bound release.');
      }

      if (!hasVerifiedCoverArt(releaseData)) {
        throw new HttpsError('failed-precondition', 'Submission requires verified cover artwork on the bound release.');
      }

      if (!isClearanceVerified(releaseData, trackData)) {
        throw new HttpsError('failed-precondition', 'Submission requires verified rights and sample clearance before delivery.');
      }

      const now = new Date().toISOString();
      const receiptId = `dist_sub_${randomUUID()}`;
      const updated = {
        ...distData,
        releaseId,
        releaseSource,
        platforms,
        status: 'submitted',
        submittedAt: now,
        submissionReceiptId: receiptId,
        updatedAt: now,
      };

      transaction.update(distRef, {
        releaseId,
        releaseSource,
        platforms,
        status: 'submitted',
        submittedAt: now,
        submissionReceiptId: receiptId,
        updatedAt: now,
      });
      transaction.create(receipts.doc(receiptId), {
        receiptId,
        distributionId: id,
        releaseId,
        releaseSource,
        trackId,
        userId: uid,
        platforms,
        status: 'submitted',
        submittedAt: now,
      });

      return project(id, updated);
    });
  }

  const record = await records.doc(id).get();
  const data = record.data();
  if (!record.exists || !data || data.userId !== uid) throw new HttpsError('not-found', 'Distribution draft not found.');
  return project(id, data);
}
