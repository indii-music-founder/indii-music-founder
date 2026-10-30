import { randomUUID } from 'node:crypto';
import { getFirestore, FieldPath } from 'firebase-admin/firestore';
import { HttpsError } from 'firebase-functions/v2/https';
import { SdkCreateTrack, SdkUpdateTrack, sdkPagination } from './sdkInput';
import { validSdkIdentifier } from './sdkRoute';

/** Internal operation: uid must come from the request's verified principal. */
export async function executeSdkTrack(
  uid: string,
  operation: 'listTracks' | 'createTrack' | 'getTrack' | 'updateTrack' | 'deleteTrack',
  id: string | undefined,
  body: unknown,
  query: Record<string, unknown>,
): Promise<unknown> {
  if (!uid || uid.includes('/') || uid.length > 128) throw new HttpsError('unauthenticated', 'A verified account is required.');
  const db = getFirestore();
  const tracks = db.collection('users').doc(uid).collection('tracks');
  const project = (key: string, value: Record<string, unknown>) => ({
    id: key, artistId: uid, title: value.title, description: value.description,
    genre: value.genre, bpm: value.bpm, duration: value.duration,
    createdAt: value.createdAt, updatedAt: value.updatedAt,
  });
  if (operation === 'listTracks') {
    const { limit, offset } = sdkPagination(query);
    const page = await tracks.orderBy(FieldPath.documentId()).offset(offset).limit(limit).get();
    return page.docs.filter(doc => doc.data().userId === undefined || doc.data().userId === uid)
      .map(doc => project(doc.id, doc.data()));
  }
  if (operation === 'createTrack') {
    const parsed = SdkCreateTrack.safeParse(body);
    if (!parsed.success) throw new HttpsError('invalid-argument', 'Invalid editable track fields.');
    const key = randomUUID();
    const now = new Date().toISOString();
    const record = { ...parsed.data, userId: uid, artistId: uid, createdAt: now, updatedAt: now };
    await tracks.doc(key).create(record);
    return project(key, record);
  }
  if (!validSdkIdentifier(id)) {
    throw new HttpsError('invalid-argument', 'Invalid track identifier.');
  }
  const patch = operation === 'updateTrack' ? SdkUpdateTrack.safeParse(body) : undefined;
  if (patch && !patch.success) throw new HttpsError('invalid-argument', 'Invalid editable track fields.');
  const ref = tracks.doc(id);
  return db.runTransaction(async transaction => {
    const snapshot = await transaction.get(ref);
    const current = snapshot.data();
    if (!snapshot.exists || !current || (current.userId !== undefined && current.userId !== uid)) {
      throw new HttpsError('not-found', 'Track not found.');
    }
    if (operation === 'getTrack') return project(id, current);
    if (operation === 'deleteTrack') {
      transaction.delete(ref);
      return undefined;
    }
    const updates = { ...(patch && patch.success ? patch.data : {}), updatedAt: new Date().toISOString() };
    transaction.update(ref, updates);
    return project(id, { ...current, ...updates });
  });
}
