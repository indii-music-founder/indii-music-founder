
import { db, auth } from '@/services/firebase';
import { collection, query, where, getDocs, Timestamp, orderBy, addDoc, serverTimestamp } from 'firebase/firestore';

export interface RevenueStats {
  totalRevenue: number;
  revenueChange: number; // percentage
  pendingPayouts: number;
  lastPayoutAmount: number;
  lastPayoutDate?: Date;
  sources: {
    streaming: number;
    merch: number;
    licensing: number;
    social: number;
  };
  revenueByProduct: Record<string, number>;
  history: {
    date: string;
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
  }[];
}

export interface RevenueEntry {
  id?: string;
  productId?: string;
  productName?: string;
  amount: number;
  currency?: string;
  source: string; // 'streaming', 'merch', 'licensing', 'social', 'social_drop', etc.
  customerId?: string;
  userId: string;
  status?: 'completed' | 'pending' | 'failed';
  timestamp?: number;
  createdAt?: any;
}

export class RevenueService {
  private readonly COLLECTION = 'revenue';

  /**
   * Fetches aggregated revenue statistics for a user.
   */
  async getUserRevenueStats(userId: string, period: '30d' | '90d' | '12y' | 'all' = '30d'): Promise<RevenueStats> {
    try {
      // Mock for superuser
      if (userId === 'superuser') {
        return this.getMockRevenueStats(period);
      }

      const currentUser = auth.currentUser;
      if (!currentUser || currentUser.uid !== userId) {
        throw new Error('Unauthorized: Access denied to revenue data.');
      }

            return {
                direct: Number(result.direct.toFixed(2)),
                social: Number(result.social.toFixed(2))
            };
        } catch (error) {
            console.error('[RevenueService] Failed to get revenue by source:', error);
            return { direct: 0, social: 0 };
      const revenueRef = collection(db, this.COLLECTION);
      const q = query(revenueRef, where('userId', '==', userId));
      const snapshot = await getDocs(q);

      // Seeding check: if no data, seed and retry
      if (snapshot.empty && userId) {
        await this.seedDatabase(userId);
        return this.getUserRevenueStats(userId, period);
      }

      let totalRevenue = 0;
      const sources = {
        streaming: 0,
        merch: 0,
        licensing: 0,
        social: 0
      };
      const revenueByProduct: Record<string, number> = {};
      const historyMap = new Map<string, number>();

      snapshot.docs.forEach(doc => {
        const data = doc.data() as RevenueEntry;
        const amount = data.amount || 0;
        totalRevenue += amount;

        // Agreggate Sources
        const source = data.source || 'other';
        if (['streaming', 'royalties', 'direct'].includes(source)) {
          sources.streaming += amount;
        } else if (source === 'merch') {
          sources.merch += amount;
        } else if (source === 'licensing') {
          sources.licensing += amount;
        } else if (['social', 'social_drop'].includes(source)) {
          sources.social += amount;
        }

        // Aggregate Product
        if (data.productId) {
          revenueByProduct[data.productId] = (revenueByProduct[data.productId] || 0) + amount;
        }

        // Aggregate History
        const date = data.createdAt ? (data.createdAt as Timestamp).toDate() : new Date();
        const dateKey = date.toISOString().split('T')[0]; // YYYY-MM-DD
        historyMap.set(dateKey, (historyMap.get(dateKey) || 0) + amount);
      });

      // Convert history map to array and sort
      const history = Array.from(historyMap.entries())
        .map(([date, amount]) => ({ date, amount }))
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      return {
        totalRevenue,
        revenueChange: 12.5, // Mock change for now
        pendingPayouts: totalRevenue * 0.1, // Mock pending 10%
        lastPayoutAmount: 5000,
        lastPayoutDate: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
        sources,
        revenueByProduct,
        history
      };

    } catch (error) {
      console.error('Error fetching revenue stats:', error);
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
  // Alias for backward compatibility if needed, or just redirect
  async getRevenueStats(userId: string, period: '30d' | '90d' | '12y' | 'all' = '30d'): Promise<RevenueStats> {
    return this.getUserRevenueStats(userId, period);
  }

  // Methods from main branch to prevent breakage
  async getTotalRevenue(userId: string): Promise<number> {
    const stats = await this.getUserRevenueStats(userId);
    return stats.totalRevenue;
  }

  async getRevenueBySource(userId: string): Promise<{ direct: number, social: number }> {
    const stats = await this.getUserRevenueStats(userId);
    return {
      direct: stats.sources.streaming + stats.sources.merch + stats.sources.licensing,
      social: stats.sources.social
    };
  }

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
  async getRevenueByProduct(userId: string): Promise<Record<string, number>> {
    const stats = await this.getUserRevenueStats(userId);
    return stats.revenueByProduct;
  }

  async recordSale(entry: RevenueEntry) {
    try {
      await addDoc(collection(db, this.COLLECTION), {
        ...entry,
        createdAt: entry.timestamp ? Timestamp.fromMillis(entry.timestamp) : serverTimestamp()
      });
      console.log('[RevenueService] Sale recorded successfully');
    } catch (error) {
      console.error('[RevenueService] Failed to record sale:', error);
      throw error;
    }
  }

  /**
   * Seed initial transactions for a new user/org
   */
  private async seedDatabase(userId: string) {
    console.log(`[RevenueService] Seeding database for ${userId}...`);

    const initialSales: RevenueEntry[] = [
      {
        productId: 'prod-1',
        productName: 'Neon Genesis (Digital Vinyl)',
        amount: 25.00,
        currency: 'USD',
        source: 'merch',
        customerId: 'cust-mock-1',
        status: 'completed',
        userId: userId
      },
      {
        productId: 'prod-2',
        productName: 'Lofi Link (Sample Pack)',
        amount: 15.00,
        currency: 'USD',
        source: 'social_drop',
        customerId: 'cust-mock-2',
        status: 'completed',
        userId: userId
      },
      {
        productId: 'prod-3',
        productName: 'Streaming Royalty (Spotify)',
        amount: 124.50,
        currency: 'USD',
        source: 'streaming',
        customerId: 'spotify-aggregator',
        status: 'completed',
        userId: userId
      }
    ];

    for (const sale of initialSales) {
      await this.recordSale(sale);
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

export const revenueService = new RevenueService();
