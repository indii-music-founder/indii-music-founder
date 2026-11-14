import * as crypto from 'crypto';
import { onRequest } from 'firebase-functions/v2/https';
import { arcjetKey, escrowWebhookSecret } from '../config/secrets';
import { protectAnonymousSignupRequest } from '../functions/security/arcjet';

/**
 * Legacy callback. A shared-secret message does not establish that Stripe
 * captured funds and completed all transfers, so it must not settle escrow.
 */
export const handleEscrowWebhook = onRequest({
    secrets: [arcjetKey, escrowWebhookSecret],
    timeoutSeconds: 30,
    memory: '512MiB',
    cpu: 'gcf_gen1',
    concurrency: 1,
}, async (request, response) => {
    const signature = request.headers['x-indii-signature'] as string;
    const protection = await protectAnonymousSignupRequest(
        request as never,
        `escrow-webhook:${signature?.slice(0, 16) || 'anonymous'}`,
        'allow-low-risk-read'
    );
    if (!protection.allowed) {
        if (protection.retryAfterSeconds && typeof response.set === 'function') {
            response.set('Retry-After', String(protection.retryAfterSeconds));
        }
        response.status(protection.status).send(protection.message);
        return;
    }

    const webhookPayload = request.rawBody.toString('utf8');
    
    // In production, fetch this securely from Google Cloud Secret Manager
    const secret = escrowWebhookSecret.value() || process.env.ESCROW_WEBHOOK_SECRET;
    if (!secret) {
        console.error("CRITICAL: ESCROW_WEBHOOK_SECRET is unset. Aborting to prevent forgery.");
        response.status(500).send("Internal Server Error: Misconfigured Environment");
        return;
    }

    try {
        const expectedSig = crypto.createHmac('sha256', secret).update(webhookPayload).digest('hex');
        const signatureBuf = Buffer.from(signature || '', 'utf8');
        const expectedBuf = Buffer.from(expectedSig, 'utf8');
        if (signatureBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(signatureBuf, expectedBuf)) {
            console.error("Invalid HMAC Signature");
            response.status(401).send("Unauthorized");
            return;
        }

        response.status(409).send('Escrow settlement requires verified payment and transfer receipts.');
    } catch (error) {
        console.error("Escrow Webhook Error:", error);
        response.status(500).send("Internal Server Error");
    }
});
