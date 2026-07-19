import { db } from '@/services/firebase';
import {
    collection,
    doc,
    setDoc,
    getDoc,
    getDocs,
    query,
    where,
    orderBy,
    serverTimestamp,
    Timestamp,
} from 'firebase/firestore';
import { logger } from '@/utils/logger';
import { v4 as uuidv4 } from 'uuid';
import { predictiveRoyaltyService } from './PredictiveRoyaltyService';


/**
 * Item 312: Label Deal Recoupment Tracking
 *
 * Tracks label advance amounts, recoupment thresholds, and royalty rate
 * escalators for artists on label deals who use indii. Critical for
 * artists to understand when they've recouped and start earning royalties.
 *
 * Data model:
 *   labelDeals/{dealId} → advance, recoupmentThreshold, royaltyRate, escalators
 *   labelDeals/{dealId}/transactions/{txId} → earnings applied toward recoupment
 */

export interface LabelDeal {
    id: string;
    userId: string;
    labelName: string;
    dealType: 'standard' | 'distribution' | 'licensing' | '360';
    advanceAmount: number;
    recoupmentThreshold: number;
    currentRecouped: number;
    royaltyRatePreRecoup: number;
    royaltyRatePostRecoup: number;
    currency: string;
    startDate: string;
    endDate?: string;
    status: 'active' | 'recouped' | 'expired' | 'terminated';
    escalators: RoyaltyEscalator[];
    notes?: string;
    createdAt: Timestamp;
    updatedAt: Timestamp;
}

export interface RoyaltyEscalator {
    /** Number of units (streams, sales, etc.) to trigger escalation */
    unitThreshold: number;
    /** New royalty rate after reaching threshold */
    newRate: number;
    /** Type of unit (e.g., 'streams', 'sales', 'revenue') */
    unitType: 'streams' | 'sales' | 'revenue';
    /** Whether this escalator has been triggered */
    triggered: boolean;
}

export interface RecoupmentTransaction {
    id: string;
    dealId: string;
    amount: number;
    source: 'streaming' | 'sync' | 'mechanical' | 'performance' | 'merch' | 'other';
    description: string;
    periodStart: string;
    periodEnd: string;
    createdAt: Timestamp;
}

export interface RecoupmentSummary {
    deal: LabelDeal;
    totalRecouped: number;
    remainingToRecoup: number;
    recoupmentPercent: number;
    isRecouped: boolean;
    estimatedRecoupmentDate: string | null;
    currentEffectiveRate: number;
    recentTransactions: RecoupmentTransaction[];
}

class LabelDealRecoupmentService {
    // NOTE: must match the Firestore rule at firestore.rules `match /label_deals/{dealId}`
    // — this collection name previously read 'labelDeals' (camelCase), a silent mismatch
    // that made every read/write here hit the default-deny catch-all.
    private readonly dealsCollection = 'label_deals';

    /**
     * Create a new label deal for tracking
     */
    async createDeal(
        userId: string,
        dealData: Omit<LabelDeal, 'id' | 'currentRecouped' | 'status' | 'createdAt' | 'updatedAt'>
    ): Promise<LabelDeal> {
        const id = uuidv4();
        const deal: LabelDeal = {
            ...dealData,
            id,
            userId,
            currentRecouped: 0,
            status: 'active',
            createdAt: serverTimestamp() as Timestamp,
            updatedAt: serverTimestamp() as Timestamp,
        };

        await setDoc(doc(db, this.dealsCollection, id), deal);
        logger.info(`[LabelDeal] Created deal ${id} for user ${userId}: ${dealData.labelName}`);
        return deal;
    }

    /**
     * Record earnings applied toward recoupment
     */
    async recordTransaction(
        dealId: string,
        tx: Omit<RecoupmentTransaction, 'id' | 'dealId' | 'createdAt'>
    ): Promise<RecoupmentTransaction> {
        const txId = uuidv4();
        const transaction: RecoupmentTransaction = {
            ...tx,
            id: txId,
            dealId,
            createdAt: serverTimestamp() as Timestamp,
        };

        // Write transaction
        await setDoc(
            doc(db, this.dealsCollection, dealId, 'transactions', txId),
            transaction
        );

        // Update running total on the deal
        const dealRef = doc(db, this.dealsCollection, dealId);
        const dealSnap = await getDoc(dealRef);
        if (dealSnap.exists()) {
            const deal = dealSnap.data() as LabelDeal;
            const newRecouped = deal.currentRecouped + tx.amount;
            const isRecouped = newRecouped >= deal.recoupmentThreshold;

            await setDoc(dealRef, {
                currentRecouped: newRecouped,
                status: isRecouped ? 'recouped' : deal.status,
                updatedAt: serverTimestamp(),
            }, { merge: true });

            if (isRecouped) {
                logger.info(`[LabelDeal] Deal ${dealId} RECOUPED! ($${newRecouped.toFixed(2)} / $${deal.recoupmentThreshold.toFixed(2)})`);
            }
        }

        return transaction;
    }

    /**
     * Get recoupment summary for a specific deal
     */
    async getRecoupmentSummary(dealId: string): Promise<RecoupmentSummary | null> {
        const dealSnap = await getDoc(doc(db, this.dealsCollection, dealId));
        if (!dealSnap.exists()) return null;

        const deal = dealSnap.data() as LabelDeal;

        // Get recent transactions
        const txQuery = query(
            collection(db, this.dealsCollection, dealId, 'transactions'),
            orderBy('createdAt', 'desc')
        );
        const txSnap = await getDocs(txQuery);
        const transactions = txSnap.docs.map(d => d.data() as RecoupmentTransaction);

        const totalRecouped = deal.currentRecouped;
        const remainingToRecoup = Math.max(0, deal.recoupmentThreshold - totalRecouped);
        const recoupmentPercent = deal.recoupmentThreshold > 0
            ? Math.min(100, (totalRecouped / deal.recoupmentThreshold) * 100)
            : 100;

        // Estimate recoupment date based on predictive regression forecast
        let estimatedRecoupmentDate: string | null = null;
        if (!deal.status.includes('recouped') && transactions.length >= 3) {
            const historicalEarnings = transactions.map(t => ({
                date: t.periodStart || new Date(t.createdAt?.seconds ? t.createdAt.seconds * 1000 : Date.now()).toISOString().split('T')[0]!,
                amount: t.amount
            }));
            const horizon = predictiveRoyaltyService.calculateHorizon(
                historicalEarnings,
                deal.recoupmentThreshold,
                deal.currentRecouped,
                deal.escalators,
                deal.royaltyRatePreRecoup,
                deal.royaltyRatePostRecoup
            );
            estimatedRecoupmentDate = horizon.estimatedRecoupmentDate;
        }

        // Determine effective royalty rate based on escalators
        let currentEffectiveRate = deal.status === 'recouped'
            ? deal.royaltyRatePostRecoup
            : deal.royaltyRatePreRecoup;

        for (const escalator of deal.escalators) {
            if (escalator.triggered) {
                currentEffectiveRate = escalator.newRate;
            }
        }

        return {
            deal,
            totalRecouped,
            remainingToRecoup,
            recoupmentPercent,
            isRecouped: deal.status === 'recouped',
            estimatedRecoupmentDate,
            currentEffectiveRate,
            recentTransactions: transactions.slice(0, 10),
        };
    }

    /**
     * Get all deals for a user
     */
    async getUserDeals(userId: string): Promise<LabelDeal[]> {
        const q = query(
            collection(db, this.dealsCollection),
            where('userId', '==', userId),
            orderBy('createdAt', 'desc')
        );
        const snap = await getDocs(q);
        return snap.docs.map(d => d.data() as LabelDeal);
    }
}

export const labelDealRecoupmentService = new LabelDealRecoupmentService();
