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

        const isGsUri = url.startsWith('gs://');
        if (!isGsUri && !/^https?:\/\//i.test(url)) {
            // Unknown scheme (e.g. placeholder: sentinels) — <img> can't render it.
            // Return null so callers show their fallback instead of broken alt text.
            return;
        }

        (async () => {
            try {
                let fetchableUrl = url;
                if (isGsUri) {
                    // gs:// URIs are Storage locators, not fetchable URLs — resolve first.
                    const [{ getDownloadURL, ref }, { storage }] = await Promise.all([
                        import('firebase/storage'),
                        import('@/services/firebase'),
                    ]);
                    const bucketPath = url.split('/').slice(3).join('/');
                    fetchableUrl = await getDownloadURL(ref(storage, bucketPath));
                    if (cancelled) return;
                }
                const { safeStorageFetch } = await import('@/services/storage/safeStorageFetch');
                const { blob } = await safeStorageFetch(fetchableUrl);
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
