"use strict";
/**
 * Firebase Cloud Function: Track Usage
 *
 * Records usage for quota tracking and billing.
 */
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
exports.trackUsage = void 0;
const https_1 = require("firebase-functions/v2/https");
const firestore_1 = require("firebase-admin/firestore");
const crypto = __importStar(require("crypto"));
exports.trackUsage = (0, https_1.onCall)({ enforceAppCheck: process.env.SKIP_APP_CHECK !== 'true' }, async (request) => {
    var _a;
    const { userId, type, amount, project, metadata } = request.data;
    // DEMO MODE HANDLING: Allow unauthenticated/demo users
    // If no auth or no userId, skip tracking but return success
    // This prevents 500 errors that abort agent execution loops
    if (!((_a = request.auth) === null || _a === void 0 ? void 0 : _a.uid)) {
        console.log('[trackUsage] Skipping tracking for unauthenticated user (demo mode)');
        return { success: true, skipped: true, reason: 'unauthenticated' };
    }
    // Validate userId matches auth
    if (userId && userId !== request.auth.uid) {
        throw new (await Promise.resolve().then(() => __importStar(require('firebase-functions/v2/https')))).HttpsError('permission-denied', 'Unauthorized: userId mismatch');
    }
    const effectiveUserId = userId || request.auth.uid;
    try {
        const db = (0, firestore_1.getFirestore)();
        // Get current subscription (optional - don't fail if missing)
        const subscriptionDoc = await db.collection('subscriptions').doc(effectiveUserId).get();
        if (!subscriptionDoc.exists) {
            // No subscription = free tier user. Still track but don't require subscription doc.
            console.log('[trackUsage] No subscription found, tracking as free tier user');
            const usageRecord = {
                id: crypto.randomUUID(),
                userId: effectiveUserId,
                subscriptionId: 'free-tier',
                project: project || 'default',
                type,
                amount,
                timestamp: Date.now(),
                metadata
            };
            await db.collection('usage').add(usageRecord);
            return { success: true, tier: 'free' };
        }
        const subscription = subscriptionDoc.data();
        if (!subscription) {
            console.warn('[trackUsage] Subscription doc exists but no data');
            return { success: true, skipped: true, reason: 'empty_subscription' };
        }
        // Create usage record
        const usageRecord = {
            id: crypto.randomUUID(),
            userId: effectiveUserId,
            subscriptionId: subscription.id || 'unknown',
            project: project || 'default',
            type,
            amount,
            timestamp: Date.now(),
            metadata
        };
        // Add to usage collection
        await db.collection('usage').add(usageRecord);
        return { success: true };
    }
    catch (error) {
        console.error('[trackUsage] Error:', error);
        throw new (await Promise.resolve().then(() => __importStar(require('firebase-functions/v2/https')))).HttpsError('internal', 'Internal error during usage tracking', String(error));
    }
});
//# sourceMappingURL=trackUsage.js.map