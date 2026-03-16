import * as functions from 'firebase-functions';
import { stripe } from './config';

/**
 * Triggered by the client to create a Stripe Connect Express account for an artist.
 */
export const createStripeAccount = functions.https.onCall(async (data: any, context: any) => {
    // 1. Basic auth check
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be signed in.');
    }

    const { artistId } = data as { artistId: string };
    // Stripe instance is pre-configured and exported from ./config.ts

    try {
        // 2. Create the Express account
        const account = await stripe.accounts.create({
            type: 'express',
            metadata: { artistId },
            capabilities: {
                card_payments: { requested: true },
                transfers: { requested: true },
            },
        });

        // 3. Generate the onboarding link (return in response)
        const accountLink = await stripe.accountLinks.create({
            account: account.id,
            refresh_url: 'https://app.indiios.com/finance/stripe/refresh',
            return_url: 'https://app.indiios.com/finance/stripe/success',
            type: 'account_onboarding',
        });

        return {
            accountId: account.id,
            onboardingUrl: accountLink.url
        };
    } catch (error) {
        console.error('[StripeConnect] Error creating account:', error);
        throw new functions.https.HttpsError('internal', 'Stripe account creation failed.');
    }
});

/**
 * Triggers a payout/transfer from the platform to the destination artist.
 */
export const createTransfer = functions.https.onCall(async (data: any, context: any) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be signed in.');
    }

    const { amount, destinationId, currency = 'usd' } = data as { amount: number; destinationId: string; currency?: string };
    // Stripe instance is pre-configured and exported from ./config.ts

    try {
        const transfer = await stripe.transfers.create({
            amount, // in cents
            currency,
            destination: destinationId,
            description: `indiiOS Royalty Payout - Artist ID: ${context.auth.uid}`
        });

        return { transferId: transfer.id };
    } catch (error) {
        console.error('[StripeConnect] Transfer failed:', error);
        throw new functions.https.HttpsError('internal', 'Stripe transfer failed.');
    }
});
