import { serverTimestamp, query, where, orderBy, limit, Timestamp } from 'firebase/firestore';
import { auth } from '@/services/firebase';
import { FirestoreService } from '@/services/FirestoreService';
import type { EarningsDocument } from '@/types/firestore';
import type { DateRange } from '@/services/ddex/types/common';
import type { DistributorEarnings, DistributorId } from './types/distributor';
import { logger } from '@/utils/logger';

/**
 * Earnings Service
 * Manages tracking of digital sales revenue and stream counts from DSPs.
 */
export class EarningsService extends FirestoreService<EarningsDocument> {
    constructor() {
        super('earnings');
    }

    /**
     * Get earnings for a specific release from a specific distributor
     */
    async getEarnings(distributorId: string, releaseId: string, period?: DateRange): Promise<DistributorEarnings | null> {
        try {
            const userId = auth.currentUser?.uid;
            if (!userId) return null;

            const baseConstraints = [
                this.where('userId', '==', userId),
                this.where('distributorId', '==', distributorId),
                this.where('releaseId', '==', releaseId)
            ];

            const constraints = period ? [
                ...baseConstraints,
                this.where('period.startDate', '==', period.startDate),
                this.where('period.endDate', '==', period.endDate)
            ] : [
                ...baseConstraints,
                this.orderBy('period.endDate', 'desc'),
                limit(1)
            ];

            const results = await this.list(constraints);
            if (results.length === 0) return null;

            const doc = results[0]!;
            return this.mapToEarnings(doc);
        } catch (error) {
            logger.error('[EarningsService] Failed to fetch earnings:', error);
            return null;
        }
    }

    /**
     * Get all earnings for a distributor (optionally filtered by period)
     */
    async getAllEarnings(distributorId: string, period?: DateRange): Promise<DistributorEarnings[]> {
        try {
            const userId = auth.currentUser?.uid;
            if (!userId) return [];

            const constraints = [
                this.where('userId', '==', userId),
                this.where('distributorId', '==', distributorId)
            ];

            if (period) {
                constraints.push(
                    this.where('period.startDate', '>=', period.startDate),
                    this.where('period.endDate', '<=', period.endDate)
                );
            }

            const results = await this.list(constraints);
            return results.map(this.mapToEarnings);
        } catch (error) {
            logger.error('[EarningsService] Failed to fetch all earnings:', error);
            return [];
        }
    }

    /**
     * Record new earnings data (Ingest)
     */
    async recordEarnings(data: Omit<EarningsDocument, 'id' | 'createdAt' | 'updatedAt' | 'userId'>): Promise<string> {
        try {
            const userId = auth.currentUser?.uid;
            if (!userId) throw new Error('User not authenticated');

            const earningsId = `${data.distributorId}_${data.releaseId}_${data.period.startDate}_${data.period.endDate}`;

            const record: EarningsDocument = {
                ...data,
                userId,
                id: earningsId,
                createdAt: serverTimestamp() as unknown as Timestamp,
                updatedAt: serverTimestamp() as unknown as Timestamp
            };

            await this.set(earningsId, record);
            return earningsId;
        } catch (error) {
            logger.error('[EarningsService] Failed to record earnings:', error);
            throw error;
        }
    }

    private mapToEarnings(doc: EarningsDocument): DistributorEarnings {
        return {
            ...doc,
            distributorId: doc.distributorId as DistributorId,
            lastUpdated: doc.updatedAt.toDate().toISOString()
        };
    }
}

export const earningsService = new EarningsService();
