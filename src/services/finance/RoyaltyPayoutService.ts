import { logger } from '@/utils/logger';
import { Timestamp, FieldValue, getFirestore, collection, addDoc, getDocs, query, where, orderBy, updateDoc, doc } from 'firebase/firestore';
import { app } from '@/services/firebase';

export interface RoyaltyPayout {
    id?: string;
    artistId: string;
    artistName: string;
    amount: number;
    currency: string;
    period: string; // "2026-Q1"
    status: 'pending' | 'processed' | 'failed';
    method: 'stripe' | 'wire' | 'manual';
    processedAt?: Date | Timestamp | FieldValue;
}

export class RoyaltyPayoutService {
    private db = getFirestore(app);
    private collectionRef = collection(this.db, 'royalty_payouts');

    /**
     * Records a new payout in the ledger.
     */
    async createPayout(payout: Omit<RoyaltyPayout, 'id' | 'status'>): Promise<string> {
        try {
            const docRef = await addDoc(this.collectionRef, {
                ...payout,
                status: 'pending',
                createdAt: new Date()
            });
            logger.info(`[Royalty] Created pending payout for ${payout.artistName} (${payout.amount} ${payout.currency})`);
            return docRef.id;
        } catch (error) {
            logger.error('[Royalty] Failed to create payout:', error);
            throw error;
        }
    }

    /**
     * Mark a payout as processed.
     */
    async finalizePayout(payoutId: string, status: 'processed' | 'failed' = 'processed'): Promise<void> {
        try {
            const docRef = doc(this.db, 'royalty_payouts', payoutId);
            await updateDoc(docRef, {
                status,
                processedAt: new Date()
            });
            logger.info(`[Royalty] Payout ${payoutId} updated to ${status}`);
        } catch (error) {
            logger.error('[Royalty] Failed to finalize payout:', error);
        }
    }

    /**
     * Query all pending payouts for a period.
     */
    async getPendingForPeriod(period: string): Promise<RoyaltyPayout[]> {
        try {
            const q = query(
                this.collectionRef,
                where('period', '==', period),
                where('status', '==', 'pending')
            );
            const snapshot = await getDocs(q);
            const payouts: RoyaltyPayout[] = [];
            snapshot.forEach(doc => {
                payouts.push({ id: doc.id, ...doc.data() } as RoyaltyPayout);
            });
            return payouts;
        } catch (error) {
            logger.error('[Royalty] Failed to fetch pending payouts:', error);
            return [];
        }
    }

    /**
     * One-click CSV export for offline bank batch processing.
     */
    async generateCsv(payouts: RoyaltyPayout[]): Promise<string> {
        try {
            const headers = ['payoutId', 'artistId', 'artistName', 'amount', 'currency', 'method', 'period'];
            const rows = payouts.map(p => [
                p.id || '',
                p.artistId,
                p.artistName,
                p.amount.toString(),
                p.currency,
                p.method,
                p.period
            ]);

            const csvContent = [
                headers.join(','),
                ...rows.map(r => r.map(cell => `"${cell}"`).join(','))
            ].join('\n');

            logger.info(`[Royalty] Generated CSV for ${payouts.length} payouts.`);
            return csvContent;
        } catch (error) {
            logger.error('[Royalty] CSV generation failed:', error);
            return '';
        }
    }
}

export const royaltyPayout = new RoyaltyPayoutService();
