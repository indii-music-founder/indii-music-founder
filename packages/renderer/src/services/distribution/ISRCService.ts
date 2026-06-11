import { getFirestore, collection, getDocs, query, where, limit, Timestamp } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { app, auth, functions } from '@/services/firebase';
import { logger } from '@/utils/logger';
import type { ISRCRecordDocument } from '@/types/firestore';
import { isFirebaseE2EMockEnabled } from '@/utils/e2eMode';

export interface ISRCRecord {
    id?: string;
    isrc: string;
    status: 'available' | 'assigned' | 'reserved';
    assignedTo?: string; // Release ID or Track ID
    assignedAt?: Timestamp;
}

export class ISRCService {
    private db = getFirestore(app);
    private registryRef = collection(this.db, 'isrc_registry');

    /**
     * Assigns the next available ISRC from the pool to a track.
     * Uses a transaction to prevent double-assignment.
     */
    async assignNextISRC(trackId: string): Promise<string> {
        if (isFirebaseE2EMockEnabled()) {
            return 'US-E2E-25-00001';
        }

        try {
            const assign = httpsCallable(functions, 'assignDistributionIdentifier');
            const result = await assign({
                type: 'isrc',
                assignedTo: trackId,
            });
            const data = result.data as { isrc?: string };
            if (!data.isrc) {
                throw new Error('ISRC assignment did not return a code.');
            }

            logger.info(`[ISRC] Assigned ${data.isrc} to track ${trackId}`);
            return data.isrc;
        } catch (error: unknown) {
            logger.error('[ISRC] Assignment failed:', error);
            throw error;
        }
    }

    /**
     * Seed the pool with a range of ISRCs (for testing / initial setup).
     * Format: US-AAA-26-00001
     */
    async seedPool(registrantCode: string, startNumber: number, count: number): Promise<void> {
        void registrantCode;
        void startNumber;
        void count;
        throw new Error('ISRC pool seeding is a backend/admin operation.');
    }

    /** Record a new ISRC assignment in the registry. Returns the new document ID. */
    async recordAssignment(data: Omit<ISRCRecordDocument, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
        const record = httpsCallable(functions, 'recordDistributionIdentifier');
        const result = await record({
            type: 'isrc',
            isrc: data.isrc,
            releaseId: data.releaseId,
            trackTitle: data.trackTitle,
            artistName: data.artistName,
            metadataSnapshot: data.metadataSnapshot,
        });
        const response = result.data as { id?: string };
        if (!response.id) {
            throw new Error('ISRC registry write did not return a document id.');
        }
        logger.info(`[ISRC] Recorded assignment for ${data.isrc}`);
        return response.id;
    }

    /** Look up a single registry record by ISRC string. Returns null if not found. */
    async getByIsrc(isrc: string): Promise<ISRCRecordDocument | null> {
        const q = query(this.registryRef, where('isrc', '==', isrc), limit(1));
        const snap = await getDocs(q);
        if (snap.empty) return null;
        return { id: snap.docs[0]!.id, ...snap.docs[0]!.data() } as unknown as ISRCRecordDocument;
    }

    /** Look up all registry records for a given release. */
    async getByRelease(releaseId: string): Promise<ISRCRecordDocument[]> {
        const q = query(this.registryRef, where('releaseId', '==', releaseId));
        const snap = await getDocs(q);
        return snap.docs.map(d => ({ id: d.id, ...d.data() } as unknown as ISRCRecordDocument));
    }

    /** Get all registry entries belonging to the currently authenticated user. */
    async getUserCatalog(): Promise<ISRCRecordDocument[]> {
        const userId = auth.currentUser?.uid;
        if (!userId) return [];
        const q = query(this.registryRef, where('userId', '==', userId));
        const snap = await getDocs(q);
        return snap.docs.map(d => ({ id: d.id, ...d.data() } as unknown as ISRCRecordDocument));
    }
}

export const isrcService = new ISRCService();
