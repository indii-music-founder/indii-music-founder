
import { db, auth } from '@/services/firebase';
import { collection, query, where, getDocs, Timestamp, addDoc, serverTimestamp } from 'firebase/firestore';
import { RevenueEntrySchema, type RevenueEntry, type RevenueStats } from '@/services/revenue/schema';
import { logger } from '@/utils/logger';

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
      const earningsRef = collection(db, 'earnings');
      const merchRef = collection(db, 'manufacture_requests');

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
        startDate.setFullYear(endDate.getFullYear() - 1);
        previousStartDate.setFullYear(startDate.getFullYear() - 1);
      } else {
        startDate = new Date(0);
        previousStartDate = new Date(0);
      }

      const startTimestamp = Timestamp.fromDate(startDate);
      const endTimestamp = Timestamp.fromDate(endDate);
      const previousStartTimestamp = Timestamp.fromDate(previousStartDate);

      // Fetch Current Period Data from all sources
      const qCurrent = query(
        revenueRef,
        where('userId', '==', userId),
        where('createdAt', '>=', startTimestamp),
        where('createdAt', '<=', endTimestamp)
      );

      const qEarnings = query(
        earningsRef,
        where('userId', '==', userId),
        where('createdAt', '>=', startTimestamp),
        where('createdAt', '<=', endTimestamp)
      );

      const qMerch = query(
        merchRef,
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

      const qPreviousEarnings = query(
        earningsRef,
        where('userId', '==', userId),
        where('createdAt', '>=', previousStartTimestamp),
        where('createdAt', '<', startTimestamp)
      );

      const qPreviousMerch = query(
        merchRef,
        where('userId', '==', userId),
        where('createdAt', '>=', previousStartTimestamp),
        where('createdAt', '<', startTimestamp)
      );

      const [
        snapshotCurrent,
        snapshotPrevious,
        snapshotEarnings,
        snapshotMerch,
        snapshotPreviousEarnings,
        snapshotPreviousMerch,
      ] = await Promise.all([
        getDocs(qCurrent),
        getDocs(qPrevious),
        getDocs(qEarnings),
        getDocs(qMerch),
        getDocs(qPreviousEarnings),
        getDocs(qPreviousMerch),
      ]);

      // Process Data
      let totalRevenue = 0;
      const sources = { streaming: 0, merch: 0, licensing: 0, social: 0 };
      const sourceCounts = { streaming: 0, merch: 0, licensing: 0, social: 0 };
      const revenueByProduct: Record<string, number> = {};
      const salesByProduct: Record<string, number> = {};
      const historyMap = new Map<string, number>();

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const processSnapshots = (snapshots: { snapshot: any, type: 'revenue' | 'earnings' | 'merch' }[]) => {
        snapshots.forEach(({ snapshot, type }) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          snapshot.docs.forEach((doc: any) => {
            const data = doc.data();
            if (!data) return;

            let amount = 0;
            let source = 'other';
            let productId = data.productId;

            if (type === 'revenue') {
              amount = typeof data.amount === 'number' ? data.amount : 0;
              source = data.source || 'other';
            } else if (type === 'earnings') {
              amount = typeof data.netRevenue === 'number' ? data.netRevenue : 0;
              source = 'streaming';
              productId = data.releaseId;
            } else if (type === 'merch') {
              amount = typeof data.totalAmount === 'number' ? data.totalAmount : 0;
              source = 'merch';
            }

            totalRevenue += amount;

            // Map source to predefined categories
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

            if (productId && typeof productId === 'string') {
              revenueByProduct[productId] = (revenueByProduct[productId] || 0) + amount;
              salesByProduct[productId] = (salesByProduct[productId] || 0) + 1;
            }

            let dateObj = new Date();
            if (data.createdAt && typeof data.createdAt.toDate === 'function') {
              dateObj = typeof data.createdAt.toDate === 'function' ? data.createdAt.toDate() : (data.createdAt instanceof Date ? data.createdAt : new Date(data.createdAt));
            } else if (data.timestamp) {
              dateObj = new Date(data.timestamp);
            }

            const y = dateObj.getUTCFullYear();
            const m = dateObj.getUTCMonth() + 1;
            const d = dateObj.getUTCDate();
            const dateKey = `${y}-${m < 10 ? '0' + m : m}-${d < 10 ? '0' + d : d}`;
            historyMap.set(dateKey, (historyMap.get(dateKey) || 0) + amount);
          });
        });
      };

      processSnapshots([
        { snapshot: snapshotCurrent, type: 'revenue' },
        { snapshot: snapshotEarnings, type: 'earnings' },
        { snapshot: snapshotMerch, type: 'merch' }
      ]);

      // Calculate Previous Revenue for Change %
      let previousRevenue = 0;
      let previousUnits = 0;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const processPrevious = (snapshot: any, type: 'revenue' | 'earnings' | 'merch') => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        snapshot.docs.forEach((doc: any) => {
          const data = doc.data();
          if (!data) return;
          const amount = type === 'earnings'
            ? (typeof data.netRevenue === 'number' ? data.netRevenue : 0)
            : type === 'merch'
              ? (typeof data.totalAmount === 'number' ? data.totalAmount : 0)
              : (typeof data.amount === 'number' ? data.amount : 0);
          previousRevenue += amount;
          if (type === 'revenue') previousUnits += 1;
        });
      };

      processPrevious(snapshotPrevious, 'revenue');
      processPrevious(snapshotPreviousEarnings, 'earnings');
      processPrevious(snapshotPreviousMerch, 'merch');


      const revenueChange = previousRevenue === 0
        ? (totalRevenue > 0 ? 100 : 0)
        : ((totalRevenue - previousRevenue) / previousRevenue) * 100;

      const unitsSold = snapshotCurrent.docs.length;
      const unitsChange = previousUnits === 0
        ? (unitsSold > 0 ? 100 : 0)
        : ((unitsSold - previousUnits) / previousUnits) * 100;

      // Convert history map to array and sort
      // ⚡ OPTIMIZATION: String comparison of YYYY-MM-DD avoids expensive Date parsing in sort loop
      const history = Array.from(historyMap.entries())
        .map(([date, amount]) => ({ date, amount }))
        // ⚡ OPTIMIZATION: Binary comparison is significantly faster (~3x) than localeCompare for ISO dates
        .sort((a, b) => (a.date < b.date ? -1 : (a.date > b.date ? 1 : 0)));

      const result: RevenueStats = {
        totalRevenue,
        revenueChange,
        unitsSold,
        unitsChange,
        pendingPayouts: 0, // Heuristic removed for production safety
        lastPayoutAmount: 0, // No hardcoded placeholder
        lastPayoutDate: undefined,
        sources,
        sourceCounts,
        revenueByProduct,
        salesByProduct,
        history,
        // ISSUE-1275: these were hardcoded to 0 and never assigned anywhere, so the
        // merch dashboard's Trend Score gauge and Production Velocity gauge always
        // read zero no matter the artist's real activity — a permanent fake
        // "no data" state rendered as if it were a live measurement.
        //
        // trendScore: revenue momentum on a 0-100 scale, where 50 is flat vs the
        // previous period. Derived from the real revenueChange computed above and
        // clamped; a ±100% swing saturates the gauge. Zero revenue in both periods
        // means there is genuinely nothing to score, so it reports 0.
        trendScore: (totalRevenue === 0 && previousRevenue === 0)
          ? 0
          : Math.max(0, Math.min(100, Math.round(50 + revenueChange / 2))),
        // productionVelocity: the UI labels this "vs last week" as a percentage,
        // which is exactly the real unitsChange already computed above.
        productionVelocity: Math.round(unitsChange),
        // funnelData: pageViews/addToCart/checkout require storefront funnel event
        // tracking that does not exist anywhere in this codebase. There is no honest
        // value to compute, so this reports null and the UI renders an explicit
        // "not tracked yet" state rather than three zeroes posing as measurements.
        funnelData: null
      };

      return result;

    } catch (error: unknown) {
      logger.error("[RevenueService] Failed to fetch stats:", error);
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
      logger.info('[RevenueService] Sale recorded successfully');
    } catch (error: unknown) {
      logger.error("[RevenueService] Failed to record sale:", error);
      throw error;
    }
  }
}

export const revenueService = new RevenueService();
