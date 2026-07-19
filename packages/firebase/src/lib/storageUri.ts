import { HttpsError } from 'firebase-functions/v2/https';

/**
 * Parse a Firebase/Google Cloud Storage reference (gs:// URI, Firebase Storage
 * download URL, or storage.googleapis.com URL) into a bucket + object path.
 * Shared by any callable that must resolve a client-supplied storage reference
 * to a concrete file without trusting an arbitrary external URL (SSRF guard).
 */
export function parseStorageUri(uri: string): { bucket: string; path: string } {
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
      bucket: decodeURIComponent(match[1]!),
      path: decodeURIComponent(match[2]!),
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

/**
 * Enforce that a resolved storage object path is within the authenticated
 * user's own scope. Prevents one user from probing/reading another user's
 * private assets via a crafted storage reference.
 */
export function assertUserOwnsStoragePath(path: string, userId: string): void {
  const allowedPrefixes = [
    `creative/${userId}/`,
    `users/${userId}/assets/`,
    `users/${userId}/generated_images/`,
    `videos/${userId}/`,
  ];

  if (!allowedPrefixes.some(prefix => path.startsWith(prefix))) {
    throw new HttpsError('permission-denied', 'Storage asset is outside the authenticated user scope.');
  }
}
