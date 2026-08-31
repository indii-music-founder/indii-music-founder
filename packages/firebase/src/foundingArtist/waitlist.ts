import { createHash } from 'node:crypto';
import * as admin from 'firebase-admin';
import { HttpsError, onCall, type CallableRequest } from 'firebase-functions/v2/https';
import { z } from 'zod';
import { requireVerifiedEmailV2, validateAppCheckV2 } from '../middleware/appCheck';

export const FOUNDING_ARTIST_WAITLIST_COLLECTION = 'foundingArtistWaitlist';
export const FOUNDING_ARTIST_EMAIL_INDEX_COLLECTION = 'foundingArtistEmailIndex';
export const FOUNDING_ARTIST_WAITLIST_META_DOCUMENT = 'foundingArtistWaitlistMeta/sequence';
export const FOUNDING_ARTIST_EVENTS_COLLECTION = 'foundingArtistEvents';
export const FOUNDING_ARTIST_CONSENT_VERSION = '2026-08-29';

const requestSchema = z.object({
  source: z.enum(['landing_page', 'free_demo']).default('landing_page'),
  majorMilestoneUpdates: z.boolean().default(true),
}).strict();

export interface FoundingArtistEnrollmentResult {
  status: 'waitlisted';
  queuePosition: number;
  alreadyJoined: boolean;
}

interface VerifiedIdentity {
  uid: string;
  email: string;
}

interface EnrollmentInput {
  source: 'landing_page' | 'free_demo';
  majorMilestoneUpdates: boolean;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function hashEmail(email: string): string {
  return createHash('sha256').update(email).digest('hex');
}

export async function enrollVerifiedFoundingArtist(
  identity: VerifiedIdentity,
  input: EnrollmentInput,
  firestore: admin.firestore.Firestore = admin.firestore(),
): Promise<FoundingArtistEnrollmentResult> {
  const normalizedEmail = normalizeEmail(identity.email);
  if (!z.string().email().max(320).safeParse(normalizedEmail).success) {
    throw new HttpsError('failed-precondition', 'The verified account does not contain a valid email address.');
  }

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
      const existing = artistSnapshot.data() as { emailHash?: string; queuePosition?: number; status?: string };
      if (existing.emailHash !== emailHash) {
        throw new HttpsError('permission-denied', 'This account is already linked to a different verified email.');
      }
      return {
        status: 'waitlisted',
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

export async function joinFoundingArtistWaitlistHandler(
  request: CallableRequest<unknown>,
): Promise<FoundingArtistEnrollmentResult> {
  validateAppCheckV2(request);
  const uid = requireVerifiedEmailV2(request);
  const email = typeof request.auth?.token.email === 'string' ? request.auth.token.email : '';
  if (!email) {
    throw new HttpsError('failed-precondition', 'The verified account does not contain an email address.');
  }

  const parsed = requestSchema.safeParse(request.data ?? {});
  if (!parsed.success) {
    throw new HttpsError('invalid-argument', 'The waitlist request is invalid.');
  }

  return enrollVerifiedFoundingArtist({ uid, email }, parsed.data);
}

export const joinFoundingArtistWaitlist = onCall(
  { cors: true, enforceAppCheck: false },
  joinFoundingArtistWaitlistHandler,
);
