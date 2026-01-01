import { db } from '@/services/firebase';
import { collection, query, where, getDocs, Timestamp, orderBy, addDoc } from 'firebase/firestore';

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
  history: {
    date: string;
    amount: number;
  }[];
}

export interface RevenueEntry {
  productId: string;
  amount: number;
  source: string;
  customerId: string;
  userId: string;
  timestamp: number;
}

export class RevenueService {
  /**
   * Fetches aggregated revenue statistics for a user.
   * This aggregates data from the 'revenue' collection.
   */
  async getUserRevenueStats(userId: string): Promise<RevenueStats> {
    // For superuser/demo mode, return mock data
    if (userId === 'superuser') {
      return this.getMockRevenueStats('30d');
    }

    try {
      const revenueRef = collection(db, 'revenue');
      // Get all revenue records for the user
      // Ideally we would filter by date range, but for MVP we get all
      const q = query(revenueRef, where('userId', '==', userId));
      const snapshot = await getDocs(q);

      let totalRevenue = 0;
      const pendingPayouts = 0; // In a real app, this would be calculated from a separate 'payouts' collection or status
      const sources = {
        streaming: 0,
        merch: 0,
        licensing: 0,
        social: 0
      };

      const historyMap = new Map<string, number>();

      snapshot.docs.forEach(doc => {
        const data = doc.data();
        const amount = data.amount || 0;

        totalRevenue += amount;

        // Aggregate by source
        const source = data.source || 'other';
        if (source === 'streaming' || source === 'royalties') {
            sources.streaming += amount;
        } else if (source === 'merch') {
            sources.merch += amount;
        } else if (source === 'licensing') {
            sources.licensing += amount;
        } else if (source === 'social_drop') {
            sources.social += amount;
        }

        // Aggregate history (by date)
        // Assuming createdAt is a Timestamp
        const date = data.createdAt ? data.createdAt.toDate() : new Date();
        const dateKey = date.toISOString().split('T')[0]; // YYYY-MM-DD
        historyMap.set(dateKey, (historyMap.get(dateKey) || 0) + amount);
      });

      // Convert history map to array and sort
      const history = Array.from(historyMap.entries())
        .map(([date, amount]) => ({ date, amount }))
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      return {
        totalRevenue,
        revenueChange: 12.5, // Mock change calculation for now
        pendingPayouts: totalRevenue * 0.1, // Mock pending
        lastPayoutAmount: 5000, // Mock last payout
        lastPayoutDate: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000), // 15 days ago
        sources,
        history
      };

    } catch (error) {
      console.error('Error fetching revenue stats:', error);
      throw error;
    }
  }

  async getRevenueStats(userId: string, period: '30d' | '90d' | '12y' | 'all' = '30d'): Promise<RevenueStats> {
    try {
      // For superuser/demo mode, return mock data
      if (userId === 'superuser') {
        return this.getMockRevenueStats(period);
      }

      // Real implementation with Firestore
      // For now, delegate to getUserRevenueStats which fetches all
      // In the future, we can pass period to optimize the query
      return this.getUserRevenueStats(userId);
    } catch (error) {
      console.error('Error in getRevenueStats:', error);
      return this.getMockRevenueStats(period);
    }
  }

  async recordSale(entry: RevenueEntry) {
    await addDoc(collection(db, 'revenue'), {
        ...entry,
        createdAt: Timestamp.fromMillis(entry.timestamp)
    });
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
      history: Array.from({ length: 10 }, (_, i) => ({
        date: new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        amount: Math.random() * 500 + 100
      })).reverse()
    };
  }
}

export const revenueService = new RevenueService();
