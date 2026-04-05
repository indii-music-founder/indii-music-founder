"use strict";
/**
 * Firebase Cloud Function: Create One-Time Stripe Checkout Session
 *
 * Used for one-off purchases (merchandise, beat licenses, sync fees)
 * that are NOT recurring subscriptions.
 *
 * Item 201: Enables PaymentService for real billing beyond subscriptions.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.createOneTimeCheckout = void 0;
const https_1 = require("firebase-functions/v2/https");
const config_1 = require("../stripe/config");
const secrets_1 = require("../config/secrets");
exports.createOneTimeCheckout = (0, https_1.onCall)({
    secrets: [secrets_1.stripeSecretKey],
    timeoutSeconds: 60,
    memory: '256MiB',
    enforceAppCheck: process.env.SKIP_APP_CHECK !== 'true',
}, async (request) => {
    var _a, _b;
    const { userId, items, successUrl, cancelUrl, customerEmail, metadata } = request.data;
    if (!((_a = request.auth) === null || _a === void 0 ? void 0 : _a.uid) || request.auth.uid !== userId) {
        throw new https_1.HttpsError('unauthenticated', 'User must be signed in.');
    }
    if (!items || items.length === 0) {
        throw new https_1.HttpsError('invalid-argument', 'At least one item is required.');
    }
    try {
        const session = await config_1.stripe.checkout.sessions.create({
            mode: 'payment',
            payment_method_types: ['card'],
            customer_email: customerEmail || ((_b = request.auth.token) === null || _b === void 0 ? void 0 : _b.email) || undefined,
            line_items: items.map((item) => ({
                price_data: {
                    currency: 'usd',
                    unit_amount: item.amount,
                    product_data: {
                        name: item.name,
                        description: item.description,
                        metadata: item.metadata,
                    },
                },
                quantity: item.quantity,
            })),
            success_url: successUrl,
            cancel_url: cancelUrl,
            allow_promotion_codes: true,
            automatic_tax: { enabled: true },
            payment_intent_data: {
                metadata: Object.assign({ userId, type: 'one_time' }, metadata),
            },
            metadata: Object.assign({ userId, type: 'one_time' }, metadata),
            client_reference_id: userId,
        });
        return {
            checkoutUrl: session.url || '',
            sessionId: session.id,
        };
    }
    catch (error) {
        console.error('[createOneTimeCheckout] Error:', error);
        throw new https_1.HttpsError('internal', error.message || 'Failed to create checkout session');
    }
});
//# sourceMappingURL=createOneTimeCheckout.js.map