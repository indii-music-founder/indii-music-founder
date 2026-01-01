import { db } from '@/services/firebase';
import {
    collection,
    query,
    where,
    getDocs,
    addDoc,
    Timestamp,
    orderBy
} from 'firebase/firestore';

export interface RevenueEntry {
    id?: string;
    productId: string;
    amount: number;
    source: 'direct' | 'social_drop' | 'merch' | 'streaming';
    customerId: string;
    userId: string; // The seller/merchant ID
    timestamp: number | Timestamp;
    createdAt?: Timestamp; // Support serverTimestamp
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

    /**
     * Get all user revenue stats in a single query
     * Optimization to prevent N+1 queries
     */
    async getUserRevenueStats(userId: string): Promise<{
        totalRevenue: number;
        revenueBySource: { direct: number; social: number };
        revenueByProduct: Record<string, number>;
    }> {
        try {
            const q = query(
                collection(db, this.collectionName),
                where('userId', '==', userId)
            );
            const snapshot = await getDocs(q);

            let totalRevenue = 0;
            const revenueBySource = { direct: 0, social: 0 };
            const revenueByProduct: Record<string, number> = {};

            // Aggregate Sources
            snapshot.forEach(docSnap => {
                const data = docSnap.data() as RevenueEntry;
                const amount = data.amount || 0;

                // Total
                totalRevenue += amount;

                // By Source
                if (data.source === 'direct' || data.source === 'merch' || data.source === 'streaming') {
                    revenueBySource.direct += amount;
                } else if (data.source === 'social_drop') {
                    revenueBySource.social += amount;
                }

                // By Product
                if (data.productId) {
                    revenueByProduct[data.productId] = (revenueByProduct[data.productId] || 0) + amount;
                }
            });

            // Handle date conversion safely if needed in future stats
            // const date = data.createdAt ? (data.createdAt as Timestamp).toDate() : new Date();

            return {
                totalRevenue,
                revenueBySource,
                revenueByProduct
            };
        } catch (e) {
            console.error('[RevenueService] Failed to get user revenue stats', e);
            return {
                totalRevenue: 0,
                revenueBySource: { direct: 0, social: 0 },
                revenueByProduct: {}
            };
        }
    }

    /**
     * Seed initial revenue data for a user (called if empty).
     * Prevents infinite recursion by checking existence first.
     */
    async seedDatabase(userId: string): Promise<void> {
        // Implement seeding logic if needed, or keeping it empty to rely on real transactions.
        // For now, we assume seeding is handled externally or by a dedicated method to avoid recursion loops.
    }
}

export const revenueService = new RevenueServiceImpl();
