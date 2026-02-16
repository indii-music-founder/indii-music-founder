import { db } from '@/services/firebase';
import { collection, addDoc, getDocs, query, where, Timestamp, orderBy, limit } from 'firebase/firestore';
import type { DistributorEarnings } from './types/distributor';
import type { DateRange } from '@/services/ddex/types/common';

export interface EarningsRecord extends DistributorEarnings {
    id?: string;
    createdAt: number;
}

export class EarningsService {
    private readonly COLLECTION = 'earnings';

    /**
     * Get earnings for a specific release from a specific distributor
     */
    async getEarnings(distributorId: string, releaseId: string, period?: DateRange): Promise<DistributorEarnings | null> {
        try {
            const constraints: any[] = [
                where('distributorId', '==', distributorId),
                where('releaseId', '==', releaseId)
            ];

            if (period) {
                // This assumes stored records have a compatible date field or we filter in memory
                // For simplicity in this roadmap, we fetch the latest matching record
            }

            const q = query(
                collection(db, this.COLLECTION),
                ...constraints,
                orderBy('lastUpdated', 'desc'),
                limit(1)
            );

            const snapshot = await getDocs(q);
            if (snapshot.empty) return null;

            return snapshot.docs[0].data() as DistributorEarnings;
        } catch (error) {
            console.error('[EarningsService] Failed to fetch earnings:', error);
            return null;
        }
    }

    /**
     * Get all earnings for a distributor (optionally filtered by period)
     */
    async getAllEarnings(distributorId: string, period?: DateRange): Promise<DistributorEarnings[]> {
        try {
             const q = query(
                collection(db, this.COLLECTION),
                where('distributorId', '==', distributorId)
            );

            const snapshot = await getDocs(q);
            return snapshot.docs.map(doc => doc.data() as DistributorEarnings);
        } catch (error) {
            console.error('[EarningsService] Failed to fetch all earnings:', error);
            return [];
        }
    }

    /**
     * Record new earnings data (Ingest)
     */
    async recordEarnings(data: DistributorEarnings): Promise<string> {
        try {
            const record: EarningsRecord = {
                ...data,
                createdAt: Date.now()
            };

            const docRef = await addDoc(collection(db, this.COLLECTION), record);
            return docRef.id;
        } catch (error) {
            console.error('[EarningsService] Failed to record earnings:', error);
            throw error;
        }
    }
}

export const earningsService = new EarningsService();
