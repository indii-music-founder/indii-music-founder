import * as admin from 'firebase-admin';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { z } from 'zod';

const ENFORCE_APP_CHECK =
  process.env.SKIP_APP_CHECK !== 'true' && process.env.ENFORCE_APP_CHECK !== 'false';

const MAX_CANVAS_ASSET_BYTES = 20 * 1024 * 1024;

const FetchStorageAssetSchema = z.object({
  uri: z.string().min(1),
});

function parseStorageUri(uri: string): { bucket: string; path: string } {
  if (uri.startsWith('gs://')) {
    const withoutScheme = uri.slice('gs://'.length);
    const slashIndex = withoutScheme.indexOf('/');
    if (slashIndex <= 0 || slashIndex === withoutScheme.length - 1) {
      throw new HttpsError('invalid-argument', 'Storage URI must include a bucket and object path.');
    }
    return {
      bucket: withoutScheme.slice(0, slashIndex),
      path: withoutScheme.slice(slashIndex + 1),
    };
  }

  let url: URL;
  try {
    url = new URL(uri);
  } catch {
    throw new HttpsError('invalid-argument', 'Storage asset URL is not a valid URL.');
  }

  if (url.hostname === 'firebasestorage.googleapis.com') {
    const match = url.pathname.match(/^\/v0\/b\/([^/]+)\/o\/(.+)$/);
    if (!match) {
      throw new HttpsError('invalid-argument', 'Firebase Storage URL is missing bucket or object path.');
    }
    return {
      bucket: decodeURIComponent(match[1]),
      path: decodeURIComponent(match[2]),
    };
  }

  if (url.hostname === 'storage.googleapis.com') {
    const parts = url.pathname.replace(/^\/+/, '').split('/');
    const bucket = parts.shift();
    if (!bucket || parts.length === 0) {
      throw new HttpsError('invalid-argument', 'Google Storage URL is missing bucket or object path.');
    }
    return {
      bucket: decodeURIComponent(bucket),
      path: decodeURIComponent(parts.join('/')),
    };
  }

  throw new HttpsError('invalid-argument', 'Only Firebase Storage asset URLs are supported.');
}

function assertUserOwnsPath(path: string, userId: string): void {
  const allowedPrefixes = [
    `creative/${userId}/`,
    `users/${userId}/assets/`,
    `users/${userId}/generated_images/`,
  ];

  if (!allowedPrefixes.some(prefix => path.startsWith(prefix))) {
    throw new HttpsError('permission-denied', 'Storage asset is outside the authenticated user scope.');
  }
}

export const fetchStorageAssetForCanvas = onCall(
  { timeoutSeconds: 60, memory: '512MiB', enforceAppCheck: ENFORCE_APP_CHECK },
  async (request): Promise<{ data: string; mimeType: string; size: number }> => {
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
    assertUserOwnsPath(path, request.auth.uid);

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
