import { useEffect, useState } from 'react';
import { logger } from '@/utils/logger';

export type SafeMediaUrlState =
    | { status: 'idle' | 'loading'; url: null; error: null }
    | { status: 'ready'; url: string; error: null }
    | { status: 'failed'; url: null; error: Error };

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
export function useSafeMediaUrl(url: string | null | undefined): SafeMediaUrlState {
    const [state, setState] = useState<SafeMediaUrlState>({ status: 'idle', url: null, error: null });

    useEffect(() => {
        let cancelled = false;
        let objectUrl: string | null = null;
        setState(url
            ? { status: 'loading', url: null, error: null }
            : { status: 'idle', url: null, error: null });

        if (!url) return;

        if (url.startsWith('blob:') || url.startsWith('data:')) {
            setState({ status: 'ready', url, error: null });
            return;
        }

        const isGsUri = url.startsWith('gs://');
        if (!isGsUri && !/^https?:\/\//i.test(url)) {
            // Unknown scheme (e.g. placeholder: sentinels) — <img> can't render it.
            // Return null so callers show their fallback instead of broken alt text.
            setState({
                status: 'failed',
                url: null,
                error: new Error(`Unsupported media URL scheme: ${url}`),
            });
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
                setState({ status: 'ready', url: objectUrl, error: null });
            } catch (error) {
                logger.warn('[useSafeImageUrl] Failed to resolve image URL', error);
                if (!cancelled) {
                    setState({
                        status: 'failed',
                        url: null,
                        error: error instanceof Error ? error : new Error(String(error)),
                    });
                }
            }
        })();

        return () => {
            cancelled = true;
            if (objectUrl) URL.revokeObjectURL(objectUrl);
        };
    }, [url]);

    return state;
}

export function useSafeImageUrl(url: string | null | undefined): string | null {
    return useSafeMediaUrl(url).url;
}
