import { randomUUID } from 'node:crypto';
import { getFirestore, FieldPath } from 'firebase-admin/firestore';
import { HttpsError } from 'firebase-functions/v2/https';
import { SdkCreateDistribution, sdkPagination } from './sdkInput';
import { validSdkIdentifier } from './sdkRoute';

/** Draft metadata operations only. A draft write is never delivery/submission proof. */
export async function executeSdkDistribution(
  uid: string, operation: 'listDistributions' | 'createDistribution' | 'getDistribution',
  id: string | undefined, body: unknown, query: Record<string, unknown>,
): Promise<unknown> {
  if (!uid || uid.includes('/') || uid.length > 128) throw new HttpsError('unauthenticated', 'A verified account is required.');
  const db = getFirestore();
  const owner = db.collection('users').doc(uid);
  const records = owner.collection('distributions');
  const project = (key: string, value: Record<string, unknown>) => ({
    id: key, trackId: value.trackId, platforms: value.platforms, status: value.status,
    scheduledDate: value.scheduledDate, createdAt: value.createdAt, updatedAt: value.updatedAt,
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
  const record = await records.doc(id).get();
  const data = record.data();
  if (!record.exists || !data || data.userId !== uid) throw new HttpsError('not-found', 'Distribution draft not found.');
  return project(id, data);
}
