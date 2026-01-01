import { revenueService } from '@/services/RevenueService';
import { db } from '@/services/firebase';
import * as Sentry from '@sentry/react';
import {
    collection,
    addDoc,
    getDocs,
    query,
    where,
    orderBy,
    Timestamp
} from 'firebase/firestore';
import { EarningsSummary as DSREarningsSummary } from '@/services/ddex/types/dsr';

export interface EarningsSummary {
  totalEarnings: number;
  pendingPayouts: number;
  lastPayout: number;
  lastPayoutDate?: string;
  currency: string;
  trends: {
    earningsChange: number;
    payoutsChange: number;
  };
  sources: {
    name: string;
    amount: number;
    percentage: number;
  }[];
}

export interface Expense {
  id: string;
  userId: string;
  vendor: string;
  amount: number;
  category: string;
  date: string;
  description: string;
  createdAt?: any;
}

export class FinanceService {
  async getEarningsSummary(userId: string): Promise<EarningsSummary> {
    try {
      // Use the RevenueService to get aggregated stats
      const stats = await revenueService.getUserRevenueStats(userId);

      return {
        totalEarnings: stats.totalRevenue,
        pendingPayouts: stats.pendingPayouts,
        lastPayout: stats.lastPayoutAmount,
        lastPayoutDate: stats.lastPayoutDate ? stats.lastPayoutDate.toISOString() : undefined,
        currency: 'USD',
        trends: {
          earningsChange: stats.revenueChange,
          payoutsChange: 0
        },
        sources: [
          { name: 'Streaming', amount: stats.sources.streaming, percentage: stats.totalRevenue ? (stats.sources.streaming / stats.totalRevenue) * 100 : 0 },
          { name: 'Merch', amount: stats.sources.merch, percentage: stats.totalRevenue ? (stats.sources.merch / stats.totalRevenue) * 100 : 0 },
          { name: 'Licensing', amount: stats.sources.licensing || 0, percentage: stats.totalRevenue ? ((stats.sources.licensing || 0) / stats.totalRevenue) * 100 : 0 }
        ]
      };
    } catch (error) {
      console.error('Error fetching earnings summary:', error);
      throw error;
    }
  }

    /**
     * Fetch earnings summary.
     * @param userId The user ID to fetch earnings for.
     * @param period Optional date range filter.
     */
    static async fetchEarnings(userId: string, period?: { startDate: string; endDate: string }): Promise<DSREarningsSummary> {
        try {
            const revenueStats = await revenueService.getUserRevenueStats(userId);

            // Default period to current month if not provided
            const effectivePeriod = period || {
                startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString(),
                endDate: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString()
            };

            // Map the revenue stats to EarningsSummary
            // Note: Granular data like byTerritory and byPlatform are currently
            // empty as RevenueService aggregates at a higher level (Direct vs Social).
            // Future updates should ingest full DSR data to populate these fields.

            // TODO: revenueStats currently does not return revenueByProduct.
            // We need to update RevenueService to aggregate by product or fetch it separately.
            // For now, returning empty array to fix build.
            /*
            const byRelease = Object.entries(revenueStats.revenueByProduct).map(([productId, amount]) => ({
                releaseId: productId,
                releaseName: `Product ${productId}`, // Placeholder name until we look up product details
                revenue: amount,
                streams: 0,
                downloads: 0
            }));
            */
            const byRelease: any[] = [];

            return {
                period: effectivePeriod,
                totalGrossRevenue: revenueStats.totalRevenue,
                totalNetRevenue: revenueStats.totalRevenue, // Assuming net = gross for now or handled elsewhere
                totalStreams: 0,
                totalDownloads: 0,
                currencyCode: 'USD',
                byPlatform: [], // No platform breakdown yet
                byTerritory: [], // No territory breakdown yet
                byRelease: byRelease
            };
        } catch (error) {
             Sentry.captureException(error);
             throw error;
        }
    }

  async addExpense(expense: Omit<Expense, 'id' | 'createdAt'>): Promise<string> {
      try {
        const docRef = await addDoc(collection(db, 'expenses'), {
            ...expense,
            createdAt: Timestamp.now()
        });
        return docRef.id;
      } catch (error) {
          console.error('Error adding expense:', error);
          throw error;
      }
  }

  async getExpenses(userId: string): Promise<Expense[]> {
    try {
        const q = query(
            collection(db, 'expenses'),
            where('userId', '==', userId),
            orderBy('createdAt', 'desc')
        );
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        })) as Expense[];
    } catch (error) {
        console.error('Error fetching expenses:', error);
        return [];
    }
  }
}

export const financeService = new FinanceService();
