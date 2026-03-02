import { db } from '@/services/firebase';
import { collection, addDoc, getDocs, query, where, serverTimestamp, orderBy, limit, doc, setDoc, FieldValue } from 'firebase/firestore';
import type { DistributorEarnings } from './types/distributor';
import type { DateRange } from '@/services/ddex/types/common';

export interface EarningsRecord extends Omit<DistributorEarnings, 'lastUpdated'> {
    id?: string;
    createdAt: FieldValue | Date; // serverTimestamp
    lastUpdated: FieldValue | Date; // serverTimestamp
}

export class EarningsService {
    private readonly COLLECTION = 'earnings';

    /**
     * Get earnings for a specific release from a specific distributor
     */
    async getEarnings(distributorId: string, releaseId: string, period?: DateRange): Promise<DistributorEarnings | null> {
        try {
            let q = query(
                collection(db, this.COLLECTION),
                where('distributorId', '==', distributorId),
                where('releaseId', '==', releaseId)
            );

            if (period) {
                q = query(q,
                    where('period.startDate', '==', period.startDate),
                    where('period.endDate', '==', period.endDate)
                );
            } else {
                q = query(q, orderBy('period.endDate', 'desc'), limit(1));
            }

            const snapshot = await getDocs(q);
            if (snapshot.empty) return null;

            const data = snapshot.docs[0].data();
            return ({
                ...data,
                id: snapshot.docs[0].id,
                // Handle Timestamp conversion
                lastUpdated: data.lastUpdated?.toDate?.()?.toISOString() || new Date().toISOString()
            } as unknown) as DistributorEarnings;
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
            let q = query(
                collection(db, this.COLLECTION),
                where('distributorId', '==', distributorId)
            );

            if (period) {
                q = query(q,
                    where('period.startDate', '>=', period.startDate),
                    where('period.endDate', '<=', period.endDate)
                );
            }

            const snapshot = await getDocs(q);
            return snapshot.docs.map(doc => {
                const data = doc.data();
                return ({
                    ...data,
                    id: doc.id,
                    lastUpdated: data.lastUpdated?.toDate?.()?.toISOString() || new Date().toISOString()
                } as unknown) as DistributorEarnings;
            });
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
            const earningsId = `${data.distributorId}_${data.releaseId}_${data.period.startDate}_${data.period.endDate}`;
            const record = {
                ...data,
                createdAt: serverTimestamp(),
                lastUpdated: serverTimestamp()
            };

            // Use setDoc with a deterministic ID to prevent duplicates if the same report is processed twice
            await setDoc(doc(db, this.COLLECTION, earningsId), record, { merge: true });
            return earningsId;
        } catch (error) {
            console.error('[EarningsService] Failed to record earnings:', error);
            throw error;
        }
    }
}

export const earningsService = new EarningsService();
