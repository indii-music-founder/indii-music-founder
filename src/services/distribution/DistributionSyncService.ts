import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '@/services/firebase';
import type { DDEXReleaseRecord } from '@/services/metadata/types';
import type { DashboardRelease, ReleaseStatus } from '@/services/distribution/types/distributor';

export class DistributionSyncService {
    /**
     * Fetches releases from Firestore and maps them to DashboardRelease format
     */
    static async fetchReleases(orgId: string): Promise<DashboardRelease[]> {
        try {
            const q = query(
                collection(db, 'ddexReleases'),
                where('orgId', '==', orgId),
                orderBy('createdAt', 'desc')
            );

            const snapshot = await getDocs(q);

            return snapshot.docs.map(doc => {
                const data = doc.data() as DDEXReleaseRecord;

                // Map distributors array to deployments record
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
                    id: doc.id,
                    title: data.metadata.releaseTitle || data.metadata.trackTitle,
                    artist: data.metadata.artistName,
                    coverArtUrl: data.assets?.coverArtUrl,
                    releaseDate: data.metadata.releaseDate,
                    deployments
                };
            });
        } catch (error) {
            console.error('Error fetching releases from Firestore:', error);
            throw error;
        }
    }
}
