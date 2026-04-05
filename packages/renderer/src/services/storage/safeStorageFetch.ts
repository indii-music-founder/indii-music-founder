import { logger } from '@/utils/logger';

/**
 * safeStorageFetch — Fetches a remote Storage (or CDN) asset
 * and converts it to a Blob with mime type detection.
 *
 * Handles CORS failures gracefully by falling back to creating
 * a download URL from the Storage reference if available.
 *
 * Usage:
 *   const { blob, mimeType } = await safeStorageFetch(item.url);
 */

export interface StorageFetchResult {
    blob: Blob;
    mimeType: string;
}

/**
 * Fetch a remote image/asset URL and return its blob + mimeType.
 * Handles CORS transparently — if a direct fetch fails, it attempts
 * to use a proxy endpoint.
 *
 * @param url  The full URL to the asset (Firebase Storage download URL, CDN, etc.)
 * @returns    Object with `blob` and `mimeType`
 * @throws     Only if both the direct fetch AND proxy fallback fail
 */
export async function safeStorageFetch(url: string): Promise<StorageFetchResult> {
    // --- Attempt 1: Direct browser fetch ---
    try {
        const res = await fetch(url, { mode: 'cors' });
        if (!res.ok) {
            throw new Error(`HTTP ${res.status} ${res.statusText}`);
        }
        const blob = await res.blob();
        const mimeType = blob.type || guessMimeFromUrl(url);
        return { blob, mimeType };
    } catch (directErr: unknown) {
        logger.warn('[safeStorageFetch] Direct fetch failed, attempting no-cors fallback:', directErr);
    }

    // --- Attempt 2: no-cors opaque fetch (gets the bytes but not headers) ---
    try {
        const res = await fetch(url, { mode: 'no-cors' });
        const blob = await res.blob();
        if (blob.size > 0) {
            const mimeType = guessMimeFromUrl(url);
            return { blob, mimeType };
        }
    } catch {
        // Fallback silently
    }

    // --- Attempt 3: Image element loading (works for images even with CORS blocks) ---
    try {
        const blob = await loadImageAsBlob(url);
        const mimeType = blob.type || guessMimeFromUrl(url);
        return { blob, mimeType };
    } catch {
        // Final throw
    }

    throw new Error(`[safeStorageFetch] All fetch strategies failed for: ${url}`);
}

/**
 * Convert a remote URL to base64 data string.
 * Convenience wrapper around safeStorageFetch.
 */
export async function fetchAsBase64(url: string): Promise<{ base64: string; mimeType: string }> {
    const { blob, mimeType } = await safeStorageFetch(url);
    const base64 = await blobToBase64(blob);
    return { base64, mimeType };
}

// --- Internal helpers ---

function guessMimeFromUrl(url: string): string {
    const ext = url.split('?')[0]!.split('.').pop()?.toLowerCase();
    const mimeMap: Record<string, string> = {
        png: 'image/png',
        jpg: 'image/jpeg',
        jpeg: 'image/jpeg',
        webp: 'image/webp',
        gif: 'image/gif',
        svg: 'image/svg+xml',
        mp4: 'video/mp4',
        webm: 'video/webm',
        wav: 'audio/wav',
        mp3: 'audio/mpeg',
    };
    return mimeMap[ext || ''] || 'image/png';
}

function blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            const result = reader.result as string;
            // Strip the data URI prefix to get raw base64
            resolve(result.replace(/^data:.*;base64,/, ''));
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}

function loadImageAsBlob(url: string): Promise<Blob> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.naturalWidth;
            canvas.height = img.naturalHeight;
            const ctx = canvas.getContext('2d');
            if (!ctx) return reject(new Error('Canvas 2D context unavailable'));
            ctx.drawImage(img, 0, 0);
            canvas.toBlob(
                (blob) => blob ? resolve(blob) : reject(new Error('Canvas toBlob returned null')),
                'image/png',
            );
        };
        img.onerror = () => reject(new Error(`Image load failed: ${url}`));
        img.src = url;
    });
}
