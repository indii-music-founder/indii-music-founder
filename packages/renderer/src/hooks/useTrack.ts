import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import type { FirestoreError } from 'firebase/firestore';
import { useStore } from '@/core/store';
import { useShallow } from 'zustand/react/shallow';
import { trackLibrary } from '@/services/metadata/TrackLibraryService';
import type { ExtendedGoldenMetadata } from '@/services/metadata/types';
import { safeUnsubscribe } from '@/utils/safeUnsubscribe';
import { logger } from '@/utils/logger';
import type { ClientTrackRecord } from './useTrackLibrary';

export function useTrack(fingerprint: string | undefined | null) {
    const { user } = useStore(useShallow(state => ({
        user: state.user,
    })));

    const [track, setTrack] = useState<ClientTrackRecord | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<FirestoreError | Error | null>(null);

    const isMountedRef = useRef(true);
    useEffect(() => {
        isMountedRef.current = true;
        return () => { isMountedRef.current = false; };
    }, []);

    useEffect(() => {
        if (!user?.uid || !fingerprint) {
            return;
        }

        const unsubscribe = trackLibrary.subscribeTrack(
            fingerprint,
            (trackDoc) => {
                if (!isMountedRef.current) return;
                setTrack(trackDoc);
                setLoading(false);
            },
            (err: FirestoreError) => {
                if (!isMountedRef.current) return;
                logger.error(`[useTrack] Snapshot error for ${fingerprint}:`, err);
                setError(err);
                setLoading(false);
            }
        );

        return () => {
            safeUnsubscribe(unsubscribe);
        };
    }, [user?.uid, fingerprint]);

    const isAvailable = Boolean(user?.uid && fingerprint);
    const effectiveTrack = isAvailable ? track : null;
    const effectiveLoading = isAvailable ? loading : false;
    const effectiveError = isAvailable ? error : null;

    const updateTrack = useCallback(async (updates: Partial<ExtendedGoldenMetadata>) => {
        if (!effectiveTrack) throw new Error('Cannot update track: track not loaded');
        const updated = { ...effectiveTrack, ...updates } as ExtendedGoldenMetadata;
        await trackLibrary.saveTrack(updated);
    }, [effectiveTrack]);

    return useMemo(() => ({
        track: effectiveTrack,
        loading: effectiveLoading,
        error: effectiveError,
        hasPendingSync: effectiveTrack?._hasPendingWrites ?? false,
        isFromCache: effectiveTrack?._isFromCache ?? false,
        updateTrack,
    }), [effectiveTrack, effectiveLoading, effectiveError, updateTrack]);
}
