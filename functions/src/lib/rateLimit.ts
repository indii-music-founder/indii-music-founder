import * as admin from "firebase-admin";
import * as functions from "firebase-functions/v1";

interface RateLimitConfig {
    maxRequests: number;    // Max requests in window
    windowMs: number;       // Window in milliseconds
    collection?: string;    // Firestore collection for tracking
}

const DEFAULT_CONFIG: RateLimitConfig = {
    maxRequests: 60,
    windowMs: 60 * 1000,  // 1 minute
    collection: "rate_limits",
};

/**
 * Rate limiter for Firebase callable functions.
 * Uses Firestore to track per-user request counts with sliding windows.
 *
 * Throws functions.https.HttpsError("resource-exhausted") when limit exceeded.
 */
export async function enforceRateLimit(
    userId: string,
    endpoint: string,
    config: Partial<RateLimitConfig> = {}
): Promise<void> {
    const { maxRequests, windowMs, collection } = { ...DEFAULT_CONFIG, ...config };
    const now = Date.now();
    const windowStart = now - windowMs;
    const docId = `${userId}_${endpoint}`;

    const ref = admin.firestore().collection(collection!).doc(docId);

    await admin.firestore().runTransaction(async (tx) => {
        const doc = await tx.get(ref);
        const data = doc.data();

        if (!data) {
            // First request - create the record
            tx.set(ref, {
                userId,
                endpoint,
                requests: [now],
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            return;
        }

        // Filter to only requests within the current window
        const recentRequests: number[] = (data.requests || []).filter(
            (ts: number) => ts > windowStart
        );

        if (recentRequests.length >= maxRequests) {
            const retryAfterMs = recentRequests[0] + windowMs - now;
            throw new functions.https.HttpsError(
                "resource-exhausted",
                `Rate limit exceeded for ${endpoint}. Try again in ${Math.ceil(retryAfterMs / 1000)}s.`
            );
        }

        // Add current request and prune old entries
        recentRequests.push(now);
        tx.update(ref, {
            requests: recentRequests,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
    });
}

/**
 * Preset rate limit configs for different endpoint types.
 */
export const RATE_LIMITS = {
    /** AI generation endpoints (expensive) - 10 req/min */
    generation: { maxRequests: 10, windowMs: 60_000 },
    /** Standard API calls - 60 req/min */
    standard: { maxRequests: 60, windowMs: 60_000 },
    /** Auth/sensitive operations - 5 req/min */
    sensitive: { maxRequests: 5, windowMs: 60_000 },
} as const;
