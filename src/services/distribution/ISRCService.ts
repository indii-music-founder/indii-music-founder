import { getFirestore, collection, addDoc, getDocs, query, where, limit, updateDoc, doc, runTransaction, Timestamp } from 'firebase/firestore';
import { app, auth } from '@/services/firebase';
import { logger } from '@/utils/logger';
import type { ISRCRecordDocument } from '@/types/firestore';

export interface ISRCRecord {
    id?: string;
    isrc: string;
    status: 'available' | 'assigned' | 'reserved';
    assignedTo?: string; // Release ID or Track ID
    assignedAt?: any;
}

export class ISRCService {
    private db = getFirestore(app);
    private poolRef = collection(this.db, 'isrc_pool');
    private registryRef = collection(this.db, 'isrc_registry');

    /**
     * Assigns the next available ISRC from the pool to a track.
     * Uses a transaction to prevent double-assignment.
     */
    async assignNextISRC(trackId: string): Promise<string> {
        try {
            return await runTransaction(this.db, async (transaction) => {
                const q = query(this.poolRef, where('status', '==', 'available'), limit(1));
                const snapshot = await getDocs(q);

                if (snapshot.empty) {
                    throw new Error('ISRC pool is exhausted. Please ingestion more codes.');
                }

                const isrcDoc = snapshot.docs[0];
                const isrcData = isrcDoc.data() as ISRCRecord;

                transaction.update(isrcDoc.ref, {
                    status: 'assigned',
                    assignedTo: trackId,
                    assignedAt: new Date()
                });

                logger.info(`[ISRC] Assigned ${isrcData.isrc} to track ${trackId}`);
                return isrcData.isrc;
            });
        } catch (error) {
            logger.error('[ISRC] Assignment failed:', error);
            throw error;
        }
    }

    /**
     * Seed the pool with a range of ISRCs (for testing / initial setup).
     * Format: US-AAA-26-00001
     */
    async seedPool(registrantCode: string, startNumber: number, count: number): Promise<void> {
        const year = new Date().getFullYear().toString().slice(-2);

        for (let i = 0; i < count; i++) {
            const sequence = (startNumber + i).toString().padStart(5, '0');
            const isrc = `US-${registrantCode}-${year}-${sequence}`;

            await addDoc(this.poolRef, {
                isrc,
                status: 'available'
            });
        }
        logger.info(`[ISRC] Seeded ${count} ISRCs into the pool.`);
    }

    /** Record a new ISRC assignment in the registry. Returns the new document ID. */
    async recordAssignment(data: Omit<ISRCRecordDocument, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
        const docRef = await addDoc(this.registryRef, data);
        logger.info(`[ISRC] Recorded assignment for ${data.isrc}`);
        return docRef.id;
    }

    /** Look up a single registry record by ISRC string. Returns null if not found. */
    async getByIsrc(isrc: string): Promise<ISRCRecordDocument | null> {
        const q = query(this.registryRef, where('isrc', '==', isrc), limit(1));
        const snap = await getDocs(q);
        if (snap.empty) return null;
        return { id: snap.docs[0].id, ...snap.docs[0].data() } as ISRCRecordDocument;
    }

    /** Look up all registry records for a given release. */
    async getByRelease(releaseId: string): Promise<ISRCRecordDocument[]> {
        const q = query(this.registryRef, where('releaseId', '==', releaseId));
        const snap = await getDocs(q);
        return snap.docs.map(d => ({ id: d.id, ...d.data() } as ISRCRecordDocument));
    }

    /** Get all registry entries belonging to the currently authenticated user. */
    async getUserCatalog(): Promise<ISRCRecordDocument[]> {
        const userId = auth.currentUser?.uid;
        if (!userId) return [];
        const q = query(this.registryRef, where('userId', '==', userId));
        const snap = await getDocs(q);
        return snap.docs.map(d => ({ id: d.id, ...d.data() } as ISRCRecordDocument));
    }
}

export const isrcService = new ISRCService();
