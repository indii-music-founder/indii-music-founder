import { defineCallable, HttpsError } from '../factory';
import { stripe } from './config';

/**
 * Triggered by the client to create a Stripe Connect Express account for an artist.
 */
export const createStripeAccount = defineCallable<{ artistId: string }, any>(
    { region: 'us-central1' },
    async (request) => {
        // 1. Basic auth check
        if (!request.auth) {
            throw new HttpsError('unauthenticated', 'User must be signed in.');
        }

        const { artistId } = request.data;
        if (!artistId || typeof artistId !== 'string' || artistId.trim().length === 0) {
            throw new HttpsError('invalid-argument', "Missing or invalid 'artistId'.");
        }
        if (request.auth.uid !== artistId) {
            throw new HttpsError('permission-denied', 'Cannot create Stripe account for another artist.');
        }

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
                refresh_url: 'https://app.indii.music/finance/stripe/refresh',
                return_url: 'https://app.indii.music/finance/stripe/success',
                type: 'account_onboarding',
            });

            return {
                accountId: account.id,
                onboardingUrl: accountLink.url
            };
        } catch (error: any) {
            console.error('[StripeConnect] Error creating account:', error);
            throw new HttpsError('internal', `Stripe account creation failed: ${error.message}`);
        }
    }
);

/**
 * Triggered by the client to onboard a collaborator to Stripe Connect.
 * Moved from createStripeConnectAccount.ts to connect.ts to consolidate duplicates.
 */
export const createStripeConnectAccount = defineCallable<{ email: string; businessType?: string }, any>(
    { region: 'us-central1', memory: '256MiB', timeoutSeconds: 60 },
    async (request) => {
        if (!request.auth) {
            throw new HttpsError(
                'unauthenticated',
                'User must be authenticated to create a Stripe Connect account.'
            );
        }

        const { email, businessType } = request.data;

        if (!email || typeof email !== 'string' || email.trim().length === 0) {
            throw new HttpsError(
                'invalid-argument',
                "Missing or invalid 'email' parameter."
            );
        }
        if (businessType !== undefined && typeof businessType !== 'string') {
            throw new HttpsError(
                'invalid-argument',
                "Parameter 'businessType' must be a string if provided."
            );
        }

        console.log(`[createStripeConnectAccount] Initiating onboarding for ${email} (${businessType})`);

        try {
            // Create the Express account
            const account = await stripe.accounts.create({
                type: 'express',
                email: email,
                business_type: businessType === 'company' ? 'company' : 'individual',
                metadata: { userId: request.auth.uid },
                capabilities: {
                    card_payments: { requested: true },
                    transfers: { requested: true },
                },
            });

            // Generate the onboarding link
            const accountLink = await stripe.accountLinks.create({
                account: account.id,
                refresh_url: 'https://app.indii.music/finance/stripe/refresh',
                return_url: 'https://app.indii.music/finance/stripe/success',
                type: 'account_onboarding',
            });

            return {
                accountId: account.id,
                onboardingUrl: accountLink.url
            };
        } catch (error: any) {
            console.error('[StripeConnect] Error creating collaborator account:', error);
            throw new HttpsError(
                'internal',
                `Stripe account creation failed: ${error.message}`
            );
        }
    }
);

/**
 * Triggers a payout/transfer from the platform to the destination artist.
 */
export const createTransfer = defineCallable<{ amount: number; destinationId: string; currency?: string }, any>(
    { region: 'us-central1' },
    async (request) => {
        if (!request.auth) {
            throw new HttpsError('unauthenticated', 'User must be signed in.');
        }

        if (!request.auth.token['admin']) {
            throw new HttpsError('permission-denied', 'Insufficient privileges.');
        }

        const { amount, destinationId, currency = 'usd' } = request.data;

        if (amount === undefined || typeof amount !== 'number' || amount <= 0 || !Number.isInteger(amount)) {
            throw new HttpsError('invalid-argument', "Parameter 'amount' must be a positive integer representing cents.");
        }
        if (!destinationId || typeof destinationId !== 'string' || destinationId.trim().length === 0) {
            throw new HttpsError('invalid-argument', "Missing or invalid 'destinationId' parameter.");
        }
        if (typeof currency !== 'string') {
            throw new HttpsError('invalid-argument', "Parameter 'currency' must be a string.");
        }

        try {
            const transfer = await stripe.transfers.create({
                amount, // in cents
                currency,
                destination: destinationId,
                description: `indii Royalty Payout - Destination: ${destinationId}`
            });

            return { transferId: transfer.id };
        } catch (error: any) {
            console.error('[StripeConnect] Transfer failed:', error);
            throw new HttpsError('internal', `Stripe transfer failed: ${error.message}`);
        }
    }
);
