import { useEffect, useState } from 'react';
import { resolveStorageUrl } from '@/services/storage/resolveStorageUrl';

interface ResolvedStorageUrlState {
    url: string;
    isResolving: boolean;
    error: string | null;
}

export function useResolvedStorageUrl(uri?: string | null): ResolvedStorageUrlState {
    const [resolvedState, setResolvedState] = useState<{ uri: string | null; url: string; error: string | null }>({
        uri: null,
        url: '',
        error: null
    });

    useEffect(() => {
        if (!uri) {
            return;
        }

        if (!uri.startsWith('gs://')) {
            return;
        }

        let cancelled = false;

        void resolveStorageUrl(uri).then((resolved) => {
            if (cancelled) return;

            if (resolved.startsWith('gs://')) {
                setResolvedState({
                    uri,
                    url: '',
                    error: 'Unable to resolve the storage asset for playback.'
                });
                return;
            }

            setResolvedState({ uri, url: resolved, error: null });
        });

        return () => {
            cancelled = true;
        };
    }, [uri]);

    if (!uri) {
        return { url: '', isResolving: false, error: null };
    }

    if (!uri.startsWith('gs://')) {
        return { url: uri, isResolving: false, error: null };
    }

    const isCurrentRequest = resolvedState.uri === uri;
    const isResolving = !isCurrentRequest;

    return {
        url: isCurrentRequest ? resolvedState.url : '',
        isResolving,
        error: isCurrentRequest ? resolvedState.error : null
    };
}
