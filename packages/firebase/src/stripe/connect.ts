import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { randomUUID } from 'node:crypto';
import { stripe } from './config';
import { stripeSecretKey, arcjetKey } from '../config/secrets';
import { protectAuthenticatedApiRequest } from '../functions/security/arcjet';
import { validateAppCheckV2 } from '../middleware/appCheck';

/**
 * Triggered by the client to onboard a collaborator to Stripe Connect.
 * Moved from createStripeConnectAccount.ts to connect.ts to consolidate duplicates.
 */
export const createStripeConnectAccount = onCall(
    { region: 'us-central1', memory: '512MiB', timeoutSeconds: 60, cpu: 'gcf_gen1', concurrency: 1, enforceAppCheck: false, secrets: [stripeSecretKey, arcjetKey] },
    async (request): Promise<{ accountId: string; onboardingUrl: string }> => {
        if (!request.auth) {
            throw new HttpsError(
                'unauthenticated',
                'User must be authenticated to create a Stripe Connect account.'
            );
        }

        if (request.auth.token?.email_verified === false || request.auth.token?.firebase?.sign_in_provider === 'anonymous') {
            throw new HttpsError('unauthenticated', 'A verified signed-in user is required.');
        }

        validateAppCheckV2(request);

        if (request.rawRequest) {
            const protection = await protectAuthenticatedApiRequest(request.rawRequest as never, {
                userId: request.auth.uid,
                policy: request.auth.token?.admin ? 'admin' : 'verified-free',
                operationId: `create-stripe-connect:${randomUUID()}`,
            });
            if (!protection.allowed) {
                throw new HttpsError(
                    protection.status === 429 ? 'resource-exhausted' : protection.status === 403 ? 'permission-denied' : 'unavailable',
                    protection.message,
                );
            }
        }

        const { email: clientEmail, businessType } = (request.data ?? {}) as { email?: string; businessType?: string };
        const verifiedTokenEmail = typeof request.auth.token?.email === 'string' ? request.auth.token.email.trim() : '';
        const candidateEmail = verifiedTokenEmail || (typeof clientEmail === 'string' ? clientEmail.trim() : '');

        if (!candidateEmail) {
            throw new HttpsError(
                'invalid-argument',
                "Missing or invalid 'email' parameter."
            );
        }
        if (verifiedTokenEmail && typeof clientEmail === 'string' && clientEmail.trim() && clientEmail.trim().toLowerCase() !== verifiedTokenEmail.toLowerCase()) {
            throw new HttpsError(
                'permission-denied',
                'Stripe Connect onboarding email must match the authenticated user email.'
            );
        }
        if (businessType !== undefined && typeof businessType !== 'string') {
            throw new HttpsError(
                'invalid-argument',
                "Parameter 'businessType' must be a string if provided."
            );
        }

        try {
            const db = getFirestore();
            const userRef = db.collection('users').doc(request.auth.uid);
            const userSnap = await userRef.get();
            const existingAccountId = typeof userSnap.data()?.stripeConnectAccountId === 'string'
                ? userSnap.data()!.stripeConnectAccountId.trim()
                : '';

            let accountId = existingAccountId;
            if (!accountId) {
                const account = await stripe.accounts.create({
                    type: 'express',
                    email: candidateEmail,
                    business_type: businessType === 'company' ? 'company' : 'individual',
                    metadata: { userId: request.auth.uid },
                    capabilities: {
                        card_payments: { requested: true },
                        transfers: { requested: true },
                    },
                }, {
                    idempotencyKey: `stripe_connect_account_${request.auth.uid}`,
                });
                accountId = account.id;
                await userRef.set({
                    stripeConnectAccountId: accountId,
                    stripeConnectUpdatedAt: FieldValue.serverTimestamp(),
                }, { merge: true });
            }

            // Generate the onboarding link
            const accountLink = await stripe.accountLinks.create({
                account: accountId,
                refresh_url: 'https://app.indii.music/finance/stripe/refresh',
                return_url: 'https://app.indii.music/finance/stripe/success',
                type: 'account_onboarding',
            });

            return {
                accountId,
                onboardingUrl: accountLink.url
            };
        } catch (error: unknown) {
            if (error instanceof HttpsError) {
                throw error;
            }
            console.error('[StripeConnect] Error creating collaborator account:', error);
            throw new HttpsError(
                'internal',
                'Stripe Connect onboarding could not be completed.'
            );
        }
    },
);

/**
 * Triggers a payout/transfer from the platform to the destination artist.
 */
export const createTransfer = onCall(
    { region: 'us-central1', memory: '512MiB', timeoutSeconds: 60, cpu: 'gcf_gen1', concurrency: 1, enforceAppCheck: false, secrets: [stripeSecretKey, arcjetKey] },
    async (request): Promise<{ transferId: string }> => {
        if (!request.auth) {
            throw new HttpsError('unauthenticated', 'User must be signed in.');
        }

        if (!request.auth.token['admin']) {
            throw new HttpsError('permission-denied', 'Insufficient privileges.');
        }

        if (request.auth.token?.email_verified === false || request.auth.token?.firebase?.sign_in_provider === 'anonymous') {
            throw new HttpsError('unauthenticated', 'A verified signed-in admin is required.');
        }

        validateAppCheckV2(request);

        if (request.rawRequest) {
            const protection = await protectAuthenticatedApiRequest(request.rawRequest as never, {
                userId: request.auth.uid,
                policy: 'admin',
                operationId: `stripe-transfer:${randomUUID()}`,
            });
            if (!protection.allowed) {
                throw new HttpsError(
                    protection.status === 429 ? 'resource-exhausted' : protection.status === 403 ? 'permission-denied' : 'unavailable',
                    protection.message,
                );
            }
        }

        const { amount, destinationId, currency = 'usd', payoutId } = (request.data ?? {}) as { amount: number; destinationId: string; currency?: string; payoutId?: string };

        if (amount === undefined || typeof amount !== 'number' || amount <= 0 || !Number.isInteger(amount)) {
            throw new HttpsError('invalid-argument', "Parameter 'amount' must be a positive integer representing cents.");
        }
        if (!destinationId || typeof destinationId !== 'string' || destinationId.trim().length === 0) {
            throw new HttpsError('invalid-argument', "Missing or invalid 'destinationId' parameter.");
        }
        if (typeof currency !== 'string') {
            throw new HttpsError('invalid-argument', "Parameter 'currency' must be a string.");
        }
        // ISSUE-1287: real money movement must be idempotent. The caller supplies the
        // payout's own stable identity (batch id, obligation id, ...) so a retry or
        // double-click of the SAME intended payout is deduplicated by Stripe, while two
        // genuinely different payouts — same artist, same amount, different period —
        // are never collapsed into one. Deriving the key from amount+destination alone
        // would do exactly that collapsing within Stripe's 24h idempotency window, and
        // a timestamp/random key would defeat the point entirely. Required, not
        // optional: an unidentified payout cannot be made safe here.
        if (!payoutId || typeof payoutId !== 'string' || payoutId.trim().length === 0) {
            throw new HttpsError('invalid-argument', "Missing or invalid 'payoutId' parameter. Supply the stable id of the payout being executed so the transfer is idempotent on retry.");
        }

        try {
            const transfer = await stripe.transfers.create({
                amount, // in cents
                currency,
                destination: destinationId,
                description: `indii Royalty Payout - Destination: ${destinationId}`
            }, {
                idempotencyKey: `transfer_${payoutId.trim()}`
            });

            return { transferId: transfer.id };
        } catch (error: unknown) {
            console.error('[StripeConnect] Transfer failed:', error);
            throw new HttpsError('internal', `Stripe transfer failed: ${error instanceof Error ? error.message : String(error)}`);
        }
    },
);
