
import { AppException, AppErrorCode } from '@/shared/types/errors';
import { revenueService } from '@/services/RevenueService';
import { db, auth } from '@/services/firebase';
import * as Sentry from '@sentry/react';
import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  orderBy,
  Timestamp,
  serverTimestamp,
  onSnapshot,
  limit
} from 'firebase/firestore';
import {
  EarningsSummarySchema,
  type EarningsSummary,
  DashboardEarningsSummarySchema, // Keep for dashboard summary if needed
  type DashboardEarningsSummary
} from '@/services/revenue/schema';
import { ExpenseSchema, type Expense } from '@/modules/finance/schemas';
import { logger } from '@/utils/logger';

export type { Expense };

export class FinanceService {
  private readonly EXPENSES_COLLECTION = 'expenses';
  static EARNINGS_COLLECTION = 'earnings_reports';

  /**
   * Get earnings summary for dashboard (RevenueService aggregation).
   */
  async getEarningsSummary(userId: string): Promise<DashboardEarningsSummary> {
    if (!auth.currentUser || auth.currentUser.uid !== userId) {
      throw new Error('Unauthorized');
    }
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
        { name: 'Licensing', amount: stats.sources.licensing || 0, percentage: stats.totalRevenue ? ((stats.sources.licensing || 0) / stats.totalRevenue) * 100 : 0 },
        { name: 'Social', amount: stats.sources.social || 0, percentage: stats.totalRevenue ? ((stats.sources.social || 0) / stats.totalRevenue) * 100 : 0 }
      ]
    };
  }

  /**
   * Fetch persistent earnings reports (DSR style).
   */
  async fetchEarnings(userId: string): Promise<EarningsSummary | null> {
    try {
      if (!auth.currentUser || auth.currentUser.uid !== userId) {
        throw new Error('Unauthorized');
      }

      const q = query(
        collection(db, FinanceService.EARNINGS_COLLECTION),
        where('userId', '==', userId),
      );

      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        logger.info(`[FinanceService] No earnings data found for user: ${userId}`);
        return null;
      }

      const docData = snapshot.docs[0].data();

      // Zod Validation for Production Safety
      const parseResult = EarningsSummarySchema.safeParse(docData);

      if (!parseResult.success) {
        logger.error(`[FinanceService] Earnings data validation failed for ${userId}:`, parseResult.error);
        Sentry.captureMessage(`Earnings validation failed for user ${userId}`, 'error');
        return null;
      }

      return parseResult.data;

    } catch (error) {
      Sentry.captureException(error);
      throw error;
    }
  }

  async addExpense(expense: Omit<Expense, 'id' | 'createdAt'>): Promise<Expense> {
    try {
      if (!auth.currentUser || auth.currentUser.uid !== expense.userId) {
        throw new AppException(AppErrorCode.UNAUTHORIZED, 'Unauthorized add expense operation');
      }

      // Zod Validation
      const validation = ExpenseSchema.safeParse(expense);
      if (!validation.success) {
        throw new AppException(AppErrorCode.INVALID_ARGUMENT, `Invalid expense data: ${validation.error.message}`);
      }

      const validExpense = validation.data;
      const now = Timestamp.now();

      const docRef = await addDoc(collection(db, this.EXPENSES_COLLECTION), {
        ...validExpense,
        createdAt: now
      });

      return {
        id: docRef.id,
        ...validExpense,
        createdAt: now.toDate().toISOString()
      };
    } catch (error) {
      Sentry.captureException(error);
      throw error;
    }
  }

  /**
   * Get all expenses for a user.
   */
  async getExpenses(userId: string): Promise<Expense[]> {
    try {
      if (!auth.currentUser || auth.currentUser.uid !== userId) {
        throw new AppException(AppErrorCode.UNAUTHORIZED, 'Unauthorized get expenses operation');
      }
      const q = query(
        collection(db, this.EXPENSES_COLLECTION),
        where('userId', '==', userId),
        orderBy('createdAt', 'desc'),
        limit(100)
      );

      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          // Handle Timestamp conversion if coming from Firestore
          createdAt: (data.createdAt instanceof Timestamp) ? data.createdAt.toDate().toISOString() : data.createdAt
        } as Expense;
      });
    } catch (error) {
      Sentry.captureException(error);
      throw error;
    }
  }

  /**
   * Subscribe to expenses for real-time updates.
   */
  subscribeToExpenses(userId: string, callback: (expenses: Expense[]) => void): () => void {
    if (!auth.currentUser || auth.currentUser.uid !== userId) {
      logger.error('Unauthorized subscribe to expenses');
      return () => { };
    }

    const q = query(
      collection(db, this.EXPENSES_COLLECTION),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc'),
      limit(100)
    );

    return onSnapshot(q, (snapshot) => {
      const expenses = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          createdAt: (data.createdAt instanceof Timestamp) ? data.createdAt.toDate().toISOString() : data.createdAt
        } as Expense;
      });
      callback(expenses);
    }, (error) => {
      logger.error("Error subscribing to expenses:", error);
      Sentry.captureException(error);
    });
  }

  /**
   * Subscribe to earnings reports for real-time updates.
   */
  subscribeToEarnings(userId: string, callback: (earnings: EarningsSummary | null) => void): () => void {
    if (!auth.currentUser || auth.currentUser.uid !== userId) {
      logger.error('Unauthorized subscribe to earnings');
      return () => { };
    }

    const q = query(
      collection(db, FinanceService.EARNINGS_COLLECTION),
      where('userId', '==', userId)
    );

    return onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        const docData = snapshot.docs[0].data();
        const parseResult = EarningsSummarySchema.safeParse(docData);

        if (parseResult.success) {
          callback(parseResult.data);
        } else {
          logger.error(`[FinanceService] Earnings snapshot validation failed:`, parseResult.error);
          callback(null);
        }
      } else {
        callback(null);
      }
    }, (error) => {
      logger.error("Error subscribing to earnings:", error);
      Sentry.captureException(error);
    });
  }
}

export const financeService = new FinanceService();
