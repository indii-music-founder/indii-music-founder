import * as crypto from 'crypto';
import { getFirestore } from 'firebase-admin/firestore';
import { onRequest } from 'firebase-functions/v2/https';

const db = getFirestore();

/**
 * Pay-Per-Approval Escrow Infrastructure
 * Settles escrow transactions using immutable ACID transactions and HMAC signature verification.
 */
export const handleEscrowWebhook = onRequest(async (request, response) => {
    const signature = request.headers['x-indii-signature'] as string;
    const webhookPayload = request.rawBody.toString('utf8');
    
    // In production, fetch this securely from Google Cloud Secret Manager
    const secret = process.env.ESCROW_WEBHOOK_SECRET || 'fallback-secret-do-not-use-in-prod';

    try {
        const expectedSig = crypto.createHmac('sha256', secret).update(webhookPayload).digest('hex');
        if (signature !== expectedSig) {
            console.error("Invalid HMAC Signature");
            response.status(401).send("Unauthorized");
            return;
        }

        const data = JSON.parse(webhookPayload);
        const transactionId = data.transaction_id;

        if (!transactionId) {
            response.status(400).send("Missing transaction_id");
            return;
        }

        // ACID Transaction to prevent double-spending
        await db.runTransaction(async (t) => {
            const escrowRef = db.collection('escrows').doc(transactionId);
            const doc = await t.get(escrowRef);

            if (!doc.exists) {
                throw new Error("Transaction not found");
            }

            if (doc.data()?.status !== 'LOCKED') {
                throw new Error("Idempotency check failed: Transaction already settled or invalid.");
            }

            if (data.status === 'success') {
                t.update(escrowRef, { status: 'RELEASED', releasedAt: new Date().toISOString() });
            } else {
                // Refund flow
                t.update(escrowRef, { status: 'REFUNDED', refundedAt: new Date().toISOString() });
            }
        });

        response.status(200).send("Webhook processed successfully");
    } catch (error) {
        console.error("Escrow Webhook Error:", error);
        response.status(500).send("Internal Server Error");
    }
});
