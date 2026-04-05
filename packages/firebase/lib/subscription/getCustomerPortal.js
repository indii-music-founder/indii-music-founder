"use strict";
/**
 * Firebase Cloud Function: Get Customer Portal URL
 *
 * Creates a Stripe customer portal session for managing subscription.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCustomerPortal = void 0;
const https_1 = require("firebase-functions/v2/https");
const firestore_1 = require("firebase-admin/firestore");
const config_1 = require("../stripe/config");
const secrets_1 = require("../config/secrets");
exports.getCustomerPortal = (0, https_1.onCall)({
    secrets: [secrets_1.stripeSecretKey],
    timeoutSeconds: 30,
    memory: '128MiB',
    enforceAppCheck: process.env.SKIP_APP_CHECK !== 'true',
}, async (request) => {
    var _a;
    const { userId, returnUrl } = request.data;
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
        if (!stripeCustomerId) {
            throw new https_1.HttpsError('failed-precondition', 'No Stripe customer found');
        }
        // Create customer portal session
        const session = await config_1.stripe.billingPortal.sessions.create({
            customer: stripeCustomerId,
            return_url: returnUrl
        });
        return { url: session.url };
    }
    catch (error) {
        console.error('[getCustomerPortal] Error:', error);
        throw new https_1.HttpsError('internal', error.message || 'Failed to create customer portal session');
    }
});
//# sourceMappingURL=getCustomerPortal.js.map