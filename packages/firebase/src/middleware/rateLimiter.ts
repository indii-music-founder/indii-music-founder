import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions/v1';

export async function checkRateLimit(
    userId: string,
    endpoint: string,
    maxRequests: number = 60,
    windowMs: number = 60000
): Promise<{ allowed: boolean; remaining: number }> {
    const now = Date.now();
    const windowStart = Math.floor(now / windowMs) * windowMs;
    const key = `rate_limit:${endpoint}:${userId}:${windowStart}`;
    const ref = admin.firestore().collection('_rate_limits').doc(key);

    return admin.firestore().runTransaction(async (tx) => {
        const doc = await tx.get(ref);
        const count = doc.exists ? (doc.data()?.count || 0) : 0;
        if (count >= maxRequests) {
            return { allowed: false, remaining: 0 };
        }
        tx.set(ref, { count: count + 1, expiresAt: windowStart + windowMs });
        return { allowed: true, remaining: maxRequests - count - 1 };
    });
}

export function withRateLimit<T>(
    handler: (data: T, ctx: functions.https.CallableContext) => Promise<any>,
    config: { endpoint: string; maxRequests?: number }
) {
    return async (data: T, ctx: functions.https.CallableContext) => {
        if (!ctx.auth) throw new functions.https.HttpsError('unauthenticated', 'Auth required');
        const result = await checkRateLimit(ctx.auth.uid, config.endpoint, config.maxRequests);
        if (!result.allowed) {
            throw new functions.https.HttpsError('resource-exhausted', 'Rate limit exceeded');
        }
        return handler(data, ctx);
    };
}
