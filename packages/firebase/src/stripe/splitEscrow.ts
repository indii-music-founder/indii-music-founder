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
    parties: string[]; // collaborator UIDs
    splits?: Record<string, number>; // mapping of UID -> split percentage
    stripeAccountIds?: Record<string, string>; // mapping of UID -> Stripe Account ID
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

        // ISSUE-720: reject malformed payout plans at the door — every split key
        // must be a party, every percentage positive, and the total must not exceed 100.
        if (data.splits) {
            let totalPct = 0;
            for (const [party, pct] of Object.entries(data.splits)) {
                if (!parties.includes(party)) {
                    throw new functions.https.HttpsError('invalid-argument', `Split defined for unknown party: ${party}`);
                }
                if (typeof pct !== 'number' || !isFinite(pct) || pct <= 0) {
                    throw new functions.https.HttpsError('invalid-argument', `Invalid split percentage for party ${party}.`);
                }
                totalPct += pct;
            }
            if (totalPct > 100) {
                throw new functions.https.HttpsError('invalid-argument', `Split percentages total ${totalPct}% — must not exceed 100%.`);
            }
        }
        if (data.stripeAccountIds) {
            for (const [party, accountId] of Object.entries(data.stripeAccountIds)) {
                if (!parties.includes(party)) {
                    throw new functions.https.HttpsError('invalid-argument', `Stripe account defined for unknown party: ${party}`);
                }
                if (typeof accountId !== 'string' || !accountId.startsWith('acct_')) {
                    throw new functions.https.HttpsError('invalid-argument', `Invalid Stripe account ID for party ${party}.`);
                }
            }
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
            splits: data.splits || {},
            stripeAccountIds: data.stripeAccountIds || {},
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

/**
 * Release escrow funds.
 * Verifies that the escrow is fully signed, captures the PaymentIntent,
 * and creates Stripe transfers for each party based on their split percentage.
 */
export const releaseEscrow = functions
    .runWith({ enforceAppCheck: true, timeoutSeconds: 120, memory: '256MB' })
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

        let escrowData: FirebaseFirestore.DocumentData | undefined;

        await db.runTransaction(async (tx) => {
            const snap = await tx.get(escrowRef);
            if (!snap.exists) {
                throw new functions.https.HttpsError('not-found', 'Escrow record not found.');
            }

            const record = snap.data()!;

            // Only initiator or a party can release
            if (record.initiatorUid !== uid && (!record.parties || !record.parties.includes(uid))) {
                throw new functions.https.HttpsError('permission-denied', 'User is not authorized to release this escrow.');
            }

            if (record.status !== 'FULLY_SIGNED') {
                throw new functions.https.HttpsError('failed-precondition', 'Escrow must be FULLY_SIGNED before release.');
            }

            // ISSUE-720: validate the full payout plan BEFORE any money moves.
            // Never capture funds unless every cent has a destination.
            const escrowParties: string[] = record.parties || [];
            const escrowSplits: Record<string, number> = record.splits || {};
            const escrowAccounts: Record<string, string> = record.stripeAccountIds || {};

            if (!record.holdAmountCents || record.holdAmountCents <= 0) {
                throw new functions.https.HttpsError('failed-precondition', 'Escrow has no held amount to release.');
            }

            const totalPct = escrowParties.reduce((sum, p) => sum + (escrowSplits[p] || 0), 0);
            if (totalPct <= 0) {
                throw new functions.https.HttpsError(
                    'failed-precondition',
                    'No split percentages are defined. Releasing would capture funds without paying any party.'
                );
            }
            if (totalPct > 100) {
                throw new functions.https.HttpsError(
                    'failed-precondition',
                    `Split percentages total ${totalPct}% — payouts would exceed the held amount.`
                );
            }

            const unpayable = escrowParties.filter((p) => (escrowSplits[p] || 0) > 0 && !escrowAccounts[p]);
            if (unpayable.length > 0) {
                throw new functions.https.HttpsError(
                    'failed-precondition',
                    `Missing Stripe account for parties with a split: ${unpayable.join(', ')}. All payees must onboard before release.`
                );
            }

            escrowData = record;

            tx.update(escrowRef, {
                status: 'RELEASING',
                releasedBy: uid,
                releaseStartedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
        });

        if (!escrowData) {
            throw new functions.https.HttpsError('internal', 'Escrow state could not be loaded.');
        }

        const {
            stripePaymentIntentId,
            holdAmountCents,
            stripeTransferGroup,
            parties,
            splits,
            stripeAccountIds
        } = escrowData;

        try {
            // 1. Capture the Payment Intent.
            // Idempotent: a prior release attempt may have captured but failed on
            // transfers — capturing an already-captured intent throws, so check first.
            const intent = await stripe.paymentIntents.retrieve(stripePaymentIntentId);
            if (intent.status !== 'succeeded') {
                await stripe.paymentIntents.capture(stripePaymentIntentId);
            }

            // 2. Create Transfers (payout plan already validated in the transaction)
            const transfers = [];
            for (const party of parties) {
                const splitPct = splits?.[party] || 0;
                if (splitPct <= 0) continue;

                const accountId = stripeAccountIds[party];
                const transferAmount = Math.round((holdAmountCents * splitPct) / 100);
                if (transferAmount > 0) {
                    transfers.push(stripe.transfers.create({
                        amount: transferAmount,
                        currency: 'usd',
                        destination: accountId,
                        transfer_group: stripeTransferGroup,
                        metadata: {
                            escrowDocId,
                            partyUid: party
                        }
                    }, {
                        // Idempotency key prevents double transfers
                        idempotencyKey: `transfer_${escrowDocId}_${party}`
                    }));
                }
            }

            await Promise.all(transfers);

            // 3. Mark as RELEASED
            await escrowRef.update({
                status: 'RELEASED',
                releasedAt: admin.firestore.FieldValue.serverTimestamp(),
            });

            return {
                success: true,
                status: 'RELEASED',
                message: 'Funds have been successfully released to all parties.'
            };

        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            console.error('[releaseEscrow] Error during release:', error);

            // Revert status on failure so it can be retried.
            // Safe to retry: capture is skipped if already succeeded, and
            // transfers carry idempotency keys, so no double payouts.
            await escrowRef.update({
                status: 'FULLY_SIGNED',
                releaseError: message
            });

            throw new functions.https.HttpsError('internal', `Failed to release funds: ${message}`);
        }
    });
