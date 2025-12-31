import { db } from '@/services/firebase';
import { collection, addDoc, getDocs, query, where, Timestamp, orderBy } from 'firebase/firestore';

export interface RevenueEntry {
    id?: string;
    productId: string;
    amount: number;
    source: 'direct' | 'social_drop';
    customerId: string;
    userId: string; // The seller/merchant ID
    timestamp: number;
}

class RevenueServiceImpl {
    private collectionName = 'revenue';

    /**
     * Get total revenue for a user by summing up all revenue entries.
     * Uses real Firestore data.
     */
    async getTotalRevenue(userId: string): Promise<number> {
        try {
            const q = query(
                collection(db, this.collectionName),
                where('userId', '==', userId)
            );

            const snapshot = await getDocs(q);

            // Client-side aggregation (suitable for MVP/Alpha scale)
            // For Production at scale, use Firestore Aggregation Queries:
            // const snapshot = await getAggregateFromServer(q, { totalRevenue: sum('amount') });
            // return snapshot.data().totalRevenue;

            let total = 0;
            snapshot.forEach(doc => {
                const data = doc.data();
                if (typeof data.amount === 'number') {
                    total += data.amount;
                }
            });

            return Number(total.toFixed(2));
        } catch (error) {
            console.error('[RevenueService] Failed to get total revenue:', error);
            throw error;
        }
    }

    /**
     * Get revenue breakdown by source (direct vs social_drop).
     */
    async getRevenueBySource(userId: string): Promise<{ direct: number, social: number }> {
        try {
            const q = query(
                collection(db, this.collectionName),
                where('userId', '==', userId)
            );

            const snapshot = await getDocs(q);

            const result = { direct: 0, social: 0 };

            snapshot.forEach(doc => {
                const data = doc.data() as RevenueEntry;
                if (data.source === 'social_drop') {
                    result.social += data.amount || 0;
                } else {
                    result.direct += data.amount || 0;
                }
            });

            return {
                direct: Number(result.direct.toFixed(2)),
                social: Number(result.social.toFixed(2))
            };
        } catch (error) {
            console.error('[RevenueService] Failed to get revenue by source:', error);
            return { direct: 0, social: 0 };
        }
    }

    /**
     * Get revenue breakdown by product ID.
     */
    async getRevenueByProduct(userId: string): Promise<Record<string, number>> {
        try {
            const q = query(
                collection(db, this.collectionName),
                where('userId', '==', userId)
            );

            const snapshot = await getDocs(q);
            const productRevenue: Record<string, number> = {};

            snapshot.forEach(doc => {
                const data = doc.data() as RevenueEntry;
                if (data.productId) {
                    productRevenue[data.productId] = (productRevenue[data.productId] || 0) + (data.amount || 0);
                }
            });

            // Round all values
            Object.keys(productRevenue).forEach(key => {
                productRevenue[key] = Number(productRevenue[key].toFixed(2));
            });

            return productRevenue;
        } catch (error) {
            console.error('[RevenueService] Failed to get revenue by product:', error);
            return {};
        }
    }

    /**
     * Record a new sale in Firestore.
     */
    async recordSale(entry: RevenueEntry): Promise<void> {
        try {
            // Ensure timestamp is valid
            const safeEntry = {
                ...entry,
                timestamp: entry.timestamp || Date.now()
            };

            await addDoc(collection(db, this.collectionName), safeEntry);
            console.log('[RevenueService] Sale recorded successfully:', safeEntry);
        } catch (error) {
            console.error('[RevenueService] Failed to record sale:', error);
            throw error;
        }
    }
}

export const revenueService = new RevenueServiceImpl();
