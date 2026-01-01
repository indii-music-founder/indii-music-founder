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
        if (['streaming', 'royalties'].includes(source)) {
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

  // Alias for backward compatibility if needed, or just redirect
  async getRevenueStats(userId: string, period: '30d' | '90d' | '12y' | 'all' = '30d'): Promise<RevenueStats> {
    return this.getUserRevenueStats(userId, period);
  }

  async recordSale(entry: RevenueEntry) {
    await addDoc(collection(db, this.COLLECTION), {
      ...entry,
      createdAt: entry.timestamp ? Timestamp.fromMillis(entry.timestamp) : serverTimestamp() // Use server timestamp if no timestamp provided
    });
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

  private getMockRevenueStats(period: string): RevenueStats {
    return {
      totalRevenue: 12500.50,
      revenueChange: 12.5,
      pendingPayouts: 1250.00,
      lastPayoutAmount: 5000.00,
      lastPayoutDate: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
      sources: {
        streaming: 8500.50,
        merch: 2500.00,
        licensing: 1500.00,
        social: 0
      },
      revenueByProduct: {
        'prod_1': 1200.00,
        'prod_2': 850.50,
        'prod_3': 450.00
      },
      history: Array.from({ length: 10 }, (_, i) => ({
        date: new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        amount: Math.random() * 500 + 100
      })).reverse()
    };
  }
}

export const revenueService = new RevenueService();
