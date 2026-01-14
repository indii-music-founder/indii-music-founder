import { useState, useEffect, useMemo, useCallback } from 'react';
import * as Sentry from '@sentry/react';
import { collection, query, where, onSnapshot, orderBy, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { db } from '@/services/firebase';
import type { DDEXReleaseRecord } from '@/services/metadata/types';

export function useReleases(orgId: string | undefined) {
    const [releases, setReleases] = useState<DDEXReleaseRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    const [prevOrgId, setPrevOrgId] = useState(orgId);
    if (orgId !== prevOrgId) {
        setPrevOrgId(orgId);
        setReleases([]);
        setLoading(!!orgId);
    }

    useEffect(() => {
        if (!orgId) return;

        // Fetching is initiated implicitly via the loading state and subscription below
        // we don't need a separate setLoading(true) here as it's handled above during render


        const q = query(
            collection(db, 'ddexReleases'),
            where('orgId', '==', orgId),
            orderBy('createdAt', 'desc')
        );

        const unsubscribe = onSnapshot(q,
            (snapshot) => {
                const releaseData = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                })) as DDEXReleaseRecord[];
                setReleases(releaseData);
                setLoading(false);
            },
            (err) => {
                console.error('Error fetching releases:', err);
                Sentry.captureException(err);
                setError(err as Error);
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

    return useMemo(() => ({ releases, loading, error, deleteRelease, archiveRelease }), [releases, loading, error, deleteRelease, archiveRelease]);
}
