/**
 * InfluencerBountyService.ts
 * 
 * Manages micro-influencer referral links, payout tracking, and bounty completion logic.
 * Fulfills PRODUCTION_200 item #149.
 */

import { logger } from '@/utils/logger';
export interface BountyLink {
    id: string;
    influencerId: string;
    targetUrl: string; // e.g. Pre-save or Release link
    referralCode: string;
    totalClicks: number;
    totalConversions: number;
    earnedCommission: number; // in USD
    status: 'active' | 'paused' | 'completed';
}

export interface PersistedBountyLink {
    id: string;
    influencerHandle: string;
    trackName: string;
    rewardAmount: number;
    action?: string;
    referralCode: string;
    targetUrl: string;
    status: 'active' | 'paused' | 'completed';
    createdAt?: unknown;
}

export interface BountyPayout {
    id: string;
    influencerId: string;
    amount: number;
    currency: string;
    payoutStatus: 'pending' | 'processing' | 'paid' | 'failed';
    processedAt?: number;
}

export class InfluencerBountyService {
    /**
     * Generates a unique tracked referral link for an influencer.
     */
    async generateBountyLink(influencerHandle: string, trackName: string, rewardAmount: number, action?: string): Promise<BountyLink> {
        const id = `bl_${Date.now()}`;
        logger.info(`[BountyService] Requesting link for ${influencerHandle} on ${trackName}`);

        try {
            const { functionsWest1 } = await import('@/services/firebase');
            const { httpsCallable } = await import('firebase/functions');

            interface BountyPayload {
                influencerHandle: string;
                trackName: string;
                rewardAmount: number;
                action?: string;
            }

            const createBountyFunction = httpsCallable<BountyPayload, { success: boolean; refCode: string; link: string }>(
                functionsWest1,
                'createInfluencerBounty'
            );

            const result = await createBountyFunction({
                influencerHandle,
                trackName,
                rewardAmount,
                action
            });

            if (!result.data.success) throw new Error("Bounty creation failed");

            const bounty: BountyLink = {
                id,
                influencerId: influencerHandle,
                targetUrl: result.data.link,
                referralCode: result.data.refCode,
                totalClicks: 0,
                totalConversions: 0,
                earnedCommission: 0,
                status: 'active'
            };

            return bounty;
        } catch (error: unknown) {
            logger.error(`[BountyService] Failed to create bounty:`, error);
            throw error;
        }
    }

    /**
     * Loads saved referral links for the authenticated user.
     */
    async listBountyLinks(): Promise<PersistedBountyLink[]> {
        try {
            const { auth, db } = await import('@/services/firebase');
            const uid = auth.currentUser?.uid;
            if (!uid) {
                return [];
            }

            const { collection, getDocs, query, where } = await import('firebase/firestore');
            const snapshot = await getDocs(
                query(
                    collection(db, 'influencerBounties'),
                    where('userId', '==', uid),
                )
            );

            const toMillis = (value: unknown): number => {
                if (typeof value === 'number') {
                    return value;
                }
                if (typeof value === 'string') {
                    const parsed = Date.parse(value);
                    return Number.isNaN(parsed) ? 0 : parsed;
                }
                if (value && typeof value === 'object' && 'toMillis' in value && typeof (value as { toMillis: () => number }).toMillis === 'function') {
                    return (value as { toMillis: () => number }).toMillis();
                }
                return 0;
            };

            return snapshot.docs
                .map((doc) => {
                    const data = doc.data() as Record<string, unknown>;
                    return {
                        id: doc.id,
                        influencerHandle: typeof data.influencerHandle === 'string' ? data.influencerHandle : '',
                        trackName: typeof data.trackName === 'string' ? data.trackName : '',
                        rewardAmount: typeof data.rewardAmount === 'number' ? data.rewardAmount : 0,
                        action: typeof data.action === 'string' ? data.action : undefined,
                        referralCode: typeof data.refCode === 'string' ? data.refCode : doc.id,
                        targetUrl: typeof data.link === 'string' ? data.link : '',
                        status: data.status === 'paused' || data.status === 'completed' ? data.status : 'active',
                        createdAt: data.createdAt,
                        _createdAtMillis: toMillis(data.createdAt),
                    } as PersistedBountyLink & { _createdAtMillis: number };
                })
                .filter((entry) => Boolean(entry.influencerHandle) && Boolean(entry.trackName) && Boolean(entry.targetUrl))
                .sort((a, b) => b._createdAtMillis - a._createdAtMillis)
                .map(({ _createdAtMillis: _createdAtMillis, ...entry }) => entry);
        } catch (error: unknown) {
            logger.error('[BountyService] Failed to load saved referral links:', error);
            return [];
        }
    }

    /**
     * Records a click or conversion event for a referral code.
     */
    async trackEvent(referralCode: string, type: 'click' | 'conversion'): Promise<void> {
        logger.warn(`[BountyService] Tracking unavailable for code ${referralCode}; event ${type} was not recorded.`);
        throw new Error('Influencer bounty tracking is not available until the event pipeline is deployed.');
    }

    /**
     * Triggers a payout to an influencer's connected Stripe account.
     */
    async initiatePayout(influencerId: string, amount: number): Promise<string> {
        logger.warn(`[BountyService] Payout unavailable for ${influencerId}; requested amount $${amount} was not transferred.`);
        throw new Error('Influencer bounty payouts are not available until Stripe transfer automation is deployed.');
    }

    /**
     * Fetches top-performing influencers for an artist's organization.
     */
    async getTopInfluencers(orgId: string) {
        logger.warn(`[BountyService] Leaderboard unavailable for org ${orgId}; tracking and payout workers are not deployed yet.`);
        return [];
    }
}

export const influencerBountyService = new InfluencerBountyService();
