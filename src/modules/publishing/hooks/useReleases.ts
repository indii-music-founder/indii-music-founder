import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import * as Sentry from '@sentry/react';
import { collection, query, where, onSnapshot, orderBy, deleteDoc, doc, updateDoc, FirestoreError } from 'firebase/firestore';
import { db } from '@/services/firebase';
import { safeUnsubscribe } from '@/utils/safeUnsubscribe';
import type { DDEXReleaseRecord } from '@/services/metadata/types';
import { logger } from '@/utils/logger';

export interface ClientReleaseRecord extends DDEXReleaseRecord {
    _hasPendingWrites?: boolean;
    _isFromCache?: boolean;
}

export function useReleases(orgId: string | undefined) {
    const [releases, setReleases] = useState<ClientReleaseRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);
    const [hasPendingSync, setHasPendingSync] = useState(false);

    // Mounted guard to prevent state updates on unmounted component (Firestore b815 crash fix)
    const isMountedRef = useRef(true);
    useEffect(() => {
        isMountedRef.current = true;
        return () => { isMountedRef.current = false; };
    }, []);

    useEffect(() => {
        if (!orgId) {
            if (releases.length > 0) setReleases([]);

            if (loading) setLoading(false);
            return;
        }

        setLoading(true);

        const q = query(
            collection(db, 'ddexReleases'),
            where('orgId', '==', orgId),
            orderBy('createdAt', 'desc')
        );

        const unsubscribe = onSnapshot(q, { includeMetadataChanges: true },
            (snapshot) => {
                if (!isMountedRef.current) return;
                const releaseData = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data(),
                    _hasPendingWrites: doc.metadata.hasPendingWrites,
                    _isFromCache: doc.metadata.fromCache
                })) as unknown as ClientReleaseRecord[];

                setReleases(releaseData);
                setLoading(false);
                setHasPendingSync(snapshot.metadata.hasPendingWrites);
            },
            (err: FirestoreError) => {
                logger.error('Error fetching releases:', err);
                Sentry.captureException(err);
                setError(err);
                setLoading(false);
            }
        );

        return () => {
            safeUnsubscribe(unsubscribe);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps -- loading and releases are mutated inside; adding them causes infinite loops
    }, [orgId]);

    const deleteRelease = useCallback(async (releaseId: string) => {
        try {
            const releaseRef = doc(db, 'ddexReleases', releaseId);
            await deleteDoc(releaseRef);
        } catch (err) {
            logger.error('Error deleting release:', err);
            Sentry.captureException(err);
            throw err;
        }
    }, []);

    const archiveRelease = useCallback(async (releaseId: string) => {
        try {
            const releaseRef = doc(db, 'ddexReleases', releaseId);
            await updateDoc(releaseRef, { status: 'archived' });
        } catch (err) {
            logger.error('Error archiving release:', err);
            Sentry.captureException(err);
            throw err;
        }
    }, []);

    return useMemo(() => ({ releases, loading, error, hasPendingSync, deleteRelease, archiveRelease }), [releases, loading, error, hasPendingSync, deleteRelease, archiveRelease]);
}
