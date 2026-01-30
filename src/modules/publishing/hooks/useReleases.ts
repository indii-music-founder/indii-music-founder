import { useState, useEffect, useMemo, useCallback } from 'react';
import * as Sentry from '@sentry/react';
import { collection, query, where, onSnapshot, orderBy, deleteDoc, doc, updateDoc, FirestoreError } from 'firebase/firestore';
import { db } from '@/services/firebase';
import type { DDEXReleaseRecord } from '@/services/metadata/types';

export interface ClientReleaseRecord extends DDEXReleaseRecord {
    _hasPendingWrites?: boolean;
    _isFromCache?: boolean;
}

export function useReleases(orgId: string | undefined) {
    const [releases, setReleases] = useState<ClientReleaseRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);
    const [hasPendingSync, setHasPendingSync] = useState(false);

    useEffect(() => {
        if (!orgId) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            if (releases.length > 0) setReleases([]);
            // eslint-disable-next-line react-hooks/set-state-in-effect
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
                console.error('Error fetching releases:', err);
                Sentry.captureException(err);
                setError(err);
                setLoading(false);
            }
        );

        return () => {
            unsubscribe();
        };
    }, [orgId]);

    const deleteRelease = useCallback(async (releaseId: string) => {
        try {
            const releaseRef = doc(db, 'ddexReleases', releaseId);
            await deleteDoc(releaseRef);
        } catch (err) {
            console.error('Error deleting release:', err);
            Sentry.captureException(err);
            throw err;
        }
    }, []);

    const archiveRelease = useCallback(async (releaseId: string) => {
        try {
            const releaseRef = doc(db, 'ddexReleases', releaseId);
            await updateDoc(releaseRef, { status: 'archived' });
        } catch (err) {
            console.error('Error archiving release:', err);
            Sentry.captureException(err);
            throw err;
        }
    }, []);

    return useMemo(() => ({ releases, loading, error, hasPendingSync, deleteRelease, archiveRelease }), [releases, loading, error, hasPendingSync, deleteRelease, archiveRelease]);
}
