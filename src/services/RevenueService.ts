
import { db, auth } from '@/services/firebase';
import { collection, query, where, getDocs, Timestamp, addDoc, serverTimestamp, orderBy, limit } from 'firebase/firestore';

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
  sourceCounts: {
    streaming: number;
    merch: number;
    licensing: number;
    social: number;
  };
  revenueByProduct: Record<string, number>;
  salesByProduct: Record<string, number>;
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
      // Mock for guest
      if (userId === 'guest') {
        return this.getMockRevenueStats(period);
      }

      const currentUser = auth.currentUser;
      // Allow 'superuser' stub for development/testing
      if (userId !== 'superuser' && (!currentUser || currentUser.uid !== userId)) {
        throw new Error('Unauthorized: Access denied to revenue data.');
      }

      const revenueRef = collection(db, this.COLLECTION);

      // Calculate date range
      const endDate = new Date();
      let startDate = new Date();
      let previousStartDate = new Date();

      if (period === '30d') {
        startDate.setDate(endDate.getDate() - 30);
        previousStartDate.setDate(startDate.getDate() - 30);
      } else if (period === '90d') {
        startDate.setDate(endDate.getDate() - 90);
        previousStartDate.setDate(startDate.getDate() - 90);
      } else if (period === '12y') {
        // Treat as 1 Year (12 months)
        startDate.setFullYear(endDate.getFullYear() - 1);
        previousStartDate.setFullYear(startDate.getFullYear() - 1);
      } else {
        // 'all' - start from epoch
        startDate = new Date(0);
        previousStartDate = new Date(0);
      }

      const startTimestamp = Timestamp.fromDate(startDate);
      const endTimestamp = Timestamp.fromDate(endDate);
      const previousStartTimestamp = Timestamp.fromDate(previousStartDate);

      // Fetch Current Period Data
      const qCurrent = query(
        revenueRef,
        where('userId', '==', userId),
        where('createdAt', '>=', startTimestamp),
        where('createdAt', '<=', endTimestamp)
      );

      // Fetch Previous Period Data (for change calculation)
      const qPrevious = query(
        revenueRef,
        where('userId', '==', userId),
        where('createdAt', '>=', previousStartTimestamp),
        where('createdAt', '<', startTimestamp)
      );

      const [snapshotCurrent, snapshotPrevious] = await Promise.all([
        getDocs(qCurrent),
        getDocs(qPrevious)
      ]);

      // Seeding check: if current snapshot is empty and period is 'all', check if any data exists to decide on seeding
      if (snapshotCurrent.empty && period === 'all') {
        const checkAll = await getDocs(query(revenueRef, where('userId', '==', userId), limit(1)));
        if (checkAll.empty) {
          await this.seedDatabase(userId);
          return this.getUserRevenueStats(userId, period);
        }
      }

      // Process Current Period
      let totalRevenue = 0;
      const sources = {
        streaming: 0,
        merch: 0,
        licensing: 0,
        social: 0
      };
      const sourceCounts = {
        streaming: 0,
        merch: 0,
        licensing: 0,
        social: 0
      };
      const revenueByProduct: Record<string, number> = {};
      const salesByProduct: Record<string, number> = {};
      const historyMap = new Map<string, number>();

      snapshotCurrent.docs.forEach(doc => {
        const data = doc.data() as RevenueEntry;
        const amount = data.amount || 0;
        totalRevenue += amount;

        // Agreggate Sources
        const source = data.source || 'other';
        if (['streaming', 'royalties', 'direct'].includes(source)) {
          sources.streaming += amount;
          sourceCounts.streaming += 1;
        } else if (source === 'merch') {
          sources.merch += amount;
          sourceCounts.merch += 1;
        } else if (source === 'licensing') {
          sources.licensing += amount;
          sourceCounts.licensing += 1;
        } else if (['social', 'social_drop'].includes(source)) {
          sources.social += amount;
          sourceCounts.social += 1;
        }

        // Aggregate Product
        if (data.productId) {
          revenueByProduct[data.productId] = (revenueByProduct[data.productId] || 0) + amount;
          salesByProduct[data.productId] = (salesByProduct[data.productId] || 0) + 1;
        }

        // Aggregate History
        const date = data.createdAt ? (data.createdAt as Timestamp).toDate() : new Date();
        const dateKey = date.toISOString().split('T')[0]; // YYYY-MM-DD
        historyMap.set(dateKey, (historyMap.get(dateKey) || 0) + amount);
      });

      // Calculate Previous Revenue for Change %
      let previousRevenue = 0;
      snapshotPrevious.docs.forEach(doc => {
        const data = doc.data() as RevenueEntry;
        previousRevenue += (data.amount || 0);
      });

      const revenueChange = previousRevenue === 0
        ? (totalRevenue > 0 ? 100 : 0)
        : ((totalRevenue - previousRevenue) / previousRevenue) * 100;

      // Convert history map to array and sort
      const history = Array.from(historyMap.entries())
        .map(([date, amount]) => ({ date, amount }))
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      return {
        totalRevenue,
        revenueChange,
        pendingPayouts: totalRevenue * 0.1, // Still using heuristic for now as payouts aren't tracked
        lastPayoutAmount: 5000, // Placeholder - requires Payouts collection
        lastPayoutDate: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000), // Placeholder
        sources,
        sourceCounts,
        revenueByProduct,
        salesByProduct,
        history
      };

    } catch (error) {
      // Caught at boundary
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
      console.info('[RevenueService] Sale recorded successfully');
    } catch (error) {
      throw error;
    }
  }

  /**
   * Seed initial transactions for a new user/org
   */
  private async seedDatabase(userId: string) {
    // Lifecycle event for database seeding is fine as console.info
    console.info(`[RevenueService] Seeding database for ${userId}...`);

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
      sourceCounts: {
        streaming: 100,
        merch: 50,
        licensing: 20,
        social: 10
      },
      revenueByProduct: {},
      salesByProduct: {},
      history: []
    };
  }
}

export const revenueService = new RevenueService();
