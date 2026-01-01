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

    static EARNINGS_COLLECTION = 'earnings_reports';

    /**
     * Fetch earnings summary. Uses Firestore with a self-seeding strategy for Alpha.
     */
    static async fetchEarnings(userId: string): Promise<EarningsSummary> {
        try {
            // 1. Check if report exists for user
            const q = query(
                collection(db, this.EARNINGS_COLLECTION),
                where('userId', '==', userId),
                // In a real app we might query by month/year, here we just get the latest or default
            );

            const snapshot = await getDocs(q);

            if (!snapshot.empty) {
                // Return existing data
                const docData = snapshot.docs[0].data();
                return docData as EarningsSummary;
            }

            // 2. If no data, seed with simulated data
            console.log("No earnings data found, seeding initial report for user:", userId);
            const initialData: EarningsSummary & { userId: string, createdAt: any } = {
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

            await addDoc(collection(db, this.EARNINGS_COLLECTION), initialData);
            return initialData;

        } catch (error) {
            Sentry.captureException(error);
            console.error("Error fetching earnings:", error);
            throw error;
        }
    }
}
