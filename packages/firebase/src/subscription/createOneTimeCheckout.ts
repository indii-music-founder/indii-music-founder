/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Firebase Cloud Function: Create One-Time Stripe Checkout Session
 *
 * Used for one-off purchases (merchandise, beat licenses, sync fees)
 * that are NOT recurring subscriptions.
 *
 * Item 201: Enables PaymentService for real billing beyond subscriptions.
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';
import { randomUUID } from 'node:crypto';
import { stripe } from '../stripe/config';
import { assertAllowedStripeRedirectUrl } from '../stripe/redirectAllowlist';
import { stripeSecretKey, arcjetKey } from '../config/secrets';
import { protectAuthenticatedApiRequest } from '../functions/security/arcjet';
import { validateAppCheckV2 } from '../middleware/appCheck';

const MIN_UNIT_AMOUNT_CENTS = 50; // Stripe minimum $0.50 USD
const MAX_UNIT_AMOUNT_CENTS = 5_000_000; // $50,000.00 cap per item
const MAX_QUANTITY = 100;

export interface OneTimeCheckoutParams {
    userId: string;
    items: Array<{
        productId?: string;
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
    secrets: [stripeSecretKey, arcjetKey],
    timeoutSeconds: 60,
    memory: '512MiB',
    enforceAppCheck: false,
}, async (request) => {
    const { userId, items, successUrl, cancelUrl, customerEmail, metadata, applySurcharge } =
        request.data as OneTimeCheckoutParams & { applySurcharge?: boolean };

    if (!request.auth?.uid || request.auth.uid !== userId) {
        throw new HttpsError('unauthenticated', 'User must be signed in.');
    }

    if (request.auth?.token?.email_verified === false || request.auth?.token?.firebase?.sign_in_provider === 'anonymous') {
        throw new HttpsError('unauthenticated', 'A verified signed-in user is required.');
    }

    validateAppCheckV2(request);

    if (request.rawRequest) {
        const protection = await protectAuthenticatedApiRequest(request.rawRequest as never, {
            userId: request.auth.uid,
            policy: request.auth?.token?.admin ? 'admin' : 'paid',
            operationId: `create-one-time-checkout:${randomUUID()}`,
        });
        if (!protection.allowed) {
            throw new HttpsError(
                protection.status === 429 ? 'resource-exhausted' : protection.status === 403 ? 'permission-denied' : 'unavailable',
                protection.message,
            );
        }
    }

    if (!items || !Array.isArray(items) || items.length === 0 || items.length > 50) {
        throw new HttpsError('invalid-argument', 'Between 1 and 50 items are required.');
    }

    const validatedSuccessUrl = assertAllowedStripeRedirectUrl(successUrl, 'successUrl');
    const validatedCancelUrl = assertAllowedStripeRedirectUrl(cancelUrl, 'cancelUrl');

    const resolvedItems: Array<{
        name: string;
        description?: string;
        amount: number;
        quantity: number;
        metadata?: Record<string, string>;
    }> = [];

    for (const item of items) {
        if (!item || typeof item.name !== 'string' || !item.name.trim()) {
            throw new HttpsError('invalid-argument', 'Each item must have a valid name.');
        }
        if (
            typeof item.quantity !== 'number' ||
            !Number.isInteger(item.quantity) ||
            item.quantity < 1 ||
            item.quantity > MAX_QUANTITY
        ) {
            throw new HttpsError('invalid-argument', `Item quantity must be an integer between 1 and ${MAX_QUANTITY}.`);
        }

        let authoritativeAmount = item.amount;
        const catalogProductId = item.productId || item.metadata?.productId;
        if (typeof catalogProductId === 'string' && catalogProductId.trim()) {
            const productSnap = await getFirestore().collection('products').doc(catalogProductId.trim()).get();
            if (!productSnap.exists) {
                throw new HttpsError('not-found', `Catalog product '${catalogProductId}' not found.`);
            }
            const productData = productSnap.data();
            if (typeof productData?.price !== 'number' || !Number.isInteger(productData.price)) {
                throw new HttpsError('failed-precondition', `Catalog product '${catalogProductId}' has an invalid price.`);
            }
            authoritativeAmount = productData.price;
        }

        if (
            typeof authoritativeAmount !== 'number' ||
            !Number.isInteger(authoritativeAmount) ||
            authoritativeAmount < MIN_UNIT_AMOUNT_CENTS ||
            authoritativeAmount > MAX_UNIT_AMOUNT_CENTS
        ) {
            throw new HttpsError(
                'invalid-argument',
                `Item amount must be an integer in cents between ${MIN_UNIT_AMOUNT_CENTS} and ${MAX_UNIT_AMOUNT_CENTS}.`,
            );
        }

        resolvedItems.push({
            name: item.name.trim(),
            description: item.description,
            amount: authoritativeAmount,
            quantity: item.quantity,
            metadata: item.metadata,
        });
    }

    // SECURITY: client metadata may never override the server-set routing
    // discriminator (`type`) or identity (`userId`). The webhook routes
    // fulfillment purely on session.metadata.type, so letting a client spread
    // those keys would let a $0.01 one-time payment mint credits or complete
    // marketplace purchases. Reserved keys are stripped here and the server
    // values are stamped LAST in the session metadata below so they always win.
    const RESERVED_METADATA_KEYS = ['type', 'userId'];
    const safeClientMetadata: Record<string, string> = {};
    for (const [key, value] of Object.entries(metadata ?? {})) {
        if (typeof value === 'string' && !RESERVED_METADATA_KEYS.includes(key)) {
            safeClientMetadata[key] = value;
        }
    }

    try {
        const lineItems: any[] = resolvedItems.map((item) => ({
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
        }));

        if (applySurcharge) {
            const totalBaseAmount = resolvedItems.reduce((sum, item) => sum + (item.amount * item.quantity), 0);
            if (totalBaseAmount > 0) {
                // Surcharge calculation: (totalBaseAmount + 30 cents) / (1 - 0.029) - totalBaseAmount
                const surchargeAmount = Math.ceil((totalBaseAmount + 30) / (1 - 0.029)) - totalBaseAmount;
                lineItems.push({
                    price_data: {
                        currency: 'usd',
                        unit_amount: surchargeAmount,
                        product_data: {
                            name: 'Processing & Administration Surcharge',
                            description: 'Card transaction processing fee',
                        },
                    },
                    quantity: 1,
                });
            }
        }

        const session = await stripe.checkout.sessions.create({
            mode: 'payment',
            payment_method_types: ['card'],
            customer_email: customerEmail || request.auth.token?.email || undefined,
            line_items: lineItems,
            success_url: validatedSuccessUrl,
            cancel_url: validatedCancelUrl,
            allow_promotion_codes: true,
            automatic_tax: { enabled: true },
            payment_intent_data: {
                metadata: {
                    ...safeClientMetadata,
                    userId,
                    type: 'one_time',
                },
            },
            metadata: {
                ...safeClientMetadata,
                userId,
                type: 'one_time',
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
