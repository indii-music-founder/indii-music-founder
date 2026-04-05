"use strict";
/**
 * Firebase Cloud Function: Resume Subscription
 *
 * Resumes a cancelled subscription (if it hasn't been cancelled yet).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.resumeSubscription = void 0;
const https_1 = require("firebase-functions/v2/https");
const firestore_1 = require("firebase-admin/firestore");
const config_1 = require("../stripe/config");
const secrets_1 = require("../config/secrets");
exports.resumeSubscription = (0, https_1.onCall)({
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
        // Check if subscription is set to cancel at period end
        const stripeSubscription = await config_1.stripe.subscriptions.retrieve(stripeSubscriptionId);
        if (!stripeSubscription.cancel_at_period_end) {
            throw new https_1.HttpsError('failed-precondition', 'Subscription is not scheduled for cancellation');
        }
        // Resume by removing cancel_at_period_end
        const updatedSubscription = await config_1.stripe.subscriptions.update(stripeSubscriptionId, {
            cancel_at_period_end: false
        });
        // Update in Firestore
        await subscriptionDoc.ref.update({
            cancelAtPeriodEnd: false,
            status: (0, config_1.mapStripeStatus)(updatedSubscription.status),
            updatedAt: Date.now()
        });
        return { success: true };
    }
    catch (error) {
        console.error('[resumeSubscription] Error:', error);
        throw new https_1.HttpsError('internal', error.message || 'Failed to resume subscription');
    }
});
//# sourceMappingURL=resumeSubscription.js.map