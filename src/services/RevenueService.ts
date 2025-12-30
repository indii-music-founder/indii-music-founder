import { db } from '@/services/firebase';
import {
    collection,
    query,
    where,
    getDocs,
    Timestamp,
    addDoc,
    orderBy
} from 'firebase/firestore';

export interface RevenueEntry {
    id: string;
    productId: string;
    amount: number;
    source: 'direct' | 'social_drop';
    customerId: string;
    timestamp: Timestamp;
    userId: string; // The artist who owns the product
}

export class RevenueService {
    /**
     * Get total revenue for a user
     */
    async getTotalRevenue(userId: string): Promise<number> {
        const q = query(
            collection(db, 'revenue'),
            where('userId', '==', userId)
        );
        const snapshot = await getDocs(q);
        let total = 0;
        snapshot.forEach(doc => {
            total += (doc.data() as RevenueEntry).amount;
        });
        return total;
    }

    /**
     * Get revenue within a date range
     */
    async getRevenueByPeriod(userId: string, start: Date, end: Date): Promise<number> {
        const q = query(
            collection(db, 'revenue'),
            where('userId', '==', userId),
            where('timestamp', '>=', Timestamp.fromDate(start)),
            where('timestamp', '<=', Timestamp.fromDate(end))
        );
        const snapshot = await getDocs(q);
        let total = 0;
        snapshot.forEach(doc => {
            total += (doc.data() as RevenueEntry).amount;
        });
        return total;
    }

    /**
     * Get revenue broken down by product ID
     */
    async getRevenueByProduct(userId: string): Promise<Map<string, number>> {
        const q = query(
            collection(db, 'revenue'),
            where('userId', '==', userId)
        );
        const snapshot = await getDocs(q);
        const map = new Map<string, number>();
        snapshot.forEach(doc => {
            const data = doc.data() as RevenueEntry;
            const current = map.get(data.productId) || 0;
            map.set(data.productId, current + data.amount);
        });
        return map;
    }

    /**
     * Get revenue broken down by source (direct vs social_drop)
     */
    async getRevenueBySource(userId: string): Promise<{ direct: number; social: number }> {
        const q = query(
            collection(db, 'revenue'),
            where('userId', '==', userId)
        );
        const snapshot = await getDocs(q);
        let direct = 0;
        let social = 0;
        snapshot.forEach(doc => {
            const data = doc.data() as RevenueEntry;
            if (data.source === 'social_drop') {
                social += data.amount;
            } else {
                direct += data.amount;
            }
        });
        return { direct, social };
    }

    /**
     * Record a new sale
     */
    async recordSale(entry: Omit<RevenueEntry, 'id'>): Promise<void> {
        await addDoc(collection(db, 'revenue'), entry);
    }
}

export const revenueService = new RevenueService();
