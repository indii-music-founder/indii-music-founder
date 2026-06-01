import { db } from '@/services/firebase';
import { doc, getDoc, setDoc, updateDoc, increment, serverTimestamp, FieldValue } from 'firebase/firestore';
import { RATE_LIMITS, TIER_CONFIG } from '@/core/config/rate-limits';
import { AppErrorCode, AppException } from '@/shared/types/errors';
import { logger } from '@/utils/logger';
import { isFirebaseE2EMockEnabled } from '@/utils/e2eMode';
import { estimateCostUsd, sanitizeModelKey } from './ModelPricing';

/** Per-model cost breakdown stored inside each daily usage doc. */
export interface ModelCostBreakdown {
    model: string;
    inputTokens: number;
    outputTokens: number;
    requestCount: number;
    costUsd: number;
}

export interface UsageStats {
    date: string; // YYYY-MM-DD
    tokensUsed: number;
    /** Input (prompt) tokens, kept separate from output for accurate cost reconstruction. */
    inputTokens?: number;
    /** Output (candidate) tokens. */
    outputTokens?: number;
    requestCount: number;
    /** Estimated spend in USD for the day (sum across all models). */
    estimatedCostUsd?: number;
    /** Per-model breakdown, keyed by sanitizeModelKey(model). */
    models?: Record<string, ModelCostBreakdown>;
    lastUpdated: FieldValue | Date | null;
}

export interface RateLimitStats {
    count: number;
    lastUpdated: FieldValue | Date | null;
}

/** Extra usage units for media models (image/video/speech) priced per-unit, not per-token. */
export interface MediaUsageUnits {
    images?: number;
    seconds?: number;
    characters?: number;
}

/** Aggregated cost report across a date range — the answer to "what does this user cost me?". */
export interface CostSummary {
    userId: string;
    startDate: string;
    endDate: string;
    totalCostUsd: number;
    totalTokens: number;
    totalRequests: number;
    /** Number of distinct days that had recorded usage in the window. */
    daysWithUsage: number;
    /** totalCostUsd / daysWithUsage (0 if no usage). */
    averageDailyCostUsd: number;
    /** averageDailyCostUsd × 30 — the headline number for per-user pricing decisions. */
    projectedMonthlyCostUsd: number;
    /** Per-model breakdown, sorted by costUsd descending (most expensive first). */
    byModel: ModelCostBreakdown[];
}

export class TokenUsageService {
    private static readonly USAGE_COLLECTION = 'user_usage_stats';
    private static readonly RATE_LIMIT_COLLECTION = 'user_rate_limits';

    /**
     * EMERGENCY KILL-SWITCH
     * Set this to true to immediately halt all intelligence operations.
     * This bypasses all logic and throws an error to prevent API costs.
     *
     * HOLD: ON pending Firebase billing resolution (2026-05-15). Set to false
     * once billing is restored.
     */
    private static readonly GLOBAL_EMERGENCY_STOP = false;

    private static get isE2EMode(): boolean {
        return isFirebaseE2EMockEnabled();
    }

    /**
     * Track usage for a user.
     *
     * Increments daily counters for tokens and requests, AND attributes estimated
     * USD spend per model so unit economics are queryable via getCostSummary().
     *
     * Cost is estimated via ModelPricing (a real-time proxy; GCP Billing is ground
     * truth). Input/output tokens are stored separately because they are priced
     * differently — summing them would destroy the ability to compute real cost.
     *
     * @param userId      Authenticated user ID (required).
     * @param model       Exact model ID (e.g. 'gemini-3.1-pro-preview').
     * @param inputTokens Prompt tokens from usageMetadata.promptTokenCount.
     * @param outputTokens Candidate tokens from usageMetadata.candidatesTokenCount.
     * @param mediaUnits  Optional per-unit quantities for image/video/speech models.
     */
    static async trackUsage(
        userId: string,
        model: string,
        inputTokens: number,
        outputTokens: number,
        mediaUnits?: MediaUsageUnits
    ): Promise<void> {
        if (this.isE2EMode) return;
        if (!userId) {
            throw new AppException(AppErrorCode.AUTH_ERROR, 'Authenticated user is required to track token usage.');
        }

        const today = new Date().toISOString().split('T')[0];
        const docId = `${userId}_${today}`;
        const ref = doc(db, this.USAGE_COLLECTION, docId);

        const totalTokens = inputTokens + outputTokens;
        const costUsd = estimateCostUsd(model, { inputTokens, outputTokens, ...mediaUnits });
        const modelKey = sanitizeModelKey(model);

        try {
            await updateDoc(ref, {
                tokensUsed: increment(totalTokens),
                inputTokens: increment(inputTokens),
                outputTokens: increment(outputTokens),
                requestCount: increment(1),
                estimatedCostUsd: increment(costUsd),
                [`models.${modelKey}.model`]: model,
                [`models.${modelKey}.inputTokens`]: increment(inputTokens),
                [`models.${modelKey}.outputTokens`]: increment(outputTokens),
                [`models.${modelKey}.requestCount`]: increment(1),
                [`models.${modelKey}.costUsd`]: increment(costUsd),
                lastUpdated: serverTimestamp()
            });
        } catch (error: unknown) {
            // If doc doesn't exist, create it (atomic upsert not strictly possible without transaction, but error handling covers it)
            if (error && typeof error === 'object' && 'code' in error && (error as { code: string }).code === 'not-found') {
                await setDoc(ref, {
                    userId,
                    date: today,
                    tokensUsed: totalTokens,
                    inputTokens,
                    outputTokens,
                    requestCount: 1,
                    estimatedCostUsd: costUsd,
                    models: {
                        [modelKey]: {
                            model,
                            inputTokens,
                            outputTokens,
                            requestCount: 1,
                            costUsd
                        }
                    },
                    lastUpdated: serverTimestamp()
                });
                return;
            }
            throw new AppException(
                AppErrorCode.INTERNAL_ERROR,
                'Token usage tracking failed. Operation blocked to prevent untracked spend.',
                { originalError: error instanceof Error ? error.message : String(error) }
            );
        }
    }

    /**
     * Check if a user has exceeded their daily quota.
     * Returns true if request is allowed, false if blocked.
     * Throws QuotaExceededError if blocked.
     */
    static async checkQuota(userId: string): Promise<boolean> {
        if (this.isE2EMode) return true;
        if (this.GLOBAL_EMERGENCY_STOP) {
            throw new AppException(
                AppErrorCode.QUOTA_EXCEEDED,
                'EMERGENCY STOP: Intelligence services are temporarily suspended for cost protection. Please contact support.'
            );
        }
        if (!userId) {
            throw new AppException(AppErrorCode.AUTH_ERROR, 'Authenticated user is required for quota checks.');
        }

        const today = new Date().toISOString().split('T')[0];
        const docId = `${userId}_${today}`;
        const ref = doc(db, this.USAGE_COLLECTION, docId);

        try {
            const snap = await getDoc(ref);

            if (!snap || typeof snap.exists !== 'function') return true; // Safe fallback for tests with incomplete mocks

            if (!snap.exists()) return true; // No usage yet today

            const data = snap.data() as UsageStats;
            // For now, use default tier limit. Tier-aware quota checking can be added when subscription system is fully integrated
            const limit = RATE_LIMITS[TIER_CONFIG.DEFAULT_TIER].MAX_TOKENS_PER_DAY;

            if (data.tokensUsed >= limit) {
                throw new AppException(
                    AppErrorCode.QUOTA_EXCEEDED,
                    `Daily Intelligence token limit exceeded (${limit} tokens). Please upgrade to Pro.`
                );
            }

            return true;
        } catch (error: unknown) {
            if (error instanceof AppException) throw error;
            throw new AppException(
                AppErrorCode.INTERNAL_ERROR,
                'Quota check failed. Operation blocked to prevent untracked spend.',
                { originalError: error instanceof Error ? error.message : String(error) }
            );
        }
    }

    /**
     * Check if a user has exceeded their per-minute rate limit.
     * Uses a minute-bucket strategy in Firestore.
     */
    static async checkRateLimit(userId: string): Promise<void> {
        if (this.isE2EMode) return;
        if (this.GLOBAL_EMERGENCY_STOP) {
            throw new AppException(
                AppErrorCode.RATE_LIMITED,
                'EMERGENCY STOP: Intelligence services are temporarily suspended.'
            );
        }
        if (!userId) {
            throw new AppException(AppErrorCode.AUTH_ERROR, 'Authenticated user is required for rate-limit checks.');
        }

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
        } catch (error: unknown) {
            if (error instanceof AppException) throw error;
            logger.error('Rate limit check failed. Blocking operation:', error);
            throw new AppException(
                AppErrorCode.INTERNAL_ERROR,
                'Rate limit check failed. Operation blocked to prevent untracked spend.',
                { originalError: error instanceof Error ? error.message : String(error) }
            );
        }
    }

    /**
     * Enumerate inclusive YYYY-MM-DD date strings from start to end.
     * Iterates in UTC to match the docId date scheme used by trackUsage.
     */
    private static enumerateDates(startDate: string, endDate: string): string[] {
        const dates: string[] = [];
        const start = new Date(`${startDate}T00:00:00.000Z`);
        const end = new Date(`${endDate}T00:00:00.000Z`);
        if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) {
            return dates;
        }
        // Hard cap to avoid runaway reads on a malformed range (≈ 2 years).
        const MAX_DAYS = 731;
        const cursor = new Date(start);
        while (cursor <= end && dates.length < MAX_DAYS) {
            dates.push(cursor.toISOString().split('T')[0]);
            cursor.setUTCDate(cursor.getUTCDate() + 1);
        }
        return dates;
    }

    /**
     * Aggregate a user's estimated AI spend across an inclusive date range.
     *
     * This is the answer to "what does this user cost me per month?" — it sums
     * daily usage docs, rolls up per-model spend, and projects a monthly cost from
     * the observed daily average. Reads one doc per day in the range (index-free),
     * which is appropriate for an analysis call, not a hot path.
     *
     * Estimates are a real-time proxy; reconcile against GCP Billing for ground truth.
     *
     * @param userId    Authenticated user ID.
     * @param startDate Inclusive start, YYYY-MM-DD.
     * @param endDate   Inclusive end, YYYY-MM-DD.
     */
    static async getCostSummary(userId: string, startDate: string, endDate: string): Promise<CostSummary> {
        const empty: CostSummary = {
            userId,
            startDate,
            endDate,
            totalCostUsd: 0,
            totalTokens: 0,
            totalRequests: 0,
            daysWithUsage: 0,
            averageDailyCostUsd: 0,
            projectedMonthlyCostUsd: 0,
            byModel: []
        };

        if (this.isE2EMode) return empty;
        if (!userId) {
            throw new AppException(AppErrorCode.AUTH_ERROR, 'Authenticated user is required for a cost summary.');
        }

        const dates = this.enumerateDates(startDate, endDate);
        if (dates.length === 0) {
            throw new AppException(
                AppErrorCode.INVALID_ARGUMENT,
                `Invalid date range for cost summary: ${startDate}..${endDate}`
            );
        }

        // Accumulate per-model totals across the range (keyed by raw model name).
        const modelTotals = new Map<string, ModelCostBreakdown>();
        let totalCostUsd = 0;
        let totalTokens = 0;
        let totalRequests = 0;
        let daysWithUsage = 0;

        try {
            for (const date of dates) {
                const snap = await getDoc(doc(db, this.USAGE_COLLECTION, `${userId}_${date}`));
                if (!snap || typeof snap.exists !== 'function' || !snap.exists()) continue;

                const data = snap.data() as UsageStats;
                daysWithUsage += 1;
                totalTokens += data.tokensUsed || 0;
                totalRequests += data.requestCount || 0;
                totalCostUsd += data.estimatedCostUsd || 0;

                for (const breakdown of Object.values(data.models ?? {})) {
                    const existing = modelTotals.get(breakdown.model) ?? {
                        model: breakdown.model,
                        inputTokens: 0,
                        outputTokens: 0,
                        requestCount: 0,
                        costUsd: 0
                    };
                    existing.inputTokens += breakdown.inputTokens || 0;
                    existing.outputTokens += breakdown.outputTokens || 0;
                    existing.requestCount += breakdown.requestCount || 0;
                    existing.costUsd += breakdown.costUsd || 0;
                    modelTotals.set(breakdown.model, existing);
                }
            }
        } catch (error: unknown) {
            if (error instanceof AppException) throw error;
            throw new AppException(
                AppErrorCode.INTERNAL_ERROR,
                'Cost summary aggregation failed.',
                { originalError: error instanceof Error ? error.message : String(error) }
            );
        }

        const averageDailyCostUsd = daysWithUsage > 0 ? totalCostUsd / daysWithUsage : 0;
        const byModel = Array.from(modelTotals.values()).sort((a, b) => b.costUsd - a.costUsd);

        return {
            userId,
            startDate,
            endDate,
            totalCostUsd,
            totalTokens,
            totalRequests,
            daysWithUsage,
            averageDailyCostUsd,
            projectedMonthlyCostUsd: averageDailyCostUsd * 30,
            byModel
        };
    }
}
