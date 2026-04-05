"use strict";
/**
 * Firebase Cloud Function: Stripe Webhook Handler
 *
 * Handles Stripe webhook events to keep subscriptions in sync.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.stripeWebhook = void 0;
const https_1 = require("firebase-functions/v2/https");
const firestore_1 = require("firebase-admin/firestore");
const config_1 = require("./config");
const types_1 = require("../shared/subscription/types");
const secrets_1 = require("../config/secrets");
/**
 * Verify Stripe webhook signature
 */
function verifyStripeWebhook(payload, signature, secret) {
    return config_1.stripe.webhooks.constructEvent(payload, signature, secret);
}
/**
 * Handle checkout.session.completed for a founders pass (one-time payment).
 * Writes the pending activation record to Firestore so activateFounderPass
 * can be called by the client after redirect.
 */
async function handleFounderPassCheckoutCompleted(session) {
    var _a;
    const userId = (_a = session.metadata) === null || _a === void 0 ? void 0 : _a.userId;
    const paymentIntentId = typeof session.payment_intent === 'string' ? session.payment_intent : null;
    if (!userId || !paymentIntentId) {
        console.error(`[handleFounderPassCheckoutCompleted] Missing userId or paymentIntentId. ` +
            `sessionId=${session.id}, userId=${userId !== null && userId !== void 0 ? userId : 'MISSING'}, ` +
            `paymentIntentId=${paymentIntentId !== null && paymentIntentId !== void 0 ? paymentIntentId : 'MISSING'}, ` +
            `metadataKeys=${session.metadata ? Object.keys(session.metadata).join(',') : 'NONE'}`);
        return;
    }
    const db = (0, firestore_1.getFirestore)();
    // Write a pending activation record. The client will call activateFounderPass()
    // after reading this (passing the paymentIntentId + their chosen display name).
    await db.collection('founder_pending_activations').doc(userId).set({
        userId,
        paymentIntentId,
        checkoutSessionId: session.id,
        status: 'pending',
        createdAt: firestore_1.FieldValue.serverTimestamp(),
    }, { merge: true });
    console.log(`[handleFounderPassCheckoutCompleted] Pending activation written for user ${userId}`);
}
/**
 * Handle checkout.session.completed event
 */
async function handleCheckoutCompleted(event) {
    var _a, _b, _c;
    const session = event.data.object;
    // Route founder pass payments separately
    if (((_a = session.metadata) === null || _a === void 0 ? void 0 : _a.type) === 'founder_pass') {
        await handleFounderPassCheckoutCompleted(session);
        return;
    }
    if (!session.customer || !((_b = session.metadata) === null || _b === void 0 ? void 0 : _b.userId) || !((_c = session.metadata) === null || _c === void 0 ? void 0 : _c.tier)) {
        console.error('[handleCheckoutCompleted] Missing required metadata');
        return;
    }
    const userId = session.metadata.userId;
    const tier = session.metadata.tier;
    const stripeCustomerId = session.customer;
    // Get subscription details from session
    const subscription = await config_1.stripe.subscriptions.retrieve(session.subscription);
    const db = (0, firestore_1.getFirestore)();
    const now = Date.now();
    // Update or create subscription
    const subscriptionData = {
        tier,
        status: (0, config_1.mapStripeStatus)(subscription.status),
        currentPeriodStart: subscription.current_period_start * 1000,
        currentPeriodEnd: subscription.current_period_end * 1000,
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
        stripeCustomerId,
        stripeSubscriptionId: subscription.id,
        updatedAt: now
    };
    await db.collection('subscriptions').doc(userId).set(subscriptionData, { merge: true });
    console.log(`[handleCheckoutCompleted] Updated subscription for user ${userId}`);
}
/**
 * Helper to update subscription by Stripe customer ID using a transaction.
 * Throws an error if the customer is not found so Stripe can retry later.
 */
async function updateSubscriptionByCustomer(stripeCustomerId, callerName, updateData) {
    const db = (0, firestore_1.getFirestore)();
    await db.runTransaction(async (tx) => {
        const snapshot = await tx.get(db.collection('subscriptions').where('stripeCustomerId', '==', stripeCustomerId).limit(1));
        if (snapshot.empty) {
            throw new Error(`[${callerName}] No user found for customer ${stripeCustomerId}. Retrying expected.`);
        }
        const docRef = snapshot.docs[0].ref;
        tx.update(docRef, Object.assign(Object.assign({}, updateData), { updatedAt: Date.now() }));
        console.log(`[${callerName}] Updated subscription for user ${snapshot.docs[0].id}`);
    });
}
/**
 * Handle customer.subscription.created event
 */
async function handleSubscriptionCreated(event) {
    var _a, _b;
    const subscription = event.data.object;
    const priceItem = subscription.items.data[0];
    const tier = (0, config_1.mapStripeTierToSubscriptionTier)(priceItem === null || priceItem === void 0 ? void 0 : priceItem.price.product, (_b = (_a = priceItem === null || priceItem === void 0 ? void 0 : priceItem.price.recurring) === null || _a === void 0 ? void 0 : _a.interval) !== null && _b !== void 0 ? _b : null);
    if (!tier) {
        console.error('[handleSubscriptionCreated] Unknown tier');
        return;
    }
    await updateSubscriptionByCustomer(subscription.customer, 'handleSubscriptionCreated', {
        tier,
        status: (0, config_1.mapStripeStatus)(subscription.status),
        currentPeriodStart: subscription.current_period_start * 1000,
        currentPeriodEnd: subscription.current_period_end * 1000,
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
        stripeSubscriptionId: subscription.id
    });
}
/**
 * Handle customer.subscription.updated event
 */
async function handleSubscriptionUpdated(event) {
    var _a, _b;
    const subscription = event.data.object;
    const priceItem = subscription.items.data[0];
    const tier = (0, config_1.mapStripeTierToSubscriptionTier)(priceItem === null || priceItem === void 0 ? void 0 : priceItem.price.product, (_b = (_a = priceItem === null || priceItem === void 0 ? void 0 : priceItem.price.recurring) === null || _a === void 0 ? void 0 : _a.interval) !== null && _b !== void 0 ? _b : null);
    if (!tier) {
        console.error('[handleSubscriptionUpdated] Unknown tier');
        return;
    }
    await updateSubscriptionByCustomer(subscription.customer, 'handleSubscriptionUpdated', {
        tier,
        status: (0, config_1.mapStripeStatus)(subscription.status),
        currentPeriodStart: subscription.current_period_start * 1000,
        currentPeriodEnd: subscription.current_period_end * 1000,
        cancelAtPeriodEnd: subscription.cancel_at_period_end
    });
}
/**
 * Handle customer.subscription.deleted event
 */
async function handleSubscriptionDeleted(event) {
    const subscription = event.data.object;
    await updateSubscriptionByCustomer(subscription.customer, 'handleSubscriptionDeleted', {
        tier: types_1.SubscriptionTier.FREE,
        status: 'active',
        currentPeriodStart: Date.now(),
        currentPeriodEnd: Date.now() + 30 * 24 * 60 * 60 * 1000,
        cancelAtPeriodEnd: false,
        stripeSubscriptionId: firestore_1.FieldValue.delete()
    });
}
/**
 * Handle invoice.paid event — updates subscription status and writes a
 * ledger entry so the Finance dashboard reflects accurate billing history.
 * Item 208: Revenue Share Ledger real-time sync.
 */
async function handleInvoicePaid(event) {
    const invoice = event.data.object;
    if (!invoice.customer)
        return;
    let currentPeriodEnd = undefined;
    if (invoice.subscription) {
        const subscription = await config_1.stripe.subscriptions.retrieve(invoice.subscription);
        currentPeriodEnd = subscription.current_period_end * 1000;
    }
    const updateData = { status: 'active' };
    if (currentPeriodEnd) {
        updateData.currentPeriodEnd = currentPeriodEnd;
    }
    await updateSubscriptionByCustomer(invoice.customer, 'handleInvoicePaid', updateData);
    // Write ledger entry for Finance dashboard
    const db = (0, firestore_1.getFirestore)();
    const subSnapshot = await db.collection('subscriptions')
        .where('stripeCustomerId', '==', invoice.customer)
        .limit(1)
        .get();
    if (!subSnapshot.empty) {
        const userId = subSnapshot.docs[0].id;
        await db.collection(`users/${userId}/ledger`).add({
            type: 'subscription_payment',
            invoiceId: invoice.id,
            invoiceNumber: invoice.number || invoice.id,
            amount: invoice.total,
            currency: invoice.currency || 'usd',
            status: 'paid',
            periodStart: invoice.period_start ? invoice.period_start * 1000 : null,
            periodEnd: invoice.period_end ? invoice.period_end * 1000 : null,
            pdfUrl: invoice.invoice_pdf || null,
            createdAt: firestore_1.FieldValue.serverTimestamp(),
        });
        console.log(`[handleInvoicePaid] Ledger entry written for user ${userId}`);
    }
}
/**
 * Handle invoice.payment_failed event — marks subscription as past_due and
 * writes a dunning notification record so the UI can prompt re-authentication.
 * Item 204: Failed Payment Dunning Flow.
 */
async function handleInvoicePaymentFailed(event) {
    const invoice = event.data.object;
    if (!invoice.customer)
        return;
    await updateSubscriptionByCustomer(invoice.customer, 'handleInvoicePaymentFailed', {
        status: 'past_due'
    });
    // Write a dunning notification so the client can surface a re-auth prompt.
    // When an email provider (e.g. SendGrid) is configured, process this queue
    // via a separate Cloud Function subscribed to Firestore triggers on
    // `dunning_notifications`.
    const db = (0, firestore_1.getFirestore)();
    const subSnapshot = await db.collection('subscriptions')
        .where('stripeCustomerId', '==', invoice.customer)
        .limit(1)
        .get();
    if (!subSnapshot.empty) {
        const userId = subSnapshot.docs[0].id;
        await db.collection('dunning_notifications').add({
            userId,
            stripeCustomerId: invoice.customer,
            invoiceId: invoice.id,
            amount: invoice.total,
            currency: invoice.currency || 'usd',
            attemptCount: invoice.attempt_count || 1,
            nextPaymentAttempt: invoice.next_payment_attempt
                ? invoice.next_payment_attempt * 1000
                : null,
            customerEmail: invoice.customer_email || null,
            status: 'pending',
            createdAt: firestore_1.FieldValue.serverTimestamp(),
        });
        console.log(`[handleInvoicePaymentFailed] Dunning notification queued for user ${userId}`);
    }
}
/**
 * Main webhook handler
 */
exports.stripeWebhook = (0, https_1.onRequest)({
    secrets: [secrets_1.stripeSecretKey, secrets_1.stripeWebhookSecret],
    timeoutSeconds: 30,
}, async (req, res) => {
    const signature = req.headers['stripe-signature'];
    const webhookSecret = (0, secrets_1.getStripeWebhookSecret)();
    if (!webhookSecret) {
        console.error('[stripeWebhook] Webhook secret not configured');
        res.status(500).json({ error: 'Webhook secret not configured' });
        return;
    }
    let event;
    try {
        event = verifyStripeWebhook(req.rawBody.toString(), signature, webhookSecret);
    }
    catch (error) {
        console.error('[stripeWebhook] Signature verification failed:', error);
        res.status(400).json({ error: 'Invalid signature' });
        return;
    }
    // ── Idempotency guard: atomic check-and-set via transaction ──────────
    // Stripe retries webhooks on timeout/5xx. Without an atomic guard, two
    // concurrent deliveries of the same event can both read "not processed"
    // and both proceed, causing double subscription changes or duplicate
    // invoice credits. Using runTransaction() makes the check-and-write
    // atomic, closing that race window.
    const db = (0, firestore_1.getFirestore)();
    const deliveryRef = db.collection('stripe_webhook_deliveries').doc(event.id);
    try {
        const alreadyProcessed = await db.runTransaction(async (tx) => {
            const snap = await tx.get(deliveryRef);
            if (snap.exists) {
                return true; // Already processed or in-flight
            }
            // Atomically mark as in-flight so concurrent retries are blocked
            tx.set(deliveryRef, {
                eventId: event.id,
                type: event.type,
                receivedAt: firestore_1.FieldValue.serverTimestamp(),
                status: 'processing',
            });
            return false;
        });
        if (alreadyProcessed) {
            console.log(`[stripeWebhook] Duplicate delivery skipped: ${event.id}`);
            res.json({ received: true, duplicate: true });
            return;
        }
    }
    catch (idempotencyErr) {
        // Non-fatal: log and continue — better to process twice than drop
        console.warn('[stripeWebhook] Idempotency check failed (proceeding):', idempotencyErr);
    }
    try {
        switch (event.type) {
            case 'checkout.session.completed':
                await handleCheckoutCompleted(event);
                break;
            case 'customer.subscription.created':
                await handleSubscriptionCreated(event);
                break;
            case 'customer.subscription.updated':
                await handleSubscriptionUpdated(event);
                break;
            case 'customer.subscription.deleted':
                await handleSubscriptionDeleted(event);
                break;
            case 'invoice.paid':
                await handleInvoicePaid(event);
                break;
            case 'invoice.payment_failed':
                await handleInvoicePaymentFailed(event);
                break;
            default:
                console.log(`[stripeWebhook] Unhandled event type: ${event.type}`);
        }
        // Mark delivery complete (best-effort)
        deliveryRef.update({ status: 'processed', processedAt: firestore_1.FieldValue.serverTimestamp() })
            .catch(() => { });
        res.json({ received: true });
    }
    catch (error) {
        console.error('[stripeWebhook] Handler error:', error);
        // Mark failed so the next retry is not skipped
        deliveryRef.update({ status: 'failed', error: String(error) })
            .catch(() => { });
        res.status(500).json({ error: 'Webhook handler failed' });
    }
});
//# sourceMappingURL=webhookHandler.js.map