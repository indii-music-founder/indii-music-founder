import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import * as Sentry from '@sentry/react';
import { collection, query, onSnapshot, orderBy, deleteDoc, doc, updateDoc, FirestoreError, type DocumentData } from 'firebase/firestore';
import { db } from '@/services/firebase';
import { safeUnsubscribe } from '@/utils/safeUnsubscribe';
import type { DDEXReleaseRecord } from '@/services/metadata/types';
import { logger } from '@/utils/logger';
import { getReleaseArtist, getReleaseTitle } from '@/services/distribution/ReleaseCatalogService';
import { releaseWorkspaceFilter, type ReleaseWorkspace } from '@/services/distribution/releaseWorkspace';

export interface ClientReleaseRecord extends DDEXReleaseRecord {
    _hasPendingWrites?: boolean;
    _isFromCache?: boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return !!value && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Older release records (the pre-ISSUE-1692 Submit Release form, agent-staged
 * releases) have no `metadata` / `assets` maps. Publishing reads
 * `release.metadata.*` throughout, so give every record those shapes here,
 * taking title and artist from the top-level fields when that is all there is.
 */
export function normalizeReleaseRecord(id: string, data: DocumentData): Omit<ClientReleaseRecord, '_hasPendingWrites' | '_isFromCache'> {
    const metadata = isRecord(data.metadata)
        ? data.metadata
        : {
            ...(getReleaseTitle(data) ? { trackTitle: getReleaseTitle(data) } : {}),
            ...(getReleaseArtist(data) ? { artistName: getReleaseArtist(data) } : {}),
        };
    return {
        ...data,
        id,
        metadata,
        assets: isRecord(data.assets) ? data.assets : {},
        distributors: Array.isArray(data.distributors) ? data.distributors : [],
    } as unknown as Omit<ClientReleaseRecord, '_hasPendingWrites' | '_isFromCache'>;
}

/**
 * Live releases for one workspace. Personal workspaces are read by `userId`
 * and organizations by `orgId` (ISSUE-1695): an `orgId` query on the
 * personal placeholder is rejected by the rules as a whole.
 */
export function useReleases(workspace: ReleaseWorkspace | null) {
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

    const workspaceKey = workspace ? `${workspace.kind}:${workspace.orgId}:${workspace.userId}` : '';

    useEffect(() => {
        if (!workspace) {
            if (releases.length > 0) setReleases([]);

            if (loading) setLoading(false);
            return;
        }

        setLoading(true);
        setError(null);

        const q = query(
            collection(db, 'proprietaryIngestionReleases'),
            releaseWorkspaceFilter(workspace),
            orderBy('createdAt', 'desc')
        );

        const unsubscribe = onSnapshot(q, { includeMetadataChanges: true },
            (snapshot) => {
                if (!isMountedRef.current) return;
                const releaseData: ClientReleaseRecord[] = snapshot.docs.map(doc => ({
                    ...normalizeReleaseRecord(doc.id, doc.data()),
                    _hasPendingWrites: doc.metadata.hasPendingWrites,
                    _isFromCache: doc.metadata.fromCache
                }));

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
        // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on workspaceKey (the workspace object is rebuilt each render); loading and releases are mutated inside
    }, [workspaceKey]);

    const deleteRelease = useCallback(async (releaseId: string) => {
        try {
            const releaseRef = doc(db, 'proprietaryIngestionReleases', releaseId);
            await deleteDoc(releaseRef);
        } catch (err: unknown) {
            logger.error('Error deleting release:', err);
            Sentry.captureException(err);
            throw err;
        }
    }, []);

    const archiveRelease = useCallback(async (releaseId: string) => {
        try {
            const releaseRef = doc(db, 'proprietaryIngestionReleases', releaseId);
            await updateDoc(releaseRef, { status: 'archived' });
        } catch (err: unknown) {
            logger.error('Error archiving release:', err);
            Sentry.captureException(err);
            throw err;
        }
    }, []);

    return useMemo(() => ({ releases, loading, error, hasPendingSync, deleteRelease, archiveRelease }), [releases, loading, error, hasPendingSync, deleteRelease, archiveRelease]);
}
