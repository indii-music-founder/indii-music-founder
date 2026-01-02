import { collection, query, where, getDocs, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '@/services/firebase';
import type { DDEXReleaseRecord } from '@/services/metadata/types';
import type { DashboardRelease, ReleaseStatus } from '@/services/distribution/types/distributor';

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

        return {
            id: docId,
            title: data.metadata.releaseTitle || data.metadata.trackTitle,
            artist: data.metadata.artistName,
            coverArtUrl: data.assets?.coverArtUrl,
            releaseDate: data.metadata.releaseDate,
            deployments
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
            console.error('Error subscribing to releases:', error);
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
        } catch (error) {
            console.error('Error fetching releases from Firestore:', error);
            throw error;
        }
    }
}
