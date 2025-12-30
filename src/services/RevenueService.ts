// Verified clean build content - Force Sync
import { Timestamp, collection, query, where, getDocs, orderBy, limit, doc, setDoc, addDoc } from 'firebase/firestore';
import { db } from '@/services/firebase';

export interface RevenueEntry {
    id: string;
    productId: string;
    productName?: string;
    amount: number;
    currency: string;
    source: 'direct' | 'social_drop' | 'streaming' | 'merch';
    customerId: string;
    timestamp: Timestamp;
    status: 'pending' | 'completed' | 'refunded';
    userId?: string; // Optional for compatibility
}

export interface RevenueSummary {
    totalRevenue: number;
    currency: string;
    bySource: {
        direct: number;
        social_drop: number;
        streaming: number;
        merch: number;
    };
    recentTransactions: RevenueEntry[];
}

export class RevenueService {
    private readonly COLLECTION = 'revenue';

    /**
     * Record a new revenue transaction
     */
    async recordSale(entry: Omit<RevenueEntry, 'id' | 'timestamp'>): Promise<string> {
        const id = `REV-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const timestamp = Timestamp.now();
        const entryWithDefaults = {
            ...entry,
            id,
            timestamp
        };

        // Use setDoc to specify ID
        await setDoc(doc(db, this.COLLECTION, id), entryWithDefaults);

        return id;
    }

    /**
     * Get total revenue summary for a user/org
     */
    async getRevenueSummary(orgId: string): Promise<RevenueSummary> {
        const summary: RevenueSummary = {
            totalRevenue: 0,
            currency: 'USD',
            bySource: {
                direct: 0,
                social_drop: 0,
                streaming: 0,
                merch: 0
            },
            recentTransactions: []
        };

        try {
            const q = query(
                collection(db, this.COLLECTION),
                orderBy('timestamp', 'desc'),
                limit(50)
            );

            const snapshot = await getDocs(q);
            snapshot.forEach(docSnap => {
                const data = docSnap.data() as RevenueEntry;
                summary.recentTransactions.push(data);

                if (data.status === 'completed') {
                    summary.totalRevenue += data.amount;
                    if (summary.bySource[data.source] !== undefined) {
                        summary.bySource[data.source] += data.amount;
                    }
                }
            });

        } catch (error) {
            console.error('[RevenueService] Failed to fetch summary', error);
        }

        return summary;
    }

    /**
     * Get revenue specific to a product
     */
    async getProductRevenue(productId: string): Promise<number> {
        try {
            const q = query(
                collection(db, this.COLLECTION),
                where('productId', '==', productId),
                where('status', '==', 'completed')
            );

            const snapshot = await getDocs(q);
            let total = 0;
            snapshot.forEach(docSnap => {
                total += docSnap.data().amount || 0;
            });
            return total;
        } catch (e) {
            return 0;
        }
    }

    /**
     * Get revenue by period (Legacy compatibility method)
     */
    async getRevenueByPeriod(userId: string, start: Date, end: Date): Promise<number> {
        try {
            const q = query(
                collection(db, this.COLLECTION),
                where('userId', '==', userId), // Assuming userId is added to records
                where('timestamp', '>=', Timestamp.fromDate(start)),
                where('timestamp', '<=', Timestamp.fromDate(end))
            );
            const snapshot = await getDocs(q);
            let total = 0;
            snapshot.forEach(docSnap => {
                total += (docSnap.data() as RevenueEntry).amount;
            });
            return total;
        } catch (e) {
            return 0;
        }
    }
}

export const revenueService = new RevenueService();


