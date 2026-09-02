import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import type { FirestoreError } from 'firebase/firestore';
import { useStore } from '@/core/store';
import { useShallow } from 'zustand/react/shallow';
import { trackLibrary } from '@/services/metadata/TrackLibraryService';
import type { ExtendedGoldenMetadata } from '@/services/metadata/types';
import { safeUnsubscribe } from '@/utils/safeUnsubscribe';
import { logger } from '@/utils/logger';

export interface ClientTrackRecord extends ExtendedGoldenMetadata {
    _hasPendingWrites?: boolean;
    _isFromCache?: boolean;
    updatedAt?: { toMillis?: () => number; toDate?: () => Date } | string | number | null;
    createdAt?: { toMillis?: () => number; toDate?: () => Date } | string | number | null;
}

export interface UseTrackLibraryOptions {
    searchQuery?: string;
    genreFilter?: string;
    goldenOnly?: boolean;
    sortBy?: 'title' | 'date' | 'duration';
    sortDirection?: 'asc' | 'desc';
}

const EMPTY_TRACKS: ClientTrackRecord[] = [];

export function useTrackLibrary(options: UseTrackLibraryOptions = {}) {
    const { searchQuery = '', genreFilter = 'all', goldenOnly = false, sortBy = 'date', sortDirection = 'desc' } = options;

    const { user } = useStore(useShallow(state => ({
        user: state.user,
    })));

    const [tracks, setTracks] = useState<ClientTrackRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<FirestoreError | Error | null>(null);
    const [hasPendingSync, setHasPendingSync] = useState(false);

    // Mounted lifecycle guard to prevent state updates on unmounted components
    const isMountedRef = useRef(true);
    useEffect(() => {
        isMountedRef.current = true;
        return () => { isMountedRef.current = false; };
    }, []);

    useEffect(() => {
        if (!user?.uid) {
            return;
        }

        const unsubscribe = trackLibrary.subscribeTracks(
            (updatedTracks) => {
                if (!isMountedRef.current) return;

                setTracks(updatedTracks);
                setLoading(false);
                setHasPendingSync(updatedTracks.some(t => t._hasPendingWrites));
            },
            (err: FirestoreError) => {
                if (!isMountedRef.current) return;
                logger.error('[useTrackLibrary] Snapshot error:', err);
                setError(err);
                setLoading(false);
            }
        );

        return () => {
            safeUnsubscribe(unsubscribe);
        };
    }, [user?.uid]);

    const isAvailable = Boolean(user?.uid);
    const effectiveTracks = isAvailable ? tracks : EMPTY_TRACKS;
    const effectiveLoading = isAvailable ? loading : false;
    const effectiveError = isAvailable ? error : null;
    const effectivePendingSync = isAvailable ? hasPendingSync : false;

    // Filter & Sort
    const filteredTracks = useMemo(() => {
        let result = [...effectiveTracks];

        if (searchQuery.trim()) {
            const queryLower = searchQuery.toLowerCase();
            result = result.filter(t =>
                t.trackTitle?.toLowerCase().includes(queryLower) ||
                t.artistName?.toLowerCase().includes(queryLower) ||
                t.isrc?.toLowerCase().includes(queryLower)
            );
        }

        if (genreFilter && genreFilter !== 'all') {
            result = result.filter(t => t.genre?.toLowerCase() === genreFilter.toLowerCase());
        }

        if (goldenOnly) {
            result = result.filter(t => t.isGolden);
        }

        result.sort((a, b) => {
            if (sortBy === 'title') {
                const titleA = a.trackTitle || '';
                const titleB = b.trackTitle || '';
                const comp = titleA.localeCompare(titleB);
                return sortDirection === 'asc' ? comp : -comp;
            }
            if (sortBy === 'duration') {
                const durA = a.durationSeconds || 0;
                const durB = b.durationSeconds || 0;
                return sortDirection === 'asc' ? durA - durB : durB - durA;
            }
            // Default sort by updatedAt / date
            const getTimestamp = (rec: ClientTrackRecord) => {
                const ts = rec.updatedAt;
                if (!ts) return 0;
                if (typeof ts === 'object' && 'toMillis' in ts && typeof ts.toMillis === 'function') return ts.toMillis();
                if (typeof ts === 'object' && 'toDate' in ts && typeof ts.toDate === 'function') return ts.toDate().getTime();
                if (typeof ts === 'string' || typeof ts === 'number') return new Date(ts).getTime();
                return 0;
            };
            const timeA = getTimestamp(a);
            const timeB = getTimestamp(b);
            return sortDirection === 'asc' ? timeA - timeB : timeB - timeA;
        });

        return result;
    }, [effectiveTracks, searchQuery, genreFilter, goldenOnly, sortBy, sortDirection]);

    const deleteTrack = useCallback(async (fingerprint: string) => {
        try {
            await trackLibrary.deleteTrack(fingerprint);
        } catch (err: unknown) {
            logger.error('[useTrackLibrary] Failed to delete track:', err);
            throw err;
        }
    }, []);

    const saveTrack = useCallback(async (metadata: ExtendedGoldenMetadata) => {
        try {
            await trackLibrary.saveTrack(metadata);
        } catch (err: unknown) {
            logger.error('[useTrackLibrary] Failed to save track:', err);
            throw err;
        }
    }, []);

    return useMemo(() => ({
        tracks: filteredTracks,
        rawTracks: effectiveTracks,
        loading: effectiveLoading,
        error: effectiveError,
        hasPendingSync: effectivePendingSync,
        deleteTrack,
        saveTrack,
    }), [filteredTracks, effectiveTracks, effectiveLoading, effectiveError, effectivePendingSync, deleteTrack, saveTrack]);
}
