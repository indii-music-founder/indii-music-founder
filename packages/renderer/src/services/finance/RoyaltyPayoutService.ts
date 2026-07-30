import { collection, getDocs, query, where } from 'firebase/firestore';

import { auth, db } from '@/services/firebase';
import { logger } from '@/utils/logger';

export interface RoyaltyPayout {
    id?: string;
    /** Owner account for this obligation ledger. */
    userId?: string;
    artistId: string;
    artistName: string;
    recipientEmail?: string;
    amount: number;
    amountMicros?: number;
    currency: string;
    period: string;
    status: 'held_for_reconciliation' | 'pending' | 'processed' | 'failed';
    method: 'stripe' | 'wire' | 'manual';
    taxStatus?: 'not_calculated' | 'ready' | 'withheld';
}

/** Read-only renderer view over the backend-owned payout obligation ledger. */
export class RoyaltyPayoutService {
    async createPayout(_payout: Omit<RoyaltyPayout, 'id' | 'status'>): Promise<string> {
        throw new Error('Payout obligations are server-owned and cannot be created from the renderer.');
    }

    async finalizePayout(_payoutId: string, _status: 'processed' | 'failed' = 'processed'): Promise<void> {
        throw new Error('Payout state is server-owned and requires the audited payment workflow.');
    }

    async getPendingForPeriod(period: string): Promise<RoyaltyPayout[]> {
        try {
            const userId = auth.currentUser?.uid;
            if (!userId) throw new Error('Authentication is required to read payout obligations.');
            const snapshot = await getDocs(query(
                collection(db, 'payouts'),
                where('userId', '==', userId)
            ));
            const payouts: RoyaltyPayout[] = [];
            snapshot.forEach(document => {
                const payout = { id: document.id, ...document.data() } as RoyaltyPayout;
                if (
                    payout.period === period &&
                    (payout.status === 'held_for_reconciliation' || payout.status === 'pending')
                ) payouts.push(payout);
            });
            return payouts;
        } catch (error: unknown) {
            // ISSUE-1281: this used to return [] on failure, making "the read failed"
            // indistinguishable from "there are no pending payouts" — in a payment
            // OBLIGATION path, where that confusion means a missed payout. Fails
            // closed instead, matching the finance-domain convention (ISSUE-886/1277).
            logger.error('[Royalty] Failed to fetch pending payouts:', error);
            throw error instanceof Error
                ? error
                : new Error(`Failed to fetch pending payouts: ${String(error)}`);
        }
    }

    async generateCsv(payouts: RoyaltyPayout[]): Promise<string> {
        try {
            const headers = ['payoutId', 'artistId', 'artistName', 'amount', 'currency', 'method', 'period'];
            const rows = payouts.map(payout => [
                payout.id || '',
                payout.artistId,
                payout.artistName,
                payout.amount.toString(),
                payout.currency,
                payout.method,
                payout.period,
            ]);
            const csvCell = (value: string) => `"${value.replace(/"/g, '""')}"`;
            const csvContent = [
                headers.join(','),
                ...rows.map(row => row.map(csvCell).join(',')),
            ].join('\n');
            logger.info(`[Royalty] Generated CSV for ${payouts.length} payouts.`);
            return csvContent;
        } catch (error: unknown) {
            // ISSUE-1281: returning '' made a failed export look like a legitimately
            // empty file. A caller writing that to disk would ship an empty payout
            // run and never know.
            logger.error('[Royalty] CSV generation failed:', error);
            throw error instanceof Error
                ? error
                : new Error(`Payout CSV generation failed: ${String(error)}`);
        }
    }
}

export const royaltyPayout = new RoyaltyPayoutService();
