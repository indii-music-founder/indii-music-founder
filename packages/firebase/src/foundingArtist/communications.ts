import * as admin from 'firebase-admin';
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { logger } from 'firebase-functions/v2';
import { resendApiKey, sendTransactionalEmail } from '../lib/notify';
import {
  FOUNDING_ARTIST_CAMPAIGNS_COLLECTION,
  FOUNDING_ARTIST_COMMUNICATIONS_COLLECTION,
} from './admin';
import {
  FOUNDING_ARTIST_EVENTS_COLLECTION,
  FOUNDING_ARTIST_WAITLIST_COLLECTION,
} from './waitlist';

const MAX_DELIVERY_ATTEMPTS = 3;
const DELIVERY_CONCURRENCY = 10;

type EmailSender = typeof sendTransactionalEmail;
type DeliveryStatus = 'sent' | 'skipped' | 'permanent_failed' | 'retryable_failure';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function invitationContent(actionUrl: string): { html: string; text: string } {
  const safeUrl = escapeHtml(actionUrl);
  return {
    html: `
      <div style="background:#090909;color:#f5f5f5;font-family:Arial,sans-serif;padding:32px">
        <div style="max-width:560px;margin:0 auto;border:1px solid #2f2f2f;border-radius:16px;padding:32px">
          <p style="color:#fbbf24;font-weight:700;letter-spacing:.08em;text-transform:uppercase">Founding Artist Beta</p>
          <h1 style="font-size:26px;line-height:1.2">Your access is ready.</h1>
          <p style="color:#c7c7c7;line-height:1.7">You joined the indii.music waitlist, and your place is ready. Sign in with the verified email address you used to join.</p>
          <p><a href="${safeUrl}" style="display:inline-block;background:#fbbf24;color:#111;padding:14px 22px;border-radius:10px;text-decoration:none;font-weight:700">Open indii.music</a></p>
          <p style="color:#777;font-size:13px;line-height:1.6">indii.music is working software that is still being refined. Founding Artists are asked to report bugs they encounter.</p>
        </div>
      </div>`,
    text: `Your Founding Artist Beta access is ready.\n\nSign in with the verified email address you used to join: ${actionUrl}\n\nindii.music is working software that is still being refined. Founding Artists are asked to report bugs they encounter.`,
  };
}

function milestoneContent(subject: string, message: string): { html: string; text: string } {
  const preferenceUrl = 'https://indii.music/?manageUpdates=true#waitlist';
  const safeSubject = escapeHtml(subject);
  const safeMessage = escapeHtml(message).replace(/\n/g, '<br>');
  return {
    html: `
      <div style="background:#090909;color:#f5f5f5;font-family:Arial,sans-serif;padding:32px">
        <div style="max-width:560px;margin:0 auto;border:1px solid #2f2f2f;border-radius:16px;padding:32px">
          <p style="color:#fbbf24;font-weight:700;letter-spacing:.08em;text-transform:uppercase">indii.music milestone</p>
          <h1 style="font-size:26px;line-height:1.2">${safeSubject}</h1>
          <p style="color:#c7c7c7;line-height:1.7">${safeMessage}</p>
          <p style="color:#777;font-size:12px;line-height:1.6">You requested major development milestones when you joined the Founding Artist Beta waitlist. <a href="${preferenceUrl}" style="color:#aaa">Manage email preferences</a>.</p>
        </div>
      </div>`,
    text: `${subject}\n\n${message}\n\nYou requested major development milestones when you joined the Founding Artist Beta waitlist. Manage email preferences: ${preferenceUrl}`,
  };
}

function asAttempts(value: unknown): number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : 0;
}

function normalizedEmail(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const email = value.trim().toLowerCase();
  return email.includes('@') ? email : null;
}

export async function deliverFoundingArtistInvitation(
  communicationId: string,
  firestore: admin.firestore.Firestore = admin.firestore(),
  send: EmailSender = sendTransactionalEmail,
): Promise<DeliveryStatus> {
  const communicationRef = firestore.collection(FOUNDING_ARTIST_COMMUNICATIONS_COLLECTION).doc(communicationId);
  const communicationSnapshot = await communicationRef.get();
  if (!communicationSnapshot.exists) return 'skipped';
  const communication = communicationSnapshot.data() as {
    type?: unknown;
    status?: unknown;
    recipientUid?: unknown;
    recipientEmail?: unknown;
    subject?: unknown;
    actionUrl?: unknown;
    attempts?: unknown;
  };
  if (communication.type !== 'beta_invitation') return 'skipped';
  if (communication.status === 'sent' || communication.status === 'skipped' || communication.status === 'permanent_failed') {
    return communication.status as DeliveryStatus;
  }

  const recipientUid = typeof communication.recipientUid === 'string' ? communication.recipientUid : '';
  const recipientEmail = normalizedEmail(communication.recipientEmail);
  const artistRef = firestore.collection(FOUNDING_ARTIST_WAITLIST_COLLECTION).doc(recipientUid);
  const artistSnapshot = recipientUid ? await artistRef.get() : null;
  const artist = artistSnapshot?.exists ? artistSnapshot.data() as {
    email?: unknown;
    status?: unknown;
    invitation?: unknown;
  } : null;
  const currentArtistEmail = normalizedEmail(artist?.email);
  if (!artist || artist.status !== 'waitlisted' || !recipientEmail || recipientEmail !== currentArtistEmail) {
    const batch = firestore.batch();
    batch.update(communicationRef, {
      status: 'skipped',
      failureReason: 'Recipient is no longer eligible for this invitation.',
      completedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    if (artistSnapshot?.exists) {
      batch.update(artistRef, {
        'invitation.status': 'failed',
        'invitation.failureReason': 'Recipient is no longer eligible for this invitation.',
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
    await batch.commit();
    return 'skipped';
  }

  const attempts = asAttempts(communication.attempts);
  const subject = typeof communication.subject === 'string'
    ? communication.subject
    : 'Your Founding Artist Beta access is ready';
  const actionUrl = typeof communication.actionUrl === 'string'
    ? communication.actionUrl
    : 'https://app.indii.music/';
  const content = invitationContent(actionUrl);
  const result = await send(recipientEmail, subject, content.html, {
    text: content.text,
    idempotencyKey: `founding-artist-invitation:${communicationId}`,
  });

  if (!result.sent) {
    const nextAttempts = attempts + 1;
    const permanent = nextAttempts >= MAX_DELIVERY_ATTEMPTS;
    const batch = firestore.batch();
    batch.update(communicationRef, {
      status: permanent ? 'permanent_failed' : 'failed',
      attempts: nextAttempts,
      failureReason: result.reason ?? 'Email provider rejected the invitation.',
      lastAttemptAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    batch.update(artistRef, {
      'invitation.status': permanent ? 'failed' : 'queued',
      'invitation.failureReason': result.reason ?? 'Email provider rejected the invitation.',
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    await batch.commit();
    if (permanent) return 'permanent_failed';
    throw new Error(result.reason ?? 'Founding Artist invitation delivery failed.');
  }

  await firestore.runTransaction(async (transaction) => {
    const freshArtist = await transaction.get(artistRef);
    const freshStatus = freshArtist.exists ? freshArtist.data()?.status : null;
    const timestamp = admin.firestore.FieldValue.serverTimestamp();
    transaction.update(communicationRef, {
      status: 'sent',
      attempts: attempts + 1,
      providerMessageId: result.messageId ?? null,
      sentAt: timestamp,
      failureReason: null,
    });
    if (freshStatus === 'waitlisted' || freshStatus === 'invited') {
      transaction.update(artistRef, {
        status: 'invited',
        'invitation.status': 'sent',
        'invitation.sentAt': timestamp,
        'invitation.providerMessageId': result.messageId ?? null,
        updatedAt: timestamp,
      });
      transaction.set(
        firestore.collection(FOUNDING_ARTIST_EVENTS_COLLECTION).doc(`${communicationId}_sent`),
        {
          uid: recipientUid,
          type: 'invitation_sent',
          fromStatus: freshStatus,
          toStatus: 'invited',
          communicationId,
          providerMessageId: result.messageId ?? null,
          createdAt: timestamp,
        },
      );
    }
  });
  return 'sent';
}

async function deliverMilestoneRecipient(
  campaignId: string,
  recipientUid: string,
  subject: string,
  message: string,
  firestore: admin.firestore.Firestore,
  send: EmailSender,
): Promise<DeliveryStatus> {
  const campaignRef = firestore.collection(FOUNDING_ARTIST_CAMPAIGNS_COLLECTION).doc(campaignId);
  const deliveryRef = campaignRef.collection('deliveries').doc(recipientUid);
  const artistRef = firestore.collection(FOUNDING_ARTIST_WAITLIST_COLLECTION).doc(recipientUid);
  const [deliverySnapshot, artistSnapshot] = await Promise.all([deliveryRef.get(), artistRef.get()]);
  const prior = deliverySnapshot.exists ? deliverySnapshot.data() as { status?: unknown; attempts?: unknown } : {};
  if (prior.status === 'sent' || prior.status === 'skipped' || prior.status === 'permanent_failed') {
    return prior.status as DeliveryStatus;
  }

  const artist = artistSnapshot.exists ? artistSnapshot.data() as {
    email?: unknown;
    emailVerified?: unknown;
    status?: unknown;
    communicationPreferences?: { majorMilestoneUpdates?: unknown };
  } : null;
  const email = normalizedEmail(artist?.email);
  const activeStatuses = new Set(['waitlisted', 'invited', 'accepted']);
  if (!artist || !email || artist.emailVerified !== true
    || artist.communicationPreferences?.majorMilestoneUpdates !== true
    || !activeStatuses.has(String(artist.status))) {
    await deliveryRef.set({
      recipientUid,
      status: 'skipped',
      reason: 'Recipient is not currently eligible or has disabled milestone updates.',
      completedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
    return 'skipped';
  }

  const attempts = asAttempts(prior.attempts);
  const content = milestoneContent(subject, message);
  const result = await send(email, subject, content.html, {
    text: content.text,
    idempotencyKey: `founding-artist-milestone:${campaignId}:${recipientUid}`,
  });
  if (!result.sent) {
    const nextAttempts = attempts + 1;
    const permanent = nextAttempts >= MAX_DELIVERY_ATTEMPTS;
    await deliveryRef.set({
      recipientUid,
      recipientEmail: email,
      status: permanent ? 'permanent_failed' : 'failed',
      attempts: nextAttempts,
      failureReason: result.reason ?? 'Email provider rejected the milestone update.',
      lastAttemptAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
    return permanent ? 'permanent_failed' : 'retryable_failure';
  }

  const timestamp = admin.firestore.FieldValue.serverTimestamp();
  const batch = firestore.batch();
  batch.set(deliveryRef, {
    recipientUid,
    recipientEmail: email,
    status: 'sent',
    attempts: attempts + 1,
    providerMessageId: result.messageId ?? null,
    sentAt: timestamp,
    failureReason: null,
  }, { merge: true });
  batch.set(
    firestore.collection(FOUNDING_ARTIST_EVENTS_COLLECTION).doc(`${campaignId}_${recipientUid}_sent`),
    {
      uid: recipientUid,
      type: 'milestone_update_sent',
      campaignId,
      providerMessageId: result.messageId ?? null,
      createdAt: timestamp,
    },
  );
  await batch.commit();
  return 'sent';
}

export async function deliverFoundingArtistMilestoneCampaign(
  campaignId: string,
  firestore: admin.firestore.Firestore = admin.firestore(),
  send: EmailSender = sendTransactionalEmail,
): Promise<{ sent: number; skipped: number; failed: number }> {
  const campaignRef = firestore.collection(FOUNDING_ARTIST_CAMPAIGNS_COLLECTION).doc(campaignId);
  const campaignSnapshot = await campaignRef.get();
  if (!campaignSnapshot.exists) return { sent: 0, skipped: 0, failed: 0 };
  const campaign = campaignSnapshot.data() as {
    type?: unknown;
    status?: unknown;
    subject?: unknown;
    message?: unknown;
    recipientUids?: unknown;
  };
  if (campaign.type !== 'major_milestone') return { sent: 0, skipped: 0, failed: 0 };
  if (campaign.status === 'completed' || campaign.status === 'completed_with_failures') {
    const summary = campaignSnapshot.data()?.summary as { sent?: number; skipped?: number; failed?: number } | undefined;
    return { sent: summary?.sent ?? 0, skipped: summary?.skipped ?? 0, failed: summary?.failed ?? 0 };
  }

  const recipientUids = Array.isArray(campaign.recipientUids)
    ? campaign.recipientUids.filter((uid): uid is string => typeof uid === 'string')
    : [];
  const subject = typeof campaign.subject === 'string' ? campaign.subject : 'indii.music milestone';
  const message = typeof campaign.message === 'string' ? campaign.message : '';
  const results: DeliveryStatus[] = [];

  for (let index = 0; index < recipientUids.length; index += DELIVERY_CONCURRENCY) {
    const chunk = recipientUids.slice(index, index + DELIVERY_CONCURRENCY);
    results.push(...await Promise.all(chunk.map((uid) => (
      deliverMilestoneRecipient(campaignId, uid, subject, message, firestore, send)
    ))));
  }

  const summary = {
    sent: results.filter((status) => status === 'sent').length,
    skipped: results.filter((status) => status === 'skipped').length,
    failed: results.filter((status) => status === 'permanent_failed' || status === 'retryable_failure').length,
  };
  const needsRetry = results.includes('retryable_failure');
  await campaignRef.update({
    status: needsRetry ? 'retrying' : summary.failed > 0 ? 'completed_with_failures' : 'completed',
    summary,
    lastAttemptAt: admin.firestore.FieldValue.serverTimestamp(),
    ...(needsRetry ? {} : { completedAt: admin.firestore.FieldValue.serverTimestamp() }),
  });
  if (needsRetry) throw new Error(`Milestone campaign ${campaignId} has retryable delivery failures.`);
  return summary;
}

export const sendFoundingArtistInvitation = onDocumentCreated(
  {
    document: `${FOUNDING_ARTIST_COMMUNICATIONS_COLLECTION}/{communicationId}`,
    region: 'us-central1',
    secrets: [resendApiKey],
    retry: true,
  },
  async (event) => {
    try {
      await deliverFoundingArtistInvitation(event.params.communicationId);
    } catch (error) {
      logger.error('[FoundingArtist] Invitation delivery will retry', {
        communicationId: event.params.communicationId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  },
);

export const sendFoundingArtistMilestoneCampaign = onDocumentCreated(
  {
    document: `${FOUNDING_ARTIST_CAMPAIGNS_COLLECTION}/{campaignId}`,
    region: 'us-central1',
    secrets: [resendApiKey],
    retry: true,
    timeoutSeconds: 540,
    memory: '512MiB',
  },
  async (event) => {
    try {
      await deliverFoundingArtistMilestoneCampaign(event.params.campaignId);
    } catch (error) {
      logger.error('[FoundingArtist] Milestone delivery will retry', {
        campaignId: event.params.campaignId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  },
);
