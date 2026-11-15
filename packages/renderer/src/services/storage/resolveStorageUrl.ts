import { getDownloadURL, ref } from 'firebase/storage';
import { storage } from '@/services/firebase';

/**
 * Parse a `gs://<bucket>/<object-path>` URI into a Firebase Storage object
 * path (the path WITHIN the bucket). Handles a leading slash and returns
 * `{ bucket, path: '' }` for a bare bucket with no object.
 *
 * Parsing is used to reject malformed or bucket-only inputs. Resolution must
 * retain the original bucket: Firebase Storage accepts a complete gs:// URI.
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
        return await getDownloadURL(ref(storage, uri));
    } catch (error) {
        console.warn('[resolveStorageUrl] Failed to resolve Firebase Storage URI:', error);
        return uri;
    }
}
