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
    stripePaymentIntentId: string;
    amountCents: number;
    amountFormatted: string;
    fundsHeld: boolean;
}

/**
 * Initiate a split escrow for a track.
 * Creates a Stripe PaymentIntent (capture_method: manual) to hold funds
 * and records the pending signatures in Firestore.
 */
export const initiateSplitEscrow = functions
    .runWith({ enforceAppCheck: true,  timeoutSeconds: 60, memory: '256MB'  })
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

        // ISSUE-853: FAIL CLOSED — an escrow that claims funds are held MUST
        // be backed by a real Stripe PaymentIntent. No Firestore-only escrows.
        const platformAccountId = process.env.STRIPE_PLATFORM_ACCOUNT_ID;
        if (!platformAccountId) {
            throw new functions.https.HttpsError(
                'failed-precondition',
                'ESCROW_NOT_FUNDED: Stripe platform account is not configured. No funds can be held.'
            );
        }

        let stripeEscrowId: string;
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
            console.error('[splitEscrow] Stripe PaymentIntent creation failed:', stripeErr);
            throw new functions.https.HttpsError(
                'failed-precondition',
                'ESCROW_NOT_FUNDED: Stripe could not create the escrow payment intent. No funds are held.'
            );
        }

        const signoffs: Record<string, boolean> = {};
        parties.forEach((p) => { signoffs[p] = false; });

        const escrowRef = await db.collection('split_escrows').add({
            trackId,
            holdAmountCents: holdAmount,
            holdAmount, // legacy field name, same cents value
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
            stripePaymentIntentId: stripeEscrowId,
            amountCents: holdAmount,
            amountFormatted: `$${(holdAmount / 100).toFixed(2)}`,
            fundsHeld: true,
        };

        console.info(
            `[splitEscrow] Created escrow ${escrowRef.id} for track ${trackId} ` +
            `($${(holdAmount / 100).toFixed(2)}, ${parties.length} parties, intent ${stripeEscrowId})`
        );

        return response;
    }
);

/**
 * Record a collaborator's sign-off on the escrow.
 *
 * ISSUE-854: legal signoff is decoupled from payout execution. When all
 * parties have signed, status becomes FULLY_SIGNED — never RELEASED.
 * RELEASED is reserved for a payout step that captures the PaymentIntent
 * and records Stripe transfer receipts; until that exists, a fully signed
 * escrow honestly reports that no money has moved yet.
 */
export const signEscrow = functions
    .runWith({ enforceAppCheck: true,  timeoutSeconds: 60, memory: '256MB'  })
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

        let fullySigned = false;
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
            fullySigned = data.parties.every((p: string) => updatedSignoffs[p] === true);

            tx.update(escrowRef, {
                [`signoffs.${uid}`]: true,
                // FULLY_SIGNED ≠ RELEASED: no capture/transfer has happened.
                status: fullySigned ? 'FULLY_SIGNED' : 'PENDING_SIGNATURES',
                ...(fullySigned ? { fullySignedAt: admin.firestore.FieldValue.serverTimestamp() } : {}),
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
        });

        return {
            success: true,
            status: fullySigned ? 'FULLY_SIGNED' : 'PENDING_SIGNATURES',
            fundsReleased: false,
            message: fullySigned
                ? `All parties have signed escrow ${escrowDocId}. Payout execution (capture + transfers) is a separate step — no funds have moved yet.`
                : `Signoff recorded for escrow ${escrowDocId}.`,
        };
    }
);
