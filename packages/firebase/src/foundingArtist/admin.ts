import { randomUUID } from 'node:crypto';
import * as admin from 'firebase-admin';
import { HttpsError, onCall, type CallableRequest } from 'firebase-functions/v2/https';
import { z } from 'zod';
import {
  FOUNDING_ARTIST_EVENTS_COLLECTION,
  FOUNDING_ARTIST_WAITLIST_COLLECTION,
} from './waitlist';

export const FOUNDING_ARTIST_COMMUNICATIONS_COLLECTION = 'foundingArtistCommunications';
export const FOUNDING_ARTIST_CAMPAIGNS_COLLECTION = 'foundingArtistCampaigns';
export const FOUNDING_ARTIST_INVITE_URL = 'https://app.indii.music/';
export const FOUNDING_ARTIST_QUEUE_SCAN_LIMIT = 1000;
const FOUNDING_ARTIST_INVITE_SCAN_LIMIT = 25;

const ADMIN_EMAIL_DOMAIN = '@indii.music';

const milestoneRequestSchema = z.object({
  requestId: z.string().uuid(),
  subject: z.string().trim().min(1).max(120),
  message: z.string().trim().min(1).max(4000),
}).strict();

export interface FoundingArtistAdminIdentity {
  uid: string;
  email: string;
}

export interface InvitationQueueResult {
  queued: boolean;
  alreadyQueued: boolean;
  communicationId?: string;
  artistUid?: string;
  email?: string;
  queuePosition?: number;
  reason?: 'no_eligible_artist';
}

export interface MilestoneCampaignResult {
  campaignId: string;
  recipientCount: number;
  alreadyQueued: boolean;
}

interface WaitlistRecord {
  uid?: unknown;
  email?: unknown;
  emailVerified?: unknown;
  queuePosition?: unknown;
  status?: unknown;
  invitation?: { status?: unknown; communicationId?: unknown } | null;
  communicationPreferences?: { majorMilestoneUpdates?: unknown };
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function isValidStoredEmail(email: unknown): email is string {
  return typeof email === 'string' && z.string().email().max(320).safeParse(normalizeEmail(email)).success;
}

export function requireFoundingArtistAdmin(request: CallableRequest<unknown>): FoundingArtistAdminIdentity {
  const uid = request.auth?.uid;
  const email = typeof request.auth?.token.email === 'string'
    ? normalizeEmail(request.auth.token.email)
    : '';
  if (!uid) throw new HttpsError('unauthenticated', 'Administrator authentication is required.');
  if (request.auth?.token.email_verified !== true || !email.endsWith(ADMIN_EMAIL_DOMAIN)) {
    throw new HttpsError('permission-denied', 'A verified indii.music administrator account is required.');
  }
  return { uid, email };
}

export function selectNextInvitableArtist(
  documents: ReadonlyArray<{ id: string; data: () => WaitlistRecord }>,
): { id: string; data: WaitlistRecord } | null {
  for (const document of documents) {
    const data = document.data();
    if (data.status !== 'waitlisted' || data.emailVerified !== true || !isValidStoredEmail(data.email)) continue;
    return { id: document.id, data };
  }
  return null;
}

export function selectMilestoneRecipientUids(
  documents: ReadonlyArray<{ id: string; data: () => WaitlistRecord }>,
): string[] {
  const activeStatuses = new Set(['waitlisted', 'invited', 'accepted']);
  return documents
    .filter((document) => {
      const data = document.data();
      return data.emailVerified === true
        && isValidStoredEmail(data.email)
        && activeStatuses.has(typeof data.status === 'string' ? data.status : '')
        && data.communicationPreferences?.majorMilestoneUpdates === true;
    })
    .map((document) => document.id);
}

export async function queueNextFoundingArtistInvitation(
  actor: FoundingArtistAdminIdentity,
  firestore: admin.firestore.Firestore = admin.firestore(),
  newCommunicationId: () => string = randomUUID,
): Promise<InvitationQueueResult> {
  const queueQuery = firestore.collection(FOUNDING_ARTIST_WAITLIST_COLLECTION)
    .where('status', '==', 'waitlisted')
    .where('emailVerified', '==', true)
    .orderBy('queuePosition', 'asc')
    .limit(FOUNDING_ARTIST_INVITE_SCAN_LIMIT);

  return firestore.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(queueQuery);
    const candidate = selectNextInvitableArtist(snapshot.docs);
    if (!candidate) return { queued: false, alreadyQueued: false, reason: 'no_eligible_artist' };

    const queuePosition = typeof candidate.data.queuePosition === 'number'
      ? candidate.data.queuePosition
      : 0;
    const email = normalizeEmail(candidate.data.email as string);
    const existingInvitation = candidate.data.invitation;
    if (existingInvitation?.status === 'queued' && typeof existingInvitation.communicationId === 'string') {
      return {
        queued: true,
        alreadyQueued: true,
        communicationId: existingInvitation.communicationId,
        artistUid: candidate.id,
        email,
        queuePosition,
      };
    }

    const communicationId = newCommunicationId();
    const timestamp = admin.firestore.FieldValue.serverTimestamp();
    const artistRef = firestore.collection(FOUNDING_ARTIST_WAITLIST_COLLECTION).doc(candidate.id);
    const communicationRef = firestore.collection(FOUNDING_ARTIST_COMMUNICATIONS_COLLECTION).doc(communicationId);
    const eventRef = firestore.collection(FOUNDING_ARTIST_EVENTS_COLLECTION).doc(`${communicationId}_queued`);

    transaction.set(communicationRef, {
      type: 'beta_invitation',
      status: 'pending',
      recipientUid: candidate.id,
      recipientEmail: email,
      queuePosition,
      subject: 'Your Founding Artist Beta access is ready',
      actionUrl: FOUNDING_ARTIST_INVITE_URL,
      createdBy: actor,
      createdAt: timestamp,
      attempts: 0,
    });
    transaction.update(artistRef, {
      invitation: {
        status: 'queued',
        communicationId,
        queuedAt: timestamp,
        queuedBy: actor,
      },
      updatedAt: timestamp,
    });
    transaction.set(eventRef, {
      uid: candidate.id,
      type: 'invitation_queued',
      fromStatus: 'waitlisted',
      toStatus: 'waitlisted',
      communicationId,
      queuePosition,
      actor,
      createdAt: timestamp,
    });

    return {
      queued: true,
      alreadyQueued: false,
      communicationId,
      artistUid: candidate.id,
      email,
      queuePosition,
    };
  });
}

export async function queueFoundingArtistMilestoneCampaign(
  actor: FoundingArtistAdminIdentity,
  input: z.infer<typeof milestoneRequestSchema>,
  firestore: admin.firestore.Firestore = admin.firestore(),
): Promise<MilestoneCampaignResult> {
  const campaignRef = firestore.collection(FOUNDING_ARTIST_CAMPAIGNS_COLLECTION).doc(input.requestId);
  const queueQuery = firestore.collection(FOUNDING_ARTIST_WAITLIST_COLLECTION)
    .orderBy('queuePosition', 'asc')
    .limit(FOUNDING_ARTIST_QUEUE_SCAN_LIMIT + 1);

  return firestore.runTransaction(async (transaction) => {
    const [existingCampaign, waitlist] = await Promise.all([
      transaction.get(campaignRef),
      transaction.get(queueQuery),
    ]);
    if (existingCampaign.exists) {
      const existing = existingCampaign.data() as { recipientCount?: unknown };
      return {
        campaignId: campaignRef.id,
        recipientCount: typeof existing.recipientCount === 'number' ? existing.recipientCount : 0,
        alreadyQueued: true,
      };
    }

    if (waitlist.docs.length > FOUNDING_ARTIST_QUEUE_SCAN_LIMIT) {
      throw new HttpsError(
        'resource-exhausted',
        'The milestone audience exceeds the current safe batch size. No campaign was queued.',
      );
    }

    const recipientUids = selectMilestoneRecipientUids(waitlist.docs);
    const timestamp = admin.firestore.FieldValue.serverTimestamp();
    transaction.set(campaignRef, {
      type: 'major_milestone',
      status: 'pending',
      subject: input.subject,
      message: input.message,
      recipientUids,
      recipientCount: recipientUids.length,
      createdBy: actor,
      createdAt: timestamp,
      summary: null,
    });
    transaction.set(
      firestore.collection(FOUNDING_ARTIST_EVENTS_COLLECTION).doc(`${campaignRef.id}_milestone_queued`),
      {
        uid: null,
        type: 'milestone_campaign_queued',
        campaignId: campaignRef.id,
        recipientCount: recipientUids.length,
        actor,
        createdAt: timestamp,
      },
    );

    return {
      campaignId: campaignRef.id,
      recipientCount: recipientUids.length,
      alreadyQueued: false,
    };
  });
}

export async function inviteNextFoundingArtistHandler(
  request: CallableRequest<unknown>,
): Promise<InvitationQueueResult> {
  return queueNextFoundingArtistInvitation(requireFoundingArtistAdmin(request));
}

export async function queueFoundingArtistMilestoneUpdateHandler(
  request: CallableRequest<unknown>,
): Promise<MilestoneCampaignResult> {
  const actor = requireFoundingArtistAdmin(request);
  const parsed = milestoneRequestSchema.safeParse(request.data ?? {});
  if (!parsed.success) throw new HttpsError('invalid-argument', 'The milestone update is invalid.');
  return queueFoundingArtistMilestoneCampaign(actor, parsed.data);
}

export const inviteNextFoundingArtist = onCall(
  { cors: true, enforceAppCheck: false },
  inviteNextFoundingArtistHandler,
);

export const queueFoundingArtistMilestoneUpdate = onCall(
  { cors: true, enforceAppCheck: false },
  queueFoundingArtistMilestoneUpdateHandler,
);
