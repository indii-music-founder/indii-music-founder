import { storage } from '@/services/firebase';

const FIREBASE_DOWNLOAD_URL = /^https:\/\/firebasestorage\.googleapis\.com\/v0\/b\/([^/]+)\/o\/([^?]+)(?:\?.*)?$/i;
const GCS_DOWNLOAD_URL = /^https:\/\/storage\.googleapis\.com\/([^/]+)\/([^?]+)(?:\?.*)?$/i;

export function buildAssetStorageUri(assetId: string, userId: string): string | undefined {
    const bucket = storage?.app?.options?.storageBucket;
    if (!bucket || !assetId || !userId) return undefined;
    return `gs://${bucket}/users/${userId}/assets/${assetId}`;
}

export function resolveStorageUri(uri: string | null | undefined): string | undefined {
    if (!uri) return undefined;
    if (uri.startsWith('gs://')) return uri;

    const firebaseMatch = uri.match(FIREBASE_DOWNLOAD_URL);
    if (firebaseMatch) {
        return `gs://${firebaseMatch[1]}/${decodeURIComponent(firebaseMatch[2] ?? '')}`;
    }

    const gcsMatch = uri.match(GCS_DOWNLOAD_URL);
    if (gcsMatch) {
        return `gs://${gcsMatch[1]}/${decodeURIComponent(gcsMatch[2] ?? '')}`;
    }

    return undefined;
}
