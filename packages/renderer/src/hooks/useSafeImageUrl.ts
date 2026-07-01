import { useEffect, useState } from 'react';
import { logger } from '@/utils/logger';

/**
 * Resolves a possibly cross-origin Storage URL to a same-origin blob: URL
 * before handing it to <img src>.
 *
 * The /creative route (and any route sharing its header block) runs with
 * Cross-Origin-Embedder-Policy: require-corp for SharedArrayBuffer/wasm audio
 * processing. Under that policy a plain <img src="https://firebasestorage...">
 * is silently blocked — GCS never sends a Cross-Origin-Resource-Policy header
 * — leaving a broken-image icon with no visible error. Mirrors the same
 * blob-URL workaround CanvasOperationsService.loadImageSafe already uses for
 * the canvas base image.
 *
 * Returns null while resolving/on failure so callers can show a loading or
 * fallback state instead of a broken <img>.
 */
export function useSafeImageUrl(url: string | null | undefined): string | null {
    const [resolvedUrl, setResolvedUrl] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        let objectUrl: string | null = null;
        setResolvedUrl(null);

        if (!url) return;

        if (url.startsWith('blob:') || url.startsWith('data:')) {
            setResolvedUrl(url);
            return;
        }

        if (!/^https?:\/\//i.test(url)) {
            setResolvedUrl(url);
            return;
        }

        (async () => {
            try {
                const { safeStorageFetch } = await import('@/services/storage/safeStorageFetch');
                const { blob } = await safeStorageFetch(url);
                if (cancelled) return;
                objectUrl = URL.createObjectURL(blob);
                setResolvedUrl(objectUrl);
            } catch (error) {
                logger.warn('[useSafeImageUrl] Failed to resolve image URL', error);
            }
        })();

        return () => {
            cancelled = true;
            if (objectUrl) URL.revokeObjectURL(objectUrl);
        };
    }, [url]);

    return resolvedUrl;
}
