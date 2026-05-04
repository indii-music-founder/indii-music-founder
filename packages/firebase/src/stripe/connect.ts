import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { stripe } from './config';

/**
 * Triggered by the client to create a Stripe Connect Express account for an artist.
 * 
 * Gen 2 Cloud Function — us-central1 region.
 */
export const createStripeAccount = onCall(
    { region: 'us-central1' },
    async (request) => {
        // 1. Basic auth check
        if (!request.auth) {
            throw new HttpsError('unauthenticated', 'User must be signed in.');
        }

        const { artistId } = request.data as { artistId: string };
        if (request.auth.uid !== artistId) {
            throw new HttpsError('permission-denied', 'Cannot create Stripe account for another artist.');
        }
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
            throw new HttpsError('internal', 'Stripe account creation failed.');
        }
    }
);

/**
 * Triggers a payout/transfer from the platform to the destination artist.
 * 
 * Gen 2 Cloud Function — us-central1 region.
 */
export const createTransfer = onCall(
    { region: 'us-central1' },
    async (request) => {
        if (!request.auth) {
            throw new HttpsError('unauthenticated', 'User must be signed in.');
        }

        if (!request.auth.token['admin']) {
            throw new HttpsError('permission-denied', 'Insufficient privileges.');
        }

        const { amount, destinationId, currency = 'usd' } = request.data as { amount: number; destinationId: string; currency?: string };
        // Stripe instance is pre-configured and exported from ./config.ts

        try {
            const transfer = await stripe.transfers.create({
                amount, // in cents
                currency,
                destination: destinationId,
                description: `indiiOS Royalty Payout - Artist ID: ${request.auth.uid}`
            });

            return { transferId: transfer.id };
        } catch (error) {
            console.error('[StripeConnect] Transfer failed:', error);
            throw new HttpsError('internal', 'Stripe transfer failed.');
        }
    }
);
