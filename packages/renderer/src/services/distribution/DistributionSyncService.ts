import { collection, query, where, getDocs, orderBy, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { db, auth } from '@/services/firebase';
import type { DDEXReleaseRecord } from '@/services/metadata/types';
import type { DashboardRelease, ReleaseStatus } from '@/services/distribution/types/distributor';
import { logger } from '@/utils/logger';
import { isFirebaseE2EMockEnabled } from '@/utils/e2eMode';

export class DistributionSyncService {
    /**
     * Maps Firestore DDEXReleaseRecord to DashboardRelease format
     */
    private static mapRelease(docId: string, data: DDEXReleaseRecord): DashboardRelease {
        const deployments: Record<string, { status: ReleaseStatus; error?: string }> = {};

        if (Array.isArray(data.distributors)) {
            data.distributors.forEach(dist => {
                deployments[dist.distributorId] = {
                    status: dist.status as ReleaseStatus,
                    error: dist.error
                };
            });
        }

        // ISSUE-1692: older Submit Release and agent-staged records carry only
        // top-level fields and no `metadata` map. One such record must not
        // break the whole catalogue listener, so read metadata defensively.
        const metadata: Partial<DDEXReleaseRecord['metadata']> = data.metadata ?? {};
        const legacy = data as Partial<Record<'title' | 'artist', unknown>>;
        const legacyTitle = typeof legacy.title === 'string' ? legacy.title : undefined;
        const legacyArtist = typeof legacy.artist === 'string' ? legacy.artist : undefined;

        // Extract semantic properties for audio DNA badging
        const rawMoods = Array.isArray(metadata.mood) ? metadata.mood : [];
        const primaryMood = rawMoods.length > 0 ? rawMoods[0] : undefined;
        let vocalPresence: string | undefined;
        if (metadata.isInstrumental === true) vocalPresence = 'Instrumental';
        else if (metadata.isInstrumental === false) vocalPresence = 'Vocal';

        return {
            id: docId,
            title: metadata.releaseTitle || metadata.trackTitle || legacyTitle || 'Untitled release',
            artist: metadata.artistName || legacyArtist || '',
            coverArtUrl: data.assets?.coverArtUrl,
            releaseDate: metadata.releaseDate,
            deployments,
            // Semantic metadata fields
            genre: metadata.genre,
            subGenre: metadata.subGenre,
            primaryMood,
            vocalPresence,
            marketingComment: metadata.marketingComment
        };
    }

    /**
     * Subscribes to releases from Firestore for real-time updates
     */
    static subscribeToReleases(
        orgId: string,
        onUpdate: (releases: DashboardRelease[]) => void,
        onError?: (error: Error) => void
    ): () => void {
        const userId = auth.currentUser?.uid;
        if (!userId) return () => {};

        // If the orgId is 'org-default', it is the user's personal workspace.
        // We query by userId. We must also constrain orgId to null to prevent Firestore rules evaluation failure on `isOrgMember(resource.data.orgId)`.
        const q = orgId && orgId !== 'org-default'
            ? query(
                collection(db, 'proprietaryIngestionReleases'),
                where('orgId', '==', orgId),
                orderBy('createdAt', 'desc')
            )
            : query(
                collection(db, 'proprietaryIngestionReleases'),
                where('userId', '==', userId),
                orderBy('createdAt', 'desc')
            );

        // E2E Mock Bypass: skip real Firestore listeners
        if (isFirebaseE2EMockEnabled()) {
            setTimeout(() => onUpdate([]), 0);
            return () => { };
        }

        return onSnapshot(q, (snapshot) => {
            const releases = snapshot.docs.map(doc =>
                this.mapRelease(doc.id, doc.data() as DDEXReleaseRecord)
            );
            onUpdate(releases);
        }, (error) => {
            logger.error('Error subscribing to releases:', error);
            if (onError) onError(error);
        });
    }

    /**
     * Fetches releases from Firestore and maps them to DashboardRelease format (One-time fetch)
     */
    static async fetchReleases(orgId: string): Promise<DashboardRelease[]> {
        // E2E Mock Bypass: skip real Firestore fetches
        if (isFirebaseE2EMockEnabled()) {
            return [];
        }

        try {
            const userId = auth.currentUser?.uid;
            if (!userId && orgId === 'org-default') return [];

            const q = orgId && orgId !== 'org-default'
                ? query(
                    collection(db, 'proprietaryIngestionReleases'),
                    where('orgId', '==', orgId),
                    orderBy('createdAt', 'desc')
                )
                : query(
                    collection(db, 'proprietaryIngestionReleases'),
                    where('userId', '==', userId),
                    orderBy('createdAt', 'desc')
                );

            const snapshot = await getDocs(q);
            return snapshot.docs.map(doc =>
                this.mapRelease(doc.id, doc.data() as DDEXReleaseRecord)
            );
        } catch (error: unknown) {
            logger.error('Error fetching releases from Firestore:', error);
            throw error;
        }
    }

    /**
     * Fetches a single full release record by ID
     */
    static async getRelease(releaseId: string): Promise<DDEXReleaseRecord | null> {
        try {
            const docRef = doc(db, 'proprietaryIngestionReleases', releaseId);
            const snapshot = await getDoc(docRef);
            if (snapshot.exists()) {
                const data = snapshot.data() as DDEXReleaseRecord;
                return { ...data, id: snapshot.id };
            }
            return null;
        } catch (error: unknown) {
            logger.error('Error fetching release:', error);
            throw error;
        }
    }
}
