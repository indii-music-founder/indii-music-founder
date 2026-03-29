import { collection, query, where, getDocs, orderBy, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { db } from '@/services/firebase';
import type { DDEXReleaseRecord } from '@/services/metadata/types';
import type { DashboardRelease, ReleaseStatus } from '@/services/distribution/types/distributor';
import { logger } from '@/utils/logger';

export class DistributionSyncService {
    /**
     * Maps Firestore DDEXReleaseRecord to DashboardRelease format
     */
    private static mapRelease(docId: string, data: DDEXReleaseRecord): DashboardRelease {
        const deployments: Record<string, { status: ReleaseStatus; error?: string }> = {};

        if (data.distributors) {
            data.distributors.forEach(dist => {
                deployments[dist.distributorId] = {
                    status: dist.status as ReleaseStatus,
                    error: dist.error
                };
            });
        }

        // Extract semantic properties for audio DNA badging
        const rawMoods = data.metadata.mood || [];
        const primaryMood = rawMoods.length > 0 ? rawMoods[0] : undefined;
        let vocalPresence: string | undefined;
        if (data.metadata.isInstrumental === true) vocalPresence = 'Instrumental';
        else if (data.metadata.isInstrumental === false) vocalPresence = 'Vocal';

        return {
            id: docId,
            title: data.metadata.releaseTitle || data.metadata.trackTitle,
            artist: data.metadata.artistName,
            coverArtUrl: data.assets?.coverArtUrl,
            releaseDate: data.metadata.releaseDate,
            deployments,
            // Semantic metadata fields
            genre: data.metadata.genre,
            subGenre: data.metadata.subGenre,
            primaryMood,
            vocalPresence,
            marketingComment: data.metadata.marketingComment
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
        const q = query(
            collection(db, 'ddexReleases'),
            where('orgId', '==', orgId),
            orderBy('createdAt', 'desc')
        );

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
        try {
            const q = query(
                collection(db, 'ddexReleases'),
                where('orgId', '==', orgId),
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
            const docRef = doc(db, 'ddexReleases', releaseId);
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
