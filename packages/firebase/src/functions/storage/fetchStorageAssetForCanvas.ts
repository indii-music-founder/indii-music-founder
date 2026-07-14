import * as admin from 'firebase-admin';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { z } from 'zod';
import { validateAppCheckV2 } from '../../middleware/appCheck';
import { parseStorageUri, assertUserOwnsStoragePath } from '../../lib/storageUri';

const MAX_CANVAS_ASSET_BYTES = 20 * 1024 * 1024;

const FetchStorageAssetSchema = z.object({
  uri: z.string().min(1),
});

export const fetchStorageAssetForCanvas = onCall(
  { timeoutSeconds: 60, memory: '512MiB', enforceAppCheck: false },
  async (request): Promise<{ data: string; mimeType: string; size: number }> => {
    validateAppCheckV2(request);
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Authentication is required to load canvas assets.');
    }

    const parsed = FetchStorageAssetSchema.safeParse(request.data);
    if (!parsed.success) {
      throw new HttpsError('invalid-argument', 'A valid Storage asset URI is required.');
    }

    const { bucket, path } = parseStorageUri(parsed.data.uri);
    const defaultBucket = admin.storage().bucket().name;
    if (bucket !== defaultBucket) {
      throw new HttpsError('permission-denied', 'Storage asset bucket is not part of this project.');
    }
    assertUserOwnsStoragePath(path, request.auth.uid);

    const file = admin.storage().bucket(bucket).file(path);
    const [metadata] = await file.getMetadata().catch((error: unknown) => {
      throw new HttpsError('not-found', 'Storage asset metadata could not be loaded.', error);
    });

    const size = Number(metadata.size || 0);
    if (!Number.isFinite(size) || size <= 0) {
      throw new HttpsError('failed-precondition', 'Storage asset is empty or has invalid metadata.');
    }
    if (size > MAX_CANVAS_ASSET_BYTES) {
      throw new HttpsError('resource-exhausted', 'Storage asset is too large to load into the browser canvas.');
    }

    const [buffer] = await file.download().catch((error: unknown) => {
      throw new HttpsError('not-found', 'Storage asset bytes could not be loaded.', error);
    });

    return {
      data: buffer.toString('base64'),
      mimeType: metadata.contentType || 'image/png',
      size: buffer.length,
    };
  },
);
