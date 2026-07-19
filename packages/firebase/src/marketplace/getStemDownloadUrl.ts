/**
 * Firebase Cloud Function: Get Stem Download URL
 *
 * ISSUE-975 fix: stem-pack storage paths are never exposed in the public
 * `products` document (that's a bearer-token-equivalent leak once combined
 * with a download URL). Instead the seller writes a private manifest to
 * `marketplace_stem_manifests/{productId}` at listing time, and this
 * function is the ONLY path back to the actual file: it verifies the caller
 * is either the product's seller or holds a completed purchase, then mints
 * a short-lived signed URL via the Admin SDK (which bypasses Storage rules
 * entirely, same pattern as generateReleaseDownloadUrl).
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { logger } from 'firebase-functions';

export interface GetStemDownloadUrlParams {
  productId: string;
  label: string;
}

export const getStemDownloadUrl = onCall({
  timeoutSeconds: 30,
  memory: '256MiB',
  enforceAppCheck: true,
}, async (request) => {
  const buyerId = request.auth?.uid;
  if (!buyerId) {
    throw new HttpsError('unauthenticated', 'User must be signed in.');
  }

  const { productId, label } = request.data as GetStemDownloadUrlParams;
  if (!productId || !label) {
    throw new HttpsError('invalid-argument', 'productId and label are required.');
  }

  const db = getFirestore();
  const manifestSnap = await db.collection('marketplace_stem_manifests').doc(productId).get();
  if (!manifestSnap.exists) {
    throw new HttpsError('not-found', 'No stem manifest found for this product.');
  }
  const manifest = manifestSnap.data()!;

  const isSeller = manifest.sellerId === buyerId;
  if (!isSeller) {
    const purchaseSnap = await db.collection('purchases')
      .where('buyerId', '==', buyerId)
      .where('productId', '==', productId)
      .where('status', '==', 'completed')
      .limit(1)
      .get();
    if (purchaseSnap.empty) {
      throw new HttpsError('permission-denied', 'You must purchase this product to download its stems.');
    }
  }

  const stemEntry = (manifest.stemFiles as { label: string; storagePath: string }[] | undefined)
    ?.find(s => s.label === label);
  if (!stemEntry) {
    throw new HttpsError('not-found', `No stem found for label "${label}".`);
  }

  try {
    const bucket = getStorage().bucket();
    const file = bucket.file(stemEntry.storagePath);

    const [exists] = await file.exists();
    if (!exists) {
      logger.error(`[getStemDownloadUrl] File not found in storage: ${stemEntry.storagePath}`);
      throw new HttpsError('not-found', 'The requested stem file is currently unavailable.');
    }

    const expiresAt = Date.now() + 15 * 60 * 1000; // 15 minutes
    const [url] = await file.getSignedUrl({ action: 'read', expires: expiresAt });

    logger.info(`[getStemDownloadUrl] Generated signed URL for ${isSeller ? 'seller' : 'buyer'} ${buyerId}, product ${productId}, stem ${label}`);

    return { url, expiresAt };
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    logger.error('[getStemDownloadUrl] Error generating signed URL:', error);
    throw new HttpsError('internal', 'Failed to generate download link.');
  }
});
