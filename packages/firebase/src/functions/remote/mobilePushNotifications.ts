import * as admin from 'firebase-admin';
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { logger } from 'firebase-functions/v2';

const MOBILE_URL = 'https://app.indii.music/mobile-remote';

export function visualResultNotification(data: Record<string, unknown>): { title: string; body: string; url: string } | null {
  if (data.isFinal !== true) return null;
  if (Array.isArray(data.videoUrls) && data.videoUrls.length > 0) {
    return { title: 'Studio video ready', body: 'Open your mobile Studio to review the finished video.', url: `${MOBILE_URL}?tab=studio` };
  }
  if (Array.isArray(data.imageUrls) && data.imageUrls.length > 0) {
    return { title: 'Studio image ready', body: 'Open your mobile Studio to review the finished image.', url: `${MOBILE_URL}?tab=studio` };
  }
  return null;
}

async function sendMobilePush(uid: string, notice: { title: string; body: string; url: string }, tag: string): Promise<void> {
  const tokenDocs = await admin.firestore().collection(`users/${uid}/fcm_tokens`)
    .where('platform', 'in', ['iOS', 'Android']).limit(500).get();
  const registrations = tokenDocs.docs.filter(doc => {
    const data = doc.data();
    return (data.platform === 'iOS' || data.platform === 'Android') && typeof data.token === 'string' && data.token === doc.id;
  });
  if (registrations.length === 0) return;
  const result = await admin.messaging().sendEachForMulticast({
    tokens: registrations.map(doc => doc.id),
    data: { title: notice.title, body: notice.body, url: notice.url, tag },
    webpush: { headers: { TTL: '3600' } },
  });
  await Promise.all(result.responses.map(async (response, index) => {
    if (response.error?.code === 'messaging/registration-token-not-registered') {
      await registrations[index]?.ref.delete();
    }
  }));
  if (result.failureCount > 0) logger.warn('Some mobile push registrations failed', { uid, failures: result.failureCount });
}

export const notifyMobileVisualResult = onDocumentCreated(
  { document: 'users/{uid}/remote-relay-responses/{responseId}', region: 'us-central1' },
  async event => {
    const data = event.data?.data();
    if (!data) return;
    const notice = visualResultNotification(data);
    if (notice) await sendMobilePush(event.params.uid, notice, `visual-${event.params.responseId}`);
  },
);

export async function notifyNewMobileApproval(uid: string, rawApproval: unknown): Promise<void> {
  if (!rawApproval || typeof rawApproval !== 'object') return;
  const pending = rawApproval as { id?: unknown; expiresAt?: unknown };
  if (typeof pending.id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(pending.id) ||
      typeof pending.expiresAt !== 'number' || pending.expiresAt <= Date.now()) return;
  const stateRef = admin.firestore().doc(`users/${uid}/remote-relay/state`);
  const claimed = await admin.firestore().runTransaction(async tx => {
    const snapshot = await tx.get(stateRef);
    const lastSentAt = snapshot.get('lastPushedApprovalAt');
    if (snapshot.get('lastPushedApprovalId') === pending.id ||
        (typeof lastSentAt === 'number' && Date.now() - lastSentAt < 30_000)) return false;
    tx.set(stateRef, { lastPushedApprovalId: pending.id, lastPushedApprovalAt: Date.now() }, { merge: true });
    return true;
  });
  if (!claimed) return;
  try {
    await sendMobilePush(uid, {
      title: 'Studio approval needed',
      body: 'Open the paired remote to review and decide.',
      url: MOBILE_URL,
    }, `approval-${pending.id}`);
  } catch (error) {
    await admin.firestore().runTransaction(async tx => {
      const snapshot = await tx.get(stateRef);
      if (snapshot.get('lastPushedApprovalId') === pending.id) tx.update(stateRef, { lastPushedApprovalId: admin.firestore.FieldValue.delete() });
    });
    throw error;
  }
}
