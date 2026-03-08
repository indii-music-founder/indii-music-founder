/**
 * PaymentService
 *
 * Handles one-off payment transactions (merchandise, beat licenses, sync fees)
 * via Stripe Checkout sessions created by the `createOneTimeCheckout` Cloud Function.
 *
 * Recurring subscription billing is handled separately by the subscription system
 * (SubscriptionTab → useSubscription → createCheckoutSession Cloud Function).
 *
 * Item 201: Enables real Stripe billing via Cloud Functions (no client-side Stripe key).
 * Item 210: Removed dead LemonSqueezy reference.
 */

import { getFunctions, httpsCallable } from 'firebase/functions';
import { logger } from '@/utils/logger';
import type { PaymentTransaction } from './types';

export type { PaymentTransaction };

export interface OneTimePaymentItem {
    name: string;
    description?: string;
    /** Amount in cents (e.g. 999 = $9.99) */
    amount: number;
    quantity: number;
    metadata?: Record<string, string>;
}

export interface OneTimePaymentRequest {
    userId: string;
    items: OneTimePaymentItem[];
    successUrl?: string;
    cancelUrl?: string;
    customerEmail?: string;
    metadata?: Record<string, string>;
}

/**
 * Create a Stripe Checkout session for one-off purchases and redirect the
 * user to Stripe's hosted payment page.
 *
 * Returns the Stripe session URL. Call `window.location.href = url` to redirect.
 */
export async function createOneTimePayment(request: OneTimePaymentRequest): Promise<string> {
    const functions = getFunctions();
    const createOneTimeCheckout = httpsCallable<OneTimePaymentRequest, { checkoutUrl: string; sessionId: string }>(
        functions,
        'createOneTimeCheckout'
    );

    const successUrl = request.successUrl || `${window.location.origin}/finance?payment=success`;
    const cancelUrl = request.cancelUrl || `${window.location.origin}/finance?payment=cancelled`;

    try {
        const result = await createOneTimeCheckout({
            ...request,
            successUrl,
            cancelUrl,
        });

        if (!result.data.checkoutUrl) {
            throw new Error('No checkout URL returned from server.');
        }

        logger.info(`[PaymentService] Checkout session created: ${result.data.sessionId}`);
        return result.data.checkoutUrl;
    } catch (error) {
        logger.error('[PaymentService] Failed to create checkout session:', error);
        throw error;
    }
}

/**
 * Fetch the most recent invoice for the authenticated user.
 * Returns structured invoice data for PDF rendering.
 */
export async function getLatestInvoice(invoiceId?: string): Promise<Record<string, unknown>> {
    const functions = getFunctions();
    const generateInvoice = httpsCallable<{ invoiceId?: string }, Record<string, unknown>>(
        functions,
        'generateInvoice'
    );

    const result = await generateInvoice({ invoiceId });
    return result.data;
}
