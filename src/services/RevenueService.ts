
import { db, auth } from '@/services/firebase';
import { collection, query, where, getDocs, Timestamp, addDoc, serverTimestamp } from 'firebase/firestore';
import { RevenueEntrySchema, RevenueStatsSchema, type RevenueEntry, type RevenueStats } from '@/services/revenue/schema';

// Re-export types for backward compatibility or direct use
export type { RevenueEntry, RevenueStats } from '@/services/revenue/schema';

export class RevenueService {
  private readonly COLLECTION = 'revenue';

  /**
   * Fetches aggregated revenue statistics for a user.
   */
  async getUserRevenueStats(userId: string, period: '30d' | '90d' | '12y' | 'all' = '30d'): Promise<RevenueStats> {
    try {
      const currentUser = auth.currentUser;

      // Strict Security: Only allow access if the requested userId matches the authenticated user.
      if (!currentUser || currentUser.uid !== userId) {
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
        const rawData = doc.data();

        // Zod Validation with graceful fallback for partial data
        const parseResult = RevenueEntrySchema.safeParse(rawData);

        if (!parseResult.success) {
          console.warn(`[RevenueService] Invalid document ${doc.id}:`, parseResult.error);
          return; // Skip invalid documents
        }

        const data = parseResult.data;
        const amount = data.amount || 0;
        totalRevenue += amount;

        // Aggregate Sources
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
        // Handle Firestore Timestamp or standard Date/Number
        let dateObj = new Date();
        if (data.createdAt && typeof data.createdAt.toDate === 'function') {
           dateObj = data.createdAt.toDate();
        } else if (data.timestamp) {
           dateObj = new Date(data.timestamp);
        }

        const dateKey = dateObj.toISOString().split('T')[0]; // YYYY-MM-DD
        historyMap.set(dateKey, (historyMap.get(dateKey) || 0) + amount);
      });

      // Calculate Previous Revenue for Change %
      let previousRevenue = 0;
      snapshotPrevious.docs.forEach(doc => {
        const parseResult = RevenueEntrySchema.safeParse(doc.data());
        if (parseResult.success) {
            previousRevenue += (parseResult.data.amount || 0);
        }
      });

      const revenueChange = previousRevenue === 0
        ? (totalRevenue > 0 ? 100 : 0)
        : ((totalRevenue - previousRevenue) / previousRevenue) * 100;

      // Convert history map to array and sort
      const history = Array.from(historyMap.entries())
        .map(([date, amount]) => ({ date, amount }))
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      const result: RevenueStats = {
        totalRevenue,
        revenueChange,
        pendingPayouts: 0, // Heuristic removed for production safety
        lastPayoutAmount: 0, // No hardcoded placeholder
        lastPayoutDate: undefined,
        sources,
        sourceCounts,
        revenueByProduct,
        salesByProduct,
        history
      };

      return result;

    } catch (error) {
      console.error("[RevenueService] Failed to fetch stats:", error);
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
      // Validate before writing
      const validatedEntry = RevenueEntrySchema.parse(entry);

      await addDoc(collection(db, this.COLLECTION), {
        ...validatedEntry,
        createdAt: entry.timestamp ? Timestamp.fromMillis(entry.timestamp) : serverTimestamp()
      });
      console.info('[RevenueService] Sale recorded successfully');
    } catch (error) {
      console.error("[RevenueService] Failed to record sale:", error);
      throw error;
    }
  }
}

export const revenueService = new RevenueService();
