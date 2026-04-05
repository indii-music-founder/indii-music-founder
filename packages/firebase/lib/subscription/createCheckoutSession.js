"use strict";
/**
 * Firebase Cloud Function: Create Stripe Checkout Session
 *
 * Creates a Stripe checkout session for subscription purchase or upgrade.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.createCheckoutSession = void 0;
const https_1 = require("firebase-functions/v2/https");
const firestore_1 = require("firebase-admin/firestore");
const config_1 = require("../stripe/config");
const types_1 = require("../shared/subscription/types");
const secrets_1 = require("../config/secrets");
exports.createCheckoutSession = (0, https_1.onCall)({
    secrets: [secrets_1.stripeSecretKey],
    timeoutSeconds: 60,
    memory: '256MiB',
    enforceAppCheck: process.env.SKIP_APP_CHECK !== 'true',
}, async (request) => {
    var _a, _b, _c, _d, _e;
    const { userId, tier, successUrl, cancelUrl, customerEmail, trialDays } = request.data;
    if (!userId || userId !== ((_a = request.auth) === null || _a === void 0 ? void 0 : _a.uid)) {
        throw new https_1.HttpsError('unauthenticated', 'Unauthorized');
    }
    if (tier === types_1.SubscriptionTier.FREE) {
        throw new https_1.HttpsError('invalid-argument', 'Cannot create checkout session for free tier');
    }
    try {
        const db = (0, firestore_1.getFirestore)();
        // Get or create Stripe customer
        const subscriptionDoc = await db.collection('subscriptions').doc(userId).get();
        let stripeCustomerId;
        if (subscriptionDoc.exists) {
            const subscription = subscriptionDoc.data();
            if (subscription.stripeCustomerId) {
                stripeCustomerId = subscription.stripeCustomerId;
            }
            else {
                // Create new Stripe customer
                const customer = await config_1.stripe.customers.create({
                    email: customerEmail || ((_c = (_b = request.auth) === null || _b === void 0 ? void 0 : _b.token) === null || _c === void 0 ? void 0 : _c.email),
                    metadata: { userId }
                }, { idempotencyKey: `create_customer_${userId}` });
                stripeCustomerId = customer.id;
                // Update subscription with Stripe customer ID
                await subscriptionDoc.ref.update({ stripeCustomerId });
            }
        }
        else {
            // Create new Stripe customer for new user
            const customer = await config_1.stripe.customers.create({
                email: customerEmail || ((_e = (_d = request.auth) === null || _d === void 0 ? void 0 : _d.token) === null || _e === void 0 ? void 0 : _e.email),
                metadata: { userId }
            }, { idempotencyKey: `create_customer_${userId}` });
            stripeCustomerId = customer.id;
        }
        // Determine price ID
        const isYearly = tier === types_1.SubscriptionTier.PRO_YEARLY;
        const priceId = (0, config_1.getPriceId)(tier, isYearly);
        if (!priceId) {
            throw new https_1.HttpsError('failed-precondition', `No Stripe price configured for tier: ${tier}`);
        }
        // Build checkout session parameters
        const sessionParams = {
            mode: 'subscription',
            payment_method_types: ['card'],
            customer: stripeCustomerId,
            line_items: [
                {
                    price: priceId,
                    quantity: 1
                }
            ],
            success_url: successUrl,
            cancel_url: cancelUrl,
            metadata: { userId, tier },
            allow_promotion_codes: true,
            automatic_tax: { enabled: true },
            client_reference_id: userId
        };
        // Add trial period if specified
        if (trialDays && trialDays > 0) {
            sessionParams.subscription_data = {
                trial_period_days: trialDays,
                metadata: { userId, tier }
            };
        }
        // Create checkout session
        const session = await config_1.stripe.checkout.sessions.create(sessionParams);
        const response = {
            checkoutUrl: session.url || '',
            sessionId: session.id
        };
        return response;
    }
    catch (error) {
        console.error('[createCheckoutSession] Error:', error);
        throw new https_1.HttpsError('internal', error.message || 'Failed to create checkout session');
    }
});
//# sourceMappingURL=createCheckoutSession.js.map