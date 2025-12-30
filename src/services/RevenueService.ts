import { Timestamp, collection, query, where, getDocs, orderBy, limit, doc, setDoc, getDoc } from 'firebase/firestore';
import { db } from '@/core/config/firebase';

export interface RevenueEntry {
    id: string;
    productId: string;
    productName: string;
    amount: number;
    currency: string;
    source: 'direct' | 'social_drop' | 'streaming' | 'merch';
    customerId: string;
    timestamp: Timestamp;
    status: 'pending' | 'completed' | 'refunded';
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

class RevenueService {
    private readonly COLLECTION = 'revenue';

    /**
     * Record a new revenue transaction
     */
    async recordSale(entry: Omit<RevenueEntry, 'id' | 'timestamp'>): Promise<string> {
        const id = `REV-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const timestamp = Timestamp.now();

        await setDoc(doc(db, this.COLLECTION, id), {
            ...entry,
            id,
            timestamp,
            status: 'completed' // Default to completed for simple mock
        });

        return id;
    }

    /**
     * Get total revenue summary for a user/org
     * Aggregates on the fly (naive implementation for MVP)
     */
    async getRevenueSummary(orgId: string): Promise<RevenueSummary> {
        // In a real app, this would query a pre-aggregated 'stats' document
        // Here we query recent transactions

        // Mocking aggregation for now as we don't have all transactions in Firestore yet
        // In production, use a dedicated 'analytics' collection updated via Cloud Functions

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
            snapshot.forEach(doc => {
                const data = doc.data() as RevenueEntry;
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
     * Get revenue specific to a product (e.g., for Product Card stats)
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
            snapshot.forEach(doc => {
                total += doc.data().amount;
            });
            return total;
        } catch (e) {
            return 0;
        }
    }
}

export const revenueService = new RevenueService();
