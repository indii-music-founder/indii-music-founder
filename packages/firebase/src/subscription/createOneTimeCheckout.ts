/**
 * Firebase Cloud Function: Create One-Time Stripe Checkout Session
 *
 * Used for one-off purchases (merchandise, beat licenses, sync fees)
 * that are NOT recurring subscriptions.
 *
 * Item 201: Enables PaymentService for real billing beyond subscriptions.
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { stripe } from '../stripe/config';
import { stripeSecretKey } from '../config/secrets';

export interface OneTimeCheckoutParams {
    userId: string;
    items: Array<{
        name: string;
        description?: string;
        amount: number; // in cents
        quantity: number;
        metadata?: Record<string, string>;
    }>;
    successUrl: string;
    cancelUrl: string;
    customerEmail?: string;
    metadata?: Record<string, string>;
}

export const createOneTimeCheckout = onCall({
    secrets: [stripeSecretKey],
    timeoutSeconds: 60,
    memory: '256MiB',
    enforceAppCheck: process.env.SKIP_APP_CHECK !== 'true',
}, async (request) => {
    const { userId, items, successUrl, cancelUrl, customerEmail, metadata } =
        request.data as OneTimeCheckoutParams;

    if (!request.auth?.uid || request.auth.uid !== userId) {
        throw new HttpsError('unauthenticated', 'User must be signed in.');
    }

    if (!items || items.length === 0) {
        throw new HttpsError('invalid-argument', 'At least one item is required.');
    }

    try {
        const session = await stripe.checkout.sessions.create({
            mode: 'payment',
            payment_method_types: ['card'],
            customer_email: customerEmail || request.auth.token?.email || undefined,
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
                metadata: {
                    userId,
                    type: 'one_time',
                    ...metadata,
                },
            },
            metadata: {
                userId,
                type: 'one_time',
                ...metadata,
            },
            client_reference_id: userId,
        });

        return {
            checkoutUrl: session.url || '',
            sessionId: session.id,
        };
    } catch (error: any) {
        console.error('[createOneTimeCheckout] Error:', error);
        throw new HttpsError('internal', error.message || 'Failed to create checkout session');
    }
});
