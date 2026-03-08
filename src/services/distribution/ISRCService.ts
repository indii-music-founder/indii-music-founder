import { getFirestore, collection, addDoc, getDocs, query, where, limit, updateDoc, doc, runTransaction } from 'firebase/firestore';
import { app } from '@/services/firebase';
import { logger } from '@/utils/logger';

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
}

export const isrcService = new ISRCService();
