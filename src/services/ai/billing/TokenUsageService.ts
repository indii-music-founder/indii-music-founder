import { db } from '@/services/firebase';
import { doc, getDoc, setDoc, updateDoc, increment, serverTimestamp, FieldValue } from 'firebase/firestore';
import { RATE_LIMITS, TIER_CONFIG } from '@/core/config/rate-limits';
import { AppErrorCode, AppException } from '@/shared/types/errors';

export interface UsageStats {
    date: string; // YYYY-MM-DD
    tokensUsed: number;
    requestCount: number;
    lastUpdated: FieldValue | Date | null;
}

export interface RateLimitStats {
    count: number;
    lastUpdated: FieldValue | Date | null;
}

export class TokenUsageService {
    private static readonly USAGE_COLLECTION = 'user_usage_stats';
    private static readonly RATE_LIMIT_COLLECTION = 'user_rate_limits';

    /**
     * Track usage for a user.
     * Increments daily counters for tokens and requests.
     */
    static async trackUsage(userId: string, model: string, inputTokens: number, outputTokens: number): Promise<void> {
        if (!userId) return;

        const today = new Date().toISOString().split('T')[0];
        const docId = `${userId}_${today}`;
        const ref = doc(db, this.USAGE_COLLECTION, docId);

        const totalTokens = inputTokens + outputTokens;

        try {
            await updateDoc(ref, {
                tokensUsed: increment(totalTokens),
                requestCount: increment(1),
                lastUpdated: serverTimestamp()
            });
        } catch (error: unknown) {
            // If doc doesn't exist, create it (atomic upsert not strictly possible without transaction, but error handling covers it)
            if (error && typeof error === 'object' && 'code' in error && (error as { code: string }).code === 'not-found') {
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
        const ref = doc(db, this.USAGE_COLLECTION, docId);

        try {
            const snap = await getDoc(ref);

            if (!snap.exists()) return true; // No usage yet today

            const data = snap.data() as UsageStats;
            // For now, use default tier limit. Tier-aware quota checking can be added when subscription system is fully integrated
            const limit = RATE_LIMITS[TIER_CONFIG.DEFAULT_TIER].MAX_TOKENS_PER_DAY;

            if (data.tokensUsed >= limit) {
                throw new AppException(
                    AppErrorCode.QUOTA_EXCEEDED,
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

    /**
     * Check if a user has exceeded their per-minute rate limit.
     * Uses a minute-bucket strategy in Firestore.
     */
    static async checkRateLimit(userId: string): Promise<void> {
        if (!userId) return;

        // Current minute bucket ID: e.g. "user123_28475920"
        const currentMinute = Math.floor(Date.now() / 60000);
        const docId = `${userId}_${currentMinute}`;
        const ref = doc(db, this.RATE_LIMIT_COLLECTION, docId);

        try {
            // Optimistic check: Read before Write to save write costs if blocked
            // Note: This introduces a tiny race condition but is acceptable for rate limiting
            const snap = await getDoc(ref);

            const limit = RATE_LIMITS[TIER_CONFIG.DEFAULT_TIER].MAX_REQUESTS_PER_MINUTE;

            if (snap.exists()) {
                const data = snap.data() as RateLimitStats;
                if (data.count >= limit) {
                    throw new AppException(
                        AppErrorCode.RATE_LIMITED,
                        `Rate limit exceeded (${limit} requests/minute). Please slow down.`
                    );
                }

                // Increment
                await updateDoc(ref, {
                    count: increment(1),
                    lastUpdated: serverTimestamp()
                });
            } else {
                // First request of the minute
                await setDoc(ref, {
                    count: 1,
                    lastUpdated: serverTimestamp(),
                    expiresAt: serverTimestamp() // In a real setup, we'd want TTL, but Firestore TTL is background
                });
            }
        } catch (error) {
            if (error instanceof AppException) throw error;
            // Fail open on DB error to avoid blocking legitimate user service during outages
            console.error('Rate limit check failed (failing open):', error);
        }
    }
}
