"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.signEscrow = exports.initiateSplitEscrow = void 0;
/**
 * initiateSplitEscrow — Item 135
 *
 * Creates a Stripe transfer group to logically associate split payouts and
 * stores an escrow record in Firestore with PENDING_SIGNATURES status.
 * When all parties call signEscrow(), the escrow transitions to RELEASED
 * and the FinanceTools client can call createTransfer() for each split.
 */
const functions = __importStar(require("firebase-functions/v1"));
const admin = __importStar(require("firebase-admin"));
const config_1 = require("./config");
/**
 * Initiate a split escrow for a track.
 * Creates a Stripe PaymentIntent (capture_method: manual) to hold funds
 * and records the pending signatures in Firestore.
 */
exports.initiateSplitEscrow = functions
    .runWith({ enforceAppCheck: process.env.SKIP_APP_CHECK !== 'true', timeoutSeconds: 60, memory: '256MB' })
    .https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be signed in.');
    }
    const { trackId, holdAmount, parties } = data;
    if (!trackId ||
        typeof holdAmount !== 'number' ||
        holdAmount <= 0 ||
        !Array.isArray(parties) ||
        parties.length === 0) {
        throw new functions.https.HttpsError('invalid-argument', 'trackId, holdAmount (positive cents), and non-empty parties array are required.');
    }
    const db = admin.firestore();
    const uid = context.auth.uid;
    // Transfer group ties all split payouts together for reconciliation
    const transferGroup = `escrow_${trackId}_${Date.now()}`;
    // Verify the platform Stripe account is configured before creating the intent
    const platformAccountId = process.env.STRIPE_PLATFORM_ACCOUNT_ID;
    let stripeEscrowId = null;
    if (platformAccountId) {
        try {
            // Create a manual-capture PaymentIntent to hold funds without charging
            const intent = await config_1.stripe.paymentIntents.create({
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
        }
        catch (stripeErr) {
            // Non-fatal: Stripe may not be configured yet — fall through to Firestore-only record
            console.warn('[splitEscrow] Stripe PaymentIntent creation skipped:', stripeErr);
        }
    }
    // Persist the escrow record regardless of Stripe state
    const signoffs = {};
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
    const response = {
        escrowAccount,
        escrowDocId: escrowRef.id,
        stripeTransferGroup: transferGroup,
        status: 'PENDING_SIGNATURES',
        pendingParties: parties,
    };
    console.info(`[splitEscrow] Created escrow ${escrowRef.id} for track ${trackId} ` +
        `($${(holdAmount / 100).toFixed(2)}, ${parties.length} parties)`);
    return response;
});
/**
 * Record a collaborator's sign-off on the escrow.
 * When all parties have signed, status transitions to RELEASED.
 */
exports.signEscrow = functions
    .runWith({ enforceAppCheck: process.env.SKIP_APP_CHECK !== 'true', timeoutSeconds: 60, memory: '256MB' })
    .https.onCall(async (data, context) => {
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
        const data = snap.data();
        if (!data.parties.includes(uid)) {
            throw new functions.https.HttpsError('permission-denied', 'User is not a party to this escrow.');
        }
        const updatedSignoffs = Object.assign(Object.assign({}, data.signoffs), { [uid]: true });
        const allSigned = data.parties.every((p) => updatedSignoffs[p] === true);
        tx.update(escrowRef, {
            [`signoffs.${uid}`]: true,
            status: allSigned ? 'RELEASED' : 'PENDING_SIGNATURES',
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
    });
    return { success: true, message: `Signoff recorded for escrow ${escrowDocId}.` };
});
//# sourceMappingURL=splitEscrow.js.map