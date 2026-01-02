
import { db, auth } from '@/services/firebase';
import { collection, query, where, getDocs, Timestamp, addDoc, serverTimestamp } from 'firebase/firestore';

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

      const revenueRef = collection(db, this.COLLECTION);
      const q = query(revenueRef, where('userId', '==', userId));
      const snapshot = await getDocs(q);

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
        revenueChange: 0,
        pendingPayouts: 0,
        lastPayoutAmount: 0,
        lastPayoutDate: undefined,
        sources,
        revenueByProduct,
        history
      };

    } catch (error) {
      console.error('Error fetching revenue stats:', error);
      throw error;
    }
  }

  // Alias for backward compatibility if needed, or just redirect
  async getRevenueStats(userId: string, period: '30d' | '90d' | '12y' | 'all' = '30d'): Promise<RevenueStats> {
    return this.getUserRevenueStats(userId, period);
  }

  // Helper methods
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

  private getMockRevenueStats(period: string): RevenueStats {
    return {
      totalRevenue: 50000,
      revenueChange: 15,
      pendingPayouts: 5000,
      lastPayoutAmount: 12000,
      lastPayoutDate: new Date(),
      sources: {
        streaming: 20000,
        merch: 15000,
        licensing: 10000,
        social: 5000
      },
      revenueByProduct: {},
      history: []
    };
  }
}

export const revenueService = new RevenueService();
