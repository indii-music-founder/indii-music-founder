import { getDownloadURL, ref } from 'firebase/storage';
import { storage } from '@/services/firebase';

/**
 * Parse a `gs://<bucket>/<object-path>` URI into a Firebase Storage object
 * path (the path WITHIN the bucket). Handles a leading slash and returns
 * `{ bucket, path: '' }` for a bare bucket with no object.
 *
 * This is the path passed to `ref(storage, path)` — the app configures one
 * default bucket, so cross-bucket URIs can't be resolved via the Web SDK and
 * are left to the caller's fallback. (The old `split('/').slice(3)` cut the
 * bucket AND the first path segment incorrectly when the path had no bucket
 * prefix; `parseGcsObjectPath` is the single, testable source of truth.)
 */
export function parseGcsObjectPath(uri: string): { bucket: string; path: string } | null {
    const m = /^gs:\/\/([^/]+)\/(.*)$/.exec(uri);
    if (!m) return null;
    const bucket = m[1]!;
    const path = m[2]!.replace(/^\/+/, '');
    return { bucket, path };
}

export async function resolveStorageUrl(uri: string): Promise<string> {
    if (!uri.startsWith('gs://')) {
        return uri;
    }

    try {
        const parsed = parseGcsObjectPath(uri);
        if (!parsed || !parsed.path) {
            return uri;
        }
        return await getDownloadURL(ref(storage, parsed.path));
    } catch (error) {
        console.warn('[resolveStorageUrl] Failed to resolve Firebase Storage URI:', error);
        return uri;
    }
}
