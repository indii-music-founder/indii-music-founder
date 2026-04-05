"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RATE_LIMITS = void 0;
exports.enforceRateLimit = enforceRateLimit;
const admin = __importStar(require("firebase-admin"));
const functions = __importStar(require("firebase-functions/v1"));
const DEFAULT_CONFIG = {
    maxRequests: 60,
    windowMs: 60 * 1000, // 1 minute
    collection: "rate_limits",
};
/**
 * Rate limiter for Firebase callable functions.
 * Uses Firestore to track per-user request counts with sliding windows.
 *
 * Throws functions.https.HttpsError("resource-exhausted") when limit exceeded.
 */
async function enforceRateLimit(userId, endpoint, config = {}) {
    const { maxRequests, windowMs, collection } = Object.assign(Object.assign({}, DEFAULT_CONFIG), config);
    const now = Date.now();
    const windowStart = now - windowMs;
    const docId = `${userId}_${endpoint}`;
    const ref = admin.firestore().collection(collection).doc(docId);
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
        const recentRequests = (data.requests || []).filter((ts) => ts > windowStart);
        if (recentRequests.length >= maxRequests) {
            const retryAfterMs = recentRequests[0] + windowMs - now;
            throw new functions.https.HttpsError("resource-exhausted", `Rate limit exceeded for ${endpoint}. Try again in ${Math.ceil(retryAfterMs / 1000)}s.`);
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
exports.RATE_LIMITS = {
    /** AI generation endpoints (expensive) - 10 req/min */
    generation: { maxRequests: 10, windowMs: 60000 },
    /** Standard API calls - 60 req/min */
    standard: { maxRequests: 60, windowMs: 60000 },
    /** Auth/sensitive operations - 5 req/min */
    sensitive: { maxRequests: 5, windowMs: 60000 },
};
//# sourceMappingURL=rateLimit.js.map