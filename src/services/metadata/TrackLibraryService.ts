import { FirestoreService } from '@/services/FirestoreService';
import { ExtendedGoldenMetadata } from './types';
import { where } from 'firebase/firestore';

export class TrackLibraryService extends FirestoreService<ExtendedGoldenMetadata> {
    constructor() {
        super('tracks');
    }

    /**
     * Retrieves track metadata by its audio fingerprint (Master ID).
     */
    async getByFingerprint(fingerprint: string): Promise<ExtendedGoldenMetadata | null> {
        const results = await this.query([
            where('masterFingerprint', '==', fingerprint)
        ]);

        return results.length > 0 ? results[0] : null;
    }

    /**
     * Saves or updates track metadata.
     * Uses fingerprint as the document ID to ensure uniqueness.
     */
    async saveTrack(metadata: ExtendedGoldenMetadata): Promise<void> {
        if (!metadata.masterFingerprint) {
            throw new Error('Cannot save track without a master fingerprint');
        }

        // Use fingerprint as Doc ID for direct lookup
        await this.set(metadata.masterFingerprint, metadata);
    }
}

export const trackLibrary = new TrackLibraryService();
