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
exports.getSubscription = void 0;
const https_1 = require("firebase-functions/v2/https");
const firestore_1 = require("firebase-admin/firestore");
const types_1 = require("../shared/subscription/types");
const crypto = __importStar(require("crypto"));
exports.getSubscription = (0, https_1.onCall)({ cors: true, enforceAppCheck: process.env.SKIP_APP_CHECK !== 'true' }, async (request) => {
    var _a;
    const { userId } = request.data;
    if (!userId) {
        throw new https_1.HttpsError('invalid-argument', 'User ID is required');
    }
    if (userId !== ((_a = request.auth) === null || _a === void 0 ? void 0 : _a.uid)) {
        throw new https_1.HttpsError('unauthenticated', 'Unauthorized: User ID does not match authenticated user');
    }
    try {
        const db = (0, firestore_1.getFirestore)();
        const subscriptionDoc = await db.collection('subscriptions').doc(userId).get();
        if (!subscriptionDoc.exists) {
            // Create free tier subscription for new users
            const now = Date.now();
            const freeSubscription = {
                id: crypto.randomUUID(),
                userId,
                tier: types_1.SubscriptionTier.FREE,
                status: 'active',
                currentPeriodStart: now,
                currentPeriodEnd: now + 30 * 24 * 60 * 60 * 1000, // 30 days from now
                cancelAtPeriodEnd: false,
                createdAt: now,
                updatedAt: now
            };
            await db.collection('subscriptions').doc(userId).set(freeSubscription);
            return freeSubscription;
        }
        return subscriptionDoc.data();
    }
    catch (error) {
        console.error('[getSubscription] Error:', error);
        throw new https_1.HttpsError('internal', 'Failed to retrieve subscription');
    }
});
//# sourceMappingURL=getSubscription.js.map