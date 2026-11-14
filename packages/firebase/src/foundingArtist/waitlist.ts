import { createHash, randomUUID } from 'node:crypto';
import * as admin from 'firebase-admin';
import { HttpsError, onCall, type CallableRequest } from 'firebase-functions/v2/https';
import { z } from 'zod';
import { arcjetKey } from '../config/secrets';
import { requireVerifiedEmailV2, validateAppCheckV2 } from '../middleware/appCheck';
import { protectAuthenticatedApiRequest } from '../functions/security/arcjet';

export const FOUNDING_ARTIST_WAITLIST_COLLECTION = 'foundingArtistWaitlist';
export const FOUNDING_ARTIST_EMAIL_INDEX_COLLECTION = 'foundingArtistEmailIndex';
export const FOUNDING_ARTIST_WAITLIST_META_DOCUMENT = 'foundingArtistWaitlistMeta/sequence';
export const FOUNDING_ARTIST_EVENTS_COLLECTION = 'foundingArtistEvents';
export const FOUNDING_ARTIST_CONSENT_VERSION = '2026-08-29';

const requestSchema = z.object({
  source: z.string().trim().min(1).max(64).regex(/^[a-z0-9_-]+$/i, 'Invalid source slug').default('landing_page'),
  majorMilestoneUpdates: z.boolean().default(true),
}).strict();

export type FoundingArtistWaitlistStatus = 'waitlisted' | 'invited' | 'accepted' | 'declined' | 'revoked';

const PRESERVED_ENROLLED_STATUSES = new Set<string>(['waitlisted', 'invited', 'accepted', 'declined', 'revoked']);

export interface FoundingArtistEnrollmentResult {
  status: FoundingArtistWaitlistStatus;
  queuePosition: number;
  alreadyJoined: boolean;
}

export interface FoundingArtistInvitationAcceptanceResult {
  status: 'accepted';
  queuePosition: number;
  alreadyAccepted: boolean;
  betaAccessActive: true;
}

interface VerifiedIdentity {
  uid: string;
  email: string;
}

interface EnrollmentInput {
  source: string;
  majorMilestoneUpdates: boolean;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function validateVerifiedEmailOrThrow(email: string): string {
  const normalizedEmail = normalizeEmail(email);
  if (!z.string().email().max(320).safeParse(normalizedEmail).success) {
    throw new HttpsError('failed-precondition', 'The verified account does not contain a valid email address.');
  }
  return normalizedEmail;
}

function hashEmail(email: string): string {
  return createHash('sha256').update(email).digest('hex');
}

async function requireVerifiedFoundingArtistRequest(
  request: CallableRequest<unknown>,
  operationPrefix: string,
): Promise<VerifiedIdentity> {
  validateAppCheckV2(request);
  const uid = requireVerifiedEmailV2(request);
  if (request.auth?.token?.firebase?.sign_in_provider === 'anonymous') {
    throw new HttpsError('permission-denied', 'Anonymous accounts may not perform this operation.');
  }
  if (request.rawRequest) {
    const protection = await protectAuthenticatedApiRequest(request.rawRequest as never, {
      userId: uid,
      policy: 'verified-free',
      operationId: `${operationPrefix}:${uid}`,
    });
    if (!protection.allowed) {
      throw new HttpsError('resource-exhausted', 'Request rate limit exceeded. Please try again later.');
    }
  }
  const email = typeof request.auth?.token.email === 'string' ? request.auth.token.email : '';
  if (!email) {
    throw new HttpsError('failed-precondition', 'The verified account does not contain an email address.');
  }
  return { uid, email };
}

export async function enrollVerifiedFoundingArtist(
  identity: VerifiedIdentity,
  input: EnrollmentInput,
  firestore: admin.firestore.Firestore = admin.firestore(),
): Promise<FoundingArtistEnrollmentResult> {
  const normalizedEmail = validateVerifiedEmailOrThrow(identity.email);

  const emailHash = hashEmail(normalizedEmail);
  const artistRef = firestore.collection(FOUNDING_ARTIST_WAITLIST_COLLECTION).doc(identity.uid);
  const emailIndexRef = firestore.collection(FOUNDING_ARTIST_EMAIL_INDEX_COLLECTION).doc(emailHash);
  const metaRef = firestore.doc(FOUNDING_ARTIST_WAITLIST_META_DOCUMENT);
  const eventRef = firestore.collection(FOUNDING_ARTIST_EVENTS_COLLECTION).doc(`${identity.uid}_verified_enrollment`);

  return firestore.runTransaction(async (transaction) => {
    const [artistSnapshot, emailIndexSnapshot, metaSnapshot] = await Promise.all([
      transaction.get(artistRef),
      transaction.get(emailIndexRef),
      transaction.get(metaRef),
    ]);

    if (artistSnapshot.exists) {
      const existing = artistSnapshot.data() as {
        emailHash?: string;
        queuePosition?: number;
        status?: string;
        communicationPreferences?: { majorMilestoneUpdates?: boolean };
      };
      if (existing.emailHash !== emailHash) {
        throw new HttpsError('permission-denied', 'This account is already linked to a different verified email.');
      }
      if (existing.communicationPreferences?.majorMilestoneUpdates !== input.majorMilestoneUpdates) {
        const timestamp = admin.firestore.FieldValue.serverTimestamp();
        transaction.update(artistRef, {
          'communicationPreferences.majorMilestoneUpdates': input.majorMilestoneUpdates,
          'communicationPreferences.consentVersion': FOUNDING_ARTIST_CONSENT_VERSION,
          'communicationPreferences.recordedAt': timestamp,
          updatedAt: timestamp,
        });
        transaction.set(
          firestore.collection(FOUNDING_ARTIST_EVENTS_COLLECTION).doc(randomUUID()),
          {
            uid: identity.uid,
            type: 'milestone_preference_changed',
            majorMilestoneUpdates: input.majorMilestoneUpdates,
            consentVersion: FOUNDING_ARTIST_CONSENT_VERSION,
            createdAt: timestamp,
          },
        );
      }
      const existingStatus: FoundingArtistWaitlistStatus =
        typeof existing.status === 'string' && PRESERVED_ENROLLED_STATUSES.has(existing.status)
          ? existing.status as FoundingArtistWaitlistStatus
          : 'waitlisted';
      return {
        status: existingStatus,
        queuePosition: typeof existing.queuePosition === 'number' ? existing.queuePosition : 0,
        alreadyJoined: true,
      };
    }

    if (emailIndexSnapshot.exists) {
      const indexed = emailIndexSnapshot.data() as { uid?: string };
      if (indexed.uid && indexed.uid !== identity.uid) {
        throw new HttpsError('already-exists', 'This verified email is already on the Founding Artist waitlist.');
      }
    }

    const meta = metaSnapshot.exists ? metaSnapshot.data() as { nextPosition?: number } : {};
    const queuePosition = Number.isInteger(meta.nextPosition) && (meta.nextPosition ?? 0) > 0
      ? meta.nextPosition as number
      : 1;
    const timestamp = admin.firestore.FieldValue.serverTimestamp();

    transaction.set(metaRef, {
      nextPosition: queuePosition + 1,
      updatedAt: timestamp,
    }, { merge: true });
    transaction.set(artistRef, {
      uid: identity.uid,
      email: normalizedEmail,
      emailHash,
      status: 'waitlisted',
      queuePosition,
      source: input.source,
      emailVerified: true,
      verifiedAt: timestamp,
      joinedAt: timestamp,
      communicationPreferences: {
        betaInvitations: true,
        majorMilestoneUpdates: input.majorMilestoneUpdates,
        consentVersion: FOUNDING_ARTIST_CONSENT_VERSION,
        recordedAt: timestamp,
      },
      invitation: null,
      accountId: identity.uid,
      updatedAt: timestamp,
    });
    transaction.set(emailIndexRef, {
      uid: identity.uid,
      emailHash,
      queuePosition,
      createdAt: timestamp,
    });
    transaction.set(eventRef, {
      uid: identity.uid,
      type: 'verified_enrollment',
      fromStatus: null,
      toStatus: 'waitlisted',
      queuePosition,
      source: input.source,
      consentVersion: FOUNDING_ARTIST_CONSENT_VERSION,
      createdAt: timestamp,
    });

    return { status: 'waitlisted', queuePosition, alreadyJoined: false };
  });
}

export async function acceptVerifiedFoundingArtistInvitation(
  identity: VerifiedIdentity,
  firestore: admin.firestore.Firestore = admin.firestore(),
): Promise<FoundingArtistInvitationAcceptanceResult> {
  const normalizedEmail = validateVerifiedEmailOrThrow(identity.email);
  const emailHash = hashEmail(normalizedEmail);
  const artistRef = firestore.collection(FOUNDING_ARTIST_WAITLIST_COLLECTION).doc(identity.uid);
  const userRef = firestore.collection('users').doc(identity.uid);

  return firestore.runTransaction(async (transaction) => {
    const artistSnapshot = await transaction.get(artistRef);
    if (!artistSnapshot.exists) {
      throw new HttpsError('failed-precondition', 'No Founding Artist waitlist record exists for this account.');
    }

    const existing = artistSnapshot.data() as {
      emailHash?: unknown;
      queuePosition?: unknown;
      status?: unknown;
      invitation?: { communicationId?: unknown } | null;
    };

    if (existing.emailHash !== emailHash) {
      throw new HttpsError('permission-denied', 'This invitation belongs to a different verified email address.');
    }

    const queuePosition = typeof existing.queuePosition === 'number' ? existing.queuePosition : 0;
    if (existing.status === 'accepted') {
      return {
        status: 'accepted',
        queuePosition,
        alreadyAccepted: true,
        betaAccessActive: true,
      };
    }

    if (existing.status !== 'invited') {
      throw new HttpsError('failed-precondition', 'Your Founding Artist Beta invitation is not currently ready to accept.');
    }

    const timestamp = admin.firestore.FieldValue.serverTimestamp();
    const communicationId = typeof existing.invitation?.communicationId === 'string'
      ? existing.invitation.communicationId
      : null;
    const eventDocId = communicationId
      ? `${identity.uid}_invitation_accepted_${communicationId}`
      : `${identity.uid}_invitation_accepted_${randomUUID()}`;
    const eventRef = firestore.collection(FOUNDING_ARTIST_EVENTS_COLLECTION).doc(eventDocId);

    transaction.update(artistRef, {
      status: 'accepted',
      acceptedAt: timestamp,
      'invitation.status': 'accepted',
      'invitation.acceptedAt': timestamp,
      updatedAt: timestamp,
    });
    transaction.set(userRef, {
      foundingArtistBeta: {
        status: 'accepted',
        queuePosition,
        communicationId,
        acceptedAt: timestamp,
      },
      updatedAt: timestamp,
    }, { merge: true });
    transaction.set(eventRef, {
      uid: identity.uid,
      type: 'invitation_accepted',
      fromStatus: 'invited',
      toStatus: 'accepted',
      communicationId,
      queuePosition,
      createdAt: timestamp,
    });

    return {
      status: 'accepted',
      queuePosition,
      alreadyAccepted: false,
      betaAccessActive: true,
    };
  });
}

export async function joinFoundingArtistWaitlistHandler(
  request: CallableRequest<unknown>,
): Promise<FoundingArtistEnrollmentResult> {
  const identity = await requireVerifiedFoundingArtistRequest(request, 'founding-artist-waitlist');
  const parsed = requestSchema.safeParse(request.data ?? {});
  if (!parsed.success) {
    throw new HttpsError('invalid-argument', 'The waitlist request is invalid.');
  }

  return enrollVerifiedFoundingArtist(identity, parsed.data);
}

export async function acceptFoundingArtistInvitationHandler(
  request: CallableRequest<unknown>,
): Promise<FoundingArtistInvitationAcceptanceResult> {
  const identity = await requireVerifiedFoundingArtistRequest(request, 'founding-artist-accept');
  return acceptVerifiedFoundingArtistInvitation(identity);
}

export const joinFoundingArtistWaitlist = onCall(
  { cors: true, enforceAppCheck: false, secrets: [arcjetKey] },
  joinFoundingArtistWaitlistHandler,
);

export const acceptFoundingArtistInvitation = onCall(
  { cors: true, enforceAppCheck: false, secrets: [arcjetKey], memory: '512MiB' },
  acceptFoundingArtistInvitationHandler,
);
