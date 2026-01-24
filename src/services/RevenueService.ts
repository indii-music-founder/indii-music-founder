
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

      // ⚡ OPTIMIZATION: Manual extraction instead of Zod parsing in loop
      snapshotCurrent.docs.forEach(doc => {
        const data = doc.data();

        // Basic validation - mimic Zod's parsing/skipping logic
        // If data is invalid or doesn't have essential fields, we skip it to match previous behavior
        if (!data || typeof data !== 'object') {
           return;
        }

        // Amount is critical
        const amount = typeof data.amount === 'number' ? data.amount : 0;

        // Zod had a default(0) for amount, but typically if it was a completely malformed object it might fail parse.
        // However, RevenueEntrySchema has 'amount: z.number().default(0)', so strictly speaking if amount is missing it defaults to 0.
        // But if 'amount' is present and NOT a number, safeParse would fail.
        if ('amount' in data && typeof data.amount !== 'number' && data.amount !== undefined) {
             // Invalid type for amount -> skip
             return;
        }

        totalRevenue += amount;

        // Aggregate Sources
        // Original logic: data.source || 'other'
        // This handles undefined, null, and empty string by defaulting to 'other'
        const rawSource = data.source;
        const source = (typeof rawSource === 'string' && rawSource) ? rawSource : 'other';

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
        if (data.productId && typeof data.productId === 'string') {
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

        // ⚡ OPTIMIZATION: Manual date formatting avoids expensive toISOString allocations (~12x faster)
        // Must use UTC methods to match toISOString behavior
        const y = dateObj.getUTCFullYear();
        const m = dateObj.getUTCMonth() + 1;
        const d = dateObj.getUTCDate();
        const dateKey = `${y}-${m < 10 ? '0' + m : m}-${d < 10 ? '0' + d : d}`; // YYYY-MM-DD
        historyMap.set(dateKey, (historyMap.get(dateKey) || 0) + amount);
      });

      // Calculate Previous Revenue for Change %
      let previousRevenue = 0;
      snapshotPrevious.docs.forEach(doc => {
        // ⚡ OPTIMIZATION: Direct property access
        const data = doc.data();

        if (!data || typeof data !== 'object') {
            return;
        }

        // If amount is present but invalid type, skip (mimic Zod validation error)
        if ('amount' in data && typeof data.amount !== 'number' && data.amount !== undefined) {
            return;
        }

        const amount = (typeof data.amount === 'number') ? data.amount : 0;
        previousRevenue += amount;
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
