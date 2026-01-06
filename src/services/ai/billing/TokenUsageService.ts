import { db } from '@/services/firebase';
import { doc, getDoc, setDoc, updateDoc, increment, serverTimestamp } from 'firebase/firestore';
import { RATE_LIMITS, TIER_CONFIG } from '@/core/config/rate-limits';
import { AppErrorCode, AppException } from '@/shared/types/errors';

export interface UsageStats {
    date: string; // YYYY-MM-DD
    tokensUsed: number;
    requestCount: number;
    lastUpdated: any;
}

export class TokenUsageService {
    private static readonly COLLECTION = 'user_usage_stats';

    /**
     * Track usage for a user.
     * Increments daily counters for tokens and requests.
     */
    static async trackUsage(userId: string, model: string, inputTokens: number, outputTokens: number): Promise<void> {
        if (!userId) return;

        const today = new Date().toISOString().split('T')[0];
        const docId = `${userId}_${today}`;
        const ref = doc(db, this.COLLECTION, docId);

        const totalTokens = inputTokens + outputTokens;

        try {
            await updateDoc(ref, {
                tokensUsed: increment(totalTokens),
                requestCount: increment(1),
                lastUpdated: serverTimestamp()
            });
        } catch (error: any) {
            // If doc doesn't exist, create it (atomic upsert not strictly possible without transaction, but error handling covers it)
            if (error?.code === 'not-found') {
                await setDoc(ref, {
                    userId,
                    date: today,
                    tokensUsed: totalTokens,
                    requestCount: 1,
                    lastUpdated: serverTimestamp()
                });
            }
            // Non-blocking error - usage tracking failure should not disrupt service
        }
    }

    /**
     * Check if a user has exceeded their daily quota.
     * Returns true if request is allowed, false if blocked.
     * Throws QuotaExceededError if blocked.
     */
    static async checkQuota(userId: string): Promise<boolean> {
        if (!userId) return true; // Fail open if no user (e.g. system tasks)

        const today = new Date().toISOString().split('T')[0];
        const docId = `${userId}_${today}`;
        const ref = doc(db, this.COLLECTION, docId);

        try {
            const snap = await getDoc(ref);

            if (!snap.exists()) return true; // No usage yet today

            const data = snap.data() as UsageStats;
            // For now, use default tier limit. Tier-aware quota checking can be added when subscription system is fully integrated
            const limit = RATE_LIMITS[TIER_CONFIG.DEFAULT_TIER].MAX_TOKENS_PER_DAY;

            if (data.tokensUsed >= limit) {
                throw new AppException(
                    AppErrorCode.NETWORK_ERROR, // Mapping to existing error code for "quota"
                    `Daily AI token limit exceeded (${limit} tokens). Please upgrade to Pro.`
                );
            }

            return true;
        } catch (error) {
            if (error instanceof AppException) throw error;
            // Fail open on DB error to avoid blocking service
            return true;
        }
    }
}
