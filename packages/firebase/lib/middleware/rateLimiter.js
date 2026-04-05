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
exports.checkRateLimit = checkRateLimit;
exports.withRateLimit = withRateLimit;
const admin = __importStar(require("firebase-admin"));
const functions = __importStar(require("firebase-functions/v1"));
async function checkRateLimit(userId, endpoint, maxRequests = 60, windowMs = 60000) {
    const now = Date.now();
    const windowStart = Math.floor(now / windowMs) * windowMs;
    const key = `rate_limit:${endpoint}:${userId}:${windowStart}`;
    const ref = admin.firestore().collection('_rate_limits').doc(key);
    return admin.firestore().runTransaction(async (tx) => {
        var _a;
        const doc = await tx.get(ref);
        const count = doc.exists ? (((_a = doc.data()) === null || _a === void 0 ? void 0 : _a.count) || 0) : 0;
        if (count >= maxRequests) {
            return { allowed: false, remaining: 0 };
        }
        tx.set(ref, { count: count + 1, expiresAt: windowStart + windowMs });
        return { allowed: true, remaining: maxRequests - count - 1 };
    });
}
function withRateLimit(handler, config) {
    return async (data, ctx) => {
        if (!ctx.auth)
            throw new functions.https.HttpsError('unauthenticated', 'Auth required');
        const result = await checkRateLimit(ctx.auth.uid, config.endpoint, config.maxRequests);
        if (!result.allowed) {
            throw new functions.https.HttpsError('resource-exhausted', 'Rate limit exceeded');
        }
        return handler(data, ctx);
    };
}
//# sourceMappingURL=rateLimiter.js.map