import { FirestoreService } from '@/services/FirestoreService';
import { ISRCRecordDocument } from '@/types/firestore';
import { auth } from '@/services/firebase';

class ISRCService extends FirestoreService<ISRCRecordDocument> {
    constructor() {
        super('isrc_registry');
    }

    /**
     * Get ISRC record by ISRC string
     */
    async getByIsrc(isrc: string): Promise<ISRCRecordDocument | null> {
        const results = await this.list([this.where('isrc', '==', isrc)]);
        return results.length > 0 ? results[0] : null;
    }

    /**
     * Get all ISRC records assigned for a specific release
     */
    async getByRelease(releaseId: string): Promise<ISRCRecordDocument[]> {
        return this.list([this.where('releaseId', '==', releaseId)]);
    }

    /**
     * Get all ISRC records for the current user
     */
    async getUserCatalog(): Promise<ISRCRecordDocument[]> {
        const userId = auth.currentUser?.uid;
        if (!userId) return [];
        return this.list([
            this.where('userId', '==', userId),
            this.orderBy('assignedAt', 'desc')
        ]);
    }

    /**
     * Record a new ISRC assignment
     */
    async recordAssignment(data: Omit<ISRCRecordDocument, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
        return this.add(data);
    }
}

export const isrcService = new ISRCService();
