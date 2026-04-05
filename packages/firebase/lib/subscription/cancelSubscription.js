"use strict";
/**
 * Firebase Cloud Function: Cancel Subscription
 *
 * Cancels subscription at the end of current billing period.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.cancelSubscription = void 0;
const https_1 = require("firebase-functions/v2/https");
const firestore_1 = require("firebase-admin/firestore");
const config_1 = require("../stripe/config");
const secrets_1 = require("../config/secrets");
exports.cancelSubscription = (0, https_1.onCall)({
    secrets: [secrets_1.stripeSecretKey],
    timeoutSeconds: 30,
    memory: '128MiB',
    enforceAppCheck: process.env.SKIP_APP_CHECK !== 'true',
}, async (request) => {
    var _a;
    const { userId } = request.data;
    if (!userId || userId !== ((_a = request.auth) === null || _a === void 0 ? void 0 : _a.uid)) {
        throw new https_1.HttpsError('unauthenticated', 'Unauthorized');
    }
    try {
        const db = (0, firestore_1.getFirestore)();
        const subscriptionDoc = await db.collection('subscriptions').doc(userId).get();
        if (!subscriptionDoc.exists) {
            throw new https_1.HttpsError('not-found', 'Subscription not found');
        }
        const subscription = subscriptionDoc.data();
        if (!subscription) {
            throw new https_1.HttpsError('not-found', 'Subscription data not found');
        }
        const stripeCustomerId = subscription.stripeCustomerId;
        const stripeSubscriptionId = subscription.stripeSubscriptionId;
        if (!stripeCustomerId || !stripeSubscriptionId) {
            throw new https_1.HttpsError('failed-precondition', 'No active subscription found');
        }
        if (subscription.cancelAtPeriodEnd) {
            console.log(`[cancelSubscription] Subscription for ${userId} already set to cancel.`);
            return { success: true };
        }
        // Cancel at period end in Stripe
        const stripeSubscription = await config_1.stripe.subscriptions.update(stripeSubscriptionId, {
            cancel_at_period_end: true
        });
        // Update in Firestore
        await subscriptionDoc.ref.update({
            cancelAtPeriodEnd: true,
            status: (0, config_1.mapStripeStatus)(stripeSubscription.status),
            updatedAt: Date.now()
        });
        return { success: true };
    }
    catch (error) {
        console.error('[cancelSubscription] Error:', error);
        throw new https_1.HttpsError('internal', error.message || 'Failed to cancel subscription');
    }
});
//# sourceMappingURL=cancelSubscription.js.map