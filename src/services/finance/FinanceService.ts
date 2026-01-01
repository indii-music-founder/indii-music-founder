import { revenueService as RevenueService } from '../RevenueService';
import { db } from '@/services/firebase';
import { collection, addDoc, getDocs, query, where, orderBy, Timestamp } from 'firebase/firestore';

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
      const stats = await RevenueService.getUserRevenueStats(userId);

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
