import { db } from '@/services/firebase';
import * as Sentry from '@sentry/react';
import {
    collection,
    addDoc,
    getDocs,
    query,
    where,
    orderBy,
    serverTimestamp,
    Timestamp
} from 'firebase/firestore';
import { EarningsSummary } from '@/services/ddex/types/dsr';
import { revenueService } from '@/services/RevenueService';

export interface Expense {
    id: string;
    userId: string;
    vendor: string;
    date: string;
    amount: number;
    category: string;
    description: string;
    receiptUrl?: string;
    createdAt?: string;
}

export class FinanceService {
    private static EXPENSES_COLLECTION = 'expenses';

    /**
     * Add a new expense to Firestore.
     */
    static async addExpense(expense: Omit<Expense, 'id' | 'createdAt'>): Promise<string> {
        const expenseData = {
            ...expense,
            createdAt: serverTimestamp(),
        };

        try {
            const docRef = await addDoc(collection(db, this.EXPENSES_COLLECTION), expenseData);
            return docRef.id;
        } catch (error) {
            Sentry.captureException(error);
            throw error;
        }
    }

    /**
     * Get all expenses for a user.
     */
    static async getExpenses(userId: string): Promise<Expense[]> {
        try {
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
                    createdAt: (data.createdAt as Timestamp)?.toDate().toISOString()
                } as Expense;
            });
        } catch (error) {
            Sentry.captureException(error);
            throw error;
        }
    }

    /**
     * Fetch earnings summary.
     * @param userId The user ID to fetch earnings for.
     * @param period Optional date range filter.
     */
    static async fetchEarnings(userId: string, period?: { startDate: string; endDate: string }): Promise<EarningsSummary> {
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

            const byRelease = Object.entries(revenueStats.revenueByProduct).map(([productId, amount]) => ({
                releaseId: productId,
                releaseName: `Product ${productId}`, // Placeholder name until we look up product details
                revenue: amount,
                streams: 0,
                downloads: 0
            }));

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
}
