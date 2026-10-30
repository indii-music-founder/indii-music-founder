import * as admin from 'firebase-admin';
import { FieldPath } from 'firebase-admin/firestore';
import { HttpsError } from 'firebase-functions/v2/https';
import { SdkUpdateProfile, sdkPagination } from './sdkInput';

/** Called only after the HTTP boundary resolves a verified account principal. */
export async function executeSdkAccount(
  uid: string, operation: 'getProfile' | 'updateProfile' | 'getEvents', body: unknown,
  parameters: Record<string, unknown>,
): Promise<unknown> {
  if (!uid || uid.includes('/') || uid.length > 128) throw new HttpsError('unauthenticated', 'A verified account is required.');
  if (operation === 'getEvents') {
    const { limit, offset } = sdkPagination(parameters);
    const eventType = parameters.eventType;
    if (eventType !== undefined && (typeof eventType !== 'string' || !eventType.trim() || eventType.length > 128)) {
      throw new HttpsError('invalid-argument', 'Invalid event type.');
    }
    let query = admin.firestore().collection('events').where('userId', '==', uid);
    if (typeof eventType === 'string') query = query.where('eventType', '==', eventType);
    const snapshot = await query.orderBy(FieldPath.documentId()).offset(offset).limit(limit).get();
    return snapshot.docs.map(doc => {
      const value = doc.data();
      if (value.userId !== uid) throw new HttpsError('permission-denied', 'Event ownership mismatch.');
      const timestamp = typeof value.timestamp === 'number' ? value.timestamp
        : typeof value.timestamp === 'string' ? Date.parse(value.timestamp)
        : typeof value.timestamp?.toMillis === 'function' ? value.timestamp.toMillis() : NaN;
      if (!Number.isFinite(timestamp) || typeof value.eventType !== 'string') {
        throw new HttpsError('data-loss', 'Stored event does not satisfy the analytics contract.');
      }
      return { eventId: doc.id, eventType: value.eventType, userId: uid, timestamp, data: value.data ?? {} };
    });
  }
  if (operation === 'updateProfile') {
    const parsed = SdkUpdateProfile.safeParse(body);
    if (!parsed.success) throw new HttpsError('invalid-argument', 'Only a nonempty display name may be updated.');
    await admin.auth().updateUser(uid, { displayName: parsed.data.name });
  }
  const profile = await admin.auth().getUser(uid);
  return { id: uid, email: profile.email, name: profile.displayName || 'Unnamed User', createdAt: profile.metadata.creationTime };
}
