
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
  onSnapshot
} from 'firebase/firestore';
import {
  EarningsSummarySchema,
  type EarningsSummary as ValidatedEarningsSummary
} from '@/services/revenue/schema';
import { ExpenseSchema, type Expense } from '@/modules/finance/schemas';

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

export type { Expense };

export class FinanceService {
  private readonly EXPENSES_COLLECTION = 'expenses';
  static EARNINGS_COLLECTION = 'earnings_reports';

  /**
   * Get earnings summary for dashboard (RevenueService aggregation).
   */
  async getEarningsSummary(userId: string): Promise<EarningsSummary> {
    if (!auth.currentUser || (auth.currentUser.uid !== userId && userId !== 'guest')) {
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
  async fetchEarnings(userId: string): Promise<ValidatedEarningsSummary | null> {
    try {
      if (!auth.currentUser || (auth.currentUser.uid !== userId && userId !== 'guest')) {
        throw new Error('Unauthorized');
      }

      const q = query(
        collection(db, FinanceService.EARNINGS_COLLECTION),
        where('userId', '==', userId),
      );

      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        console.info(`[FinanceService] No earnings data found for user: ${userId}`);
        return null;
      }

      const docData = snapshot.docs[0].data();

      // Zod Validation for Production Safety
      const parseResult = EarningsSummarySchema.safeParse(docData);

      if (!parseResult.success) {
        console.error(`[FinanceService] Earnings data validation failed for ${userId}:`, parseResult.error);
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
        orderBy('createdAt', 'desc')
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
      console.error('Unauthorized subscribe to expenses');
      return () => { };
    }

    const q = query(
      collection(db, this.EXPENSES_COLLECTION),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc')
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
      console.error("Error subscribing to expenses:", error);
      Sentry.captureException(error);
    });
  }

  /**
   * Subscribe to earnings reports for real-time updates.
   */
  subscribeToEarnings(userId: string, callback: (earnings: ValidatedEarningsSummary | null) => void): () => void {
    if (!auth.currentUser || (auth.currentUser.uid !== userId && userId !== 'guest')) {
      console.error('Unauthorized subscribe to earnings');
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
          console.error(`[FinanceService] Earnings snapshot validation failed:`, parseResult.error);
          callback(null);
        }
      } else {
        callback(null);
      }
    }, (error) => {
      console.error("Error subscribing to earnings:", error);
      Sentry.captureException(error);
    });
  }
}

export const financeService = new FinanceService();
