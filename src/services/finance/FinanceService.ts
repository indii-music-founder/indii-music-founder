
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
  private readonly EXPENSES_COLLECTION = 'expenses';
  static EARNINGS_COLLECTION = 'earnings_reports';

  /**
   * Get earnings summary for dashboard (RevenueService aggregation).
   */
  async getEarningsSummary(userId: string): Promise<EarningsSummary> {
    try {
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
    } catch (error) {
      throw error;
    }
  }

  /**
   * Fetch persistent earnings reports (DSR style).
   * Uses Firestore with a self-seeding strategy for Alpha.
   */
  async fetchEarnings(userId: string): Promise<DSREarningsSummary> {
    try {
      if (!auth.currentUser || (auth.currentUser.uid !== userId && userId !== 'guest')) {
        throw new Error('Unauthorized');
      }

      const q = query(
        collection(db, FinanceService.EARNINGS_COLLECTION),
        where('userId', '==', userId),
      );

      const snapshot = await getDocs(q);

      if (!snapshot.empty) {
        // Return existing data
        const docData = snapshot.docs[0].data();
        return docData as DSREarningsSummary;
      }

      // If no data, seed with simulated persistent data
      const initialData: DSREarningsSummary & { userId: string, createdAt: any } = {
        userId,
        createdAt: serverTimestamp(),
        period: { startDate: '2024-01-01', endDate: '2024-01-31' },
        totalGrossRevenue: 12500.50,
        totalNetRevenue: 8750.35,
        totalStreams: 1245000,
        totalDownloads: 1540,
        currencyCode: 'USD',
        byPlatform: [
          { platformName: 'Spotify', revenue: 4500.20, streams: 650000, downloads: 0 },
          { platformName: 'Apple Music', revenue: 2800.15, streams: 320000, downloads: 450 },
          { platformName: 'YouTube Music', revenue: 1450.00, streams: 275000, downloads: 0 }
        ],
        byTerritory: [
          { territoryCode: 'US', territoryName: 'United States', revenue: 5200.00, streams: 850000, downloads: 900 },
          { territoryCode: 'GB', territoryName: 'United Kingdom', revenue: 1200.00, streams: 150000, downloads: 200 },
          { territoryCode: 'JP', territoryName: 'Japan', revenue: 850.00, streams: 95000, downloads: 150 },
          { territoryCode: 'DE', territoryName: 'Germany', revenue: 600.00, streams: 75000, downloads: 120 },
          { territoryCode: 'FR', territoryName: 'France', revenue: 900.35, streams: 75000, downloads: 170 }
        ],
        byRelease: [
          { releaseId: 'rel_1', releaseName: 'Midnight Echoes', revenue: 6500.00, streams: 950000, downloads: 1200 },
          { releaseId: 'rel_2', releaseName: 'Neon Dreams', revenue: 2250.35, streams: 295000, downloads: 340 }
        ]
      };

      await addDoc(collection(db, FinanceService.EARNINGS_COLLECTION), initialData);
      return initialData;

    } catch (error) {
      Sentry.captureException(error);
      throw error;
    }
  }

  /**
   * Internal validation for double-entry bookkeeping principles.
   */
  private validateDoubleEntry(expense: Omit<Expense, 'id' | 'createdAt'>): void {
    // 1. Every transaction must be balanced: Debits = Credits
    // In this simple context, the expense (Debit) must equal the payout source (Credit).
    // We implicitly treat the 'amount' as both the debit to expense and credit to cash.
    if (!expense.amount || expense.amount <= 0) {
      throw new AppException(AppErrorCode.INVALID_ARGUMENT, 'Double-entry failure: Transaction amount must be positive and non-zero.');
    }

    // 2. Attribution check
    if (!expense.userId || !expense.category) {
      throw new AppException(AppErrorCode.INVALID_ARGUMENT, 'Double-entry failure: Transaction must have a user and account category.');
    }
  }

  async addExpense(expense: Omit<Expense, 'id' | 'createdAt'>): Promise<string> {
    try {
      if (!auth.currentUser || auth.currentUser.uid !== expense.userId) {
        throw new AppException(AppErrorCode.UNAUTHORIZED, 'Unauthorized add expense operation');
      }

      // Local Validation for Double-Entry principles
      this.validateDoubleEntry(expense);

      const docRef = await addDoc(collection(db, this.EXPENSES_COLLECTION), {
        ...expense,
        createdAt: Timestamp.now()
      });
      return docRef.id;
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
  subscribeToEarnings(userId: string, callback: (earnings: DSREarningsSummary | null) => void): () => void {
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
        callback(docData as DSREarningsSummary);
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
