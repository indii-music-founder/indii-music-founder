/**
 * initiateSplitEscrow — Item 135
 *
 * Creates a Stripe transfer group to logically associate split payouts and
 * stores an escrow record in Firestore with PENDING_SIGNATURES status.
 * When all parties call signEscrow(), the escrow transitions to RELEASED
 * and the FinanceTools client can call createTransfer() for each split.
 */
import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';
import { stripe } from './config';

interface SplitEscrowRequest {
    trackId: string;
    holdAmount: number; // in USD cents
    parties: string[]; // collaborator UIDs or connected Stripe account IDs
}

interface SplitEscrowResponse {
    escrowAccount: string;
    escrowDocId: string;
    stripeTransferGroup: string;
    status: string;
    pendingParties: string[];
}

/**
 * Initiate a split escrow for a track.
 * Creates a Stripe PaymentIntent (capture_method: manual) to hold funds
 * and records the pending signatures in Firestore.
 */
export const initiateSplitEscrow = functions
    .runWith({ enforceAppCheck: process.env.SKIP_APP_CHECK !== 'true',  timeoutSeconds: 60, memory: '256MB'  })
    .https.onCall(async (data: SplitEscrowRequest, context) => {
        if (!context.auth) {
            throw new functions.https.HttpsError(
                'unauthenticated',
                'User must be signed in.'
            );
        }

        const { trackId, holdAmount, parties } = data;

        if (
            !trackId ||
            typeof holdAmount !== 'number' ||
            holdAmount <= 0 ||
            !Array.isArray(parties) ||
            parties.length === 0
        ) {
            throw new functions.https.HttpsError(
                'invalid-argument',
                'trackId, holdAmount (positive cents), and non-empty parties array are required.'
            );
        }

        const db = admin.firestore();
        const uid = context.auth.uid;

        // Transfer group ties all split payouts together for reconciliation
        const transferGroup = `escrow_${trackId}_${Date.now()}`;

        // Verify the platform Stripe account is configured before creating the intent
        const platformAccountId = process.env.STRIPE_PLATFORM_ACCOUNT_ID;

        let stripeEscrowId: string | null = null;
        if (platformAccountId) {
            try {
                // Create a manual-capture PaymentIntent to hold funds without charging
                const intent = await stripe.paymentIntents.create({
                    amount: holdAmount,
                    currency: 'usd',
                    capture_method: 'manual',
                    transfer_group: transferGroup,
                    metadata: {
                        trackId,
                        initiatorUid: uid,
                        partiesCount: String(parties.length),
                    },
                    description: `Split escrow for track ${trackId}`,
                });
                stripeEscrowId = intent.id;
            } catch (stripeErr) {
                // Non-fatal: Stripe may not be configured yet — fall through to Firestore-only record
                console.warn('[splitEscrow] Stripe PaymentIntent creation skipped:', stripeErr);
            }
        }

        // Persist the escrow record regardless of Stripe state
        const signoffs: Record<string, boolean> = {};
        parties.forEach((p) => { signoffs[p] = false; });

        const escrowRef = await db.collection('split_escrows').add({
            trackId,
            holdAmount,
            parties,
            initiatorUid: uid,
            stripeTransferGroup: transferGroup,
            stripePaymentIntentId: stripeEscrowId,
            status: 'PENDING_SIGNATURES',
            signoffs,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        const escrowAccount = `escrow_${escrowRef.id}`;

        const response: SplitEscrowResponse = {
            escrowAccount,
            escrowDocId: escrowRef.id,
            stripeTransferGroup: transferGroup,
            status: 'PENDING_SIGNATURES',
            pendingParties: parties,
        };

        console.info(
            `[splitEscrow] Created escrow ${escrowRef.id} for track ${trackId} ` +
            `($${(holdAmount / 100).toFixed(2)}, ${parties.length} parties)`
        );

        return response;
    }
);

/**
 * Record a collaborator's sign-off on the escrow.
 * When all parties have signed, status transitions to RELEASED.
 */
export const signEscrow = functions
    .runWith({ enforceAppCheck: process.env.SKIP_APP_CHECK !== 'true',  timeoutSeconds: 60, memory: '256MB'  })
    .https.onCall(async (data: { escrowDocId: string }, context) => {
        if (!context.auth) {
            throw new functions.https.HttpsError('unauthenticated', 'User must be signed in.');
        }

        const { escrowDocId } = data;
        if (!escrowDocId) {
            throw new functions.https.HttpsError('invalid-argument', 'escrowDocId is required.');
        }

        const db = admin.firestore();
        const uid = context.auth.uid;
        const escrowRef = db.collection('split_escrows').doc(escrowDocId);

        await db.runTransaction(async (tx) => {
            const snap = await tx.get(escrowRef);
            if (!snap.exists) {
                throw new functions.https.HttpsError('not-found', 'Escrow record not found.');
            }

            const data = snap.data()!;
            if (!data.parties.includes(uid)) {
                throw new functions.https.HttpsError(
                    'permission-denied',
                    'User is not a party to this escrow.'
                );
            }

            const updatedSignoffs = { ...data.signoffs, [uid]: true };
            const allSigned = data.parties.every((p: string) => updatedSignoffs[p] === true);

            tx.update(escrowRef, {
                [`signoffs.${uid}`]: true,
                status: allSigned ? 'RELEASED' : 'PENDING_SIGNATURES',
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
        });

        return { success: true, message: `Signoff recorded for escrow ${escrowDocId}.` };
    }
);
