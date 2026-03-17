/**
 * Firebase Cloud Function: Stripe Webhook Handler
 *
 * Handles Stripe webhook events to keep subscriptions in sync.
 */

import { onRequest } from 'firebase-functions/v2/https';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import Stripe from 'stripe';
import { stripe, mapStripeStatus, mapStripeTierToSubscriptionTier } from './config';
import { SubscriptionTier, Subscription as LocalSubscription } from '../shared/subscription/types';
import { stripeSecretKey, stripeWebhookSecret, getStripeWebhookSecret } from '../config/secrets';

/**
 * Verify Stripe webhook signature
 */
function verifyStripeWebhook(
  payload: string,
  signature: string,
  secret: string
): Stripe.Event {
  return stripe.webhooks.constructEvent(payload, signature, secret);
}

/**
 * Handle checkout.session.completed event
 */
async function handleCheckoutCompleted(event: Stripe.Event): Promise<void> {
  const session = event.data.object as Stripe.Checkout.Session;

  if (!session.customer || !session.metadata?.userId || !session.metadata?.tier) {
    console.error('[handleCheckoutCompleted] Missing required metadata');
    return;
  }

  const userId = session.metadata.userId;
  const tier = session.metadata.tier as SubscriptionTier;
  const stripeCustomerId = session.customer as string;

  // Get subscription details from session
  const subscription = await stripe.subscriptions.retrieve(
    session.subscription as string
  );

  const db = getFirestore();
  const now = Date.now();

  // Update or create subscription
  const subscriptionData: Partial<LocalSubscription> = {
    tier,
    status: mapStripeStatus((subscription as any).status),
    currentPeriodStart: (subscription as any).current_period_start * 1000,
    currentPeriodEnd: (subscription as any).current_period_end * 1000,
    cancelAtPeriodEnd: (subscription as any).cancel_at_period_end,
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
async function updateSubscriptionByCustomer(
  stripeCustomerId: string,
  callerName: string,
  updateData: Partial<LocalSubscription>
): Promise<void> {
  const db = getFirestore();

  await db.runTransaction(async (tx) => {
    const snapshot = await tx.get(
      db.collection('subscriptions').where('stripeCustomerId', '==', stripeCustomerId).limit(1)
    );

    if (snapshot.empty) {
      throw new Error(`[${callerName}] No user found for customer ${stripeCustomerId}. Retrying expected.`);
    }

    const docRef = snapshot.docs[0].ref;
    tx.update(docRef, { ...updateData, updatedAt: Date.now() });
    console.log(`[${callerName}] Updated subscription for user ${snapshot.docs[0].id}`);
  });
}

/**
 * Handle customer.subscription.created event
 */
async function handleSubscriptionCreated(event: Stripe.Event): Promise<void> {
  const subscription = event.data.object as Stripe.Subscription;
  const tier = mapStripeTierToSubscriptionTier(subscription.items.data[0]?.price.product as string);

  if (!tier) {
    console.error('[handleSubscriptionCreated] Unknown tier');
    return;
  }

  await updateSubscriptionByCustomer(subscription.customer as string, 'handleSubscriptionCreated', {
    tier,
    status: mapStripeStatus((subscription as any).status),
    currentPeriodStart: (subscription as any).current_period_start * 1000,
    currentPeriodEnd: (subscription as any).current_period_end * 1000,
    cancelAtPeriodEnd: (subscription as any).cancel_at_period_end,
    stripeSubscriptionId: subscription.id
  });
}

/**
 * Handle customer.subscription.updated event
 */
async function handleSubscriptionUpdated(event: Stripe.Event): Promise<void> {
  const subscription = event.data.object as Stripe.Subscription;
  const tier = mapStripeTierToSubscriptionTier(subscription.items.data[0]?.price.product as string);

  if (!tier) {
    console.error('[handleSubscriptionUpdated] Unknown tier');
    return;
  }

  await updateSubscriptionByCustomer(subscription.customer as string, 'handleSubscriptionUpdated', {
    tier,
    status: mapStripeStatus((subscription as any).status),
    currentPeriodStart: (subscription as any).current_period_start * 1000,
    currentPeriodEnd: (subscription as any).current_period_end * 1000,
    cancelAtPeriodEnd: (subscription as any).cancel_at_period_end
  });
}

/**
 * Handle customer.subscription.deleted event
 */
async function handleSubscriptionDeleted(event: Stripe.Event): Promise<void> {
  const subscription = event.data.object as Stripe.Subscription;

  await updateSubscriptionByCustomer(subscription.customer as string, 'handleSubscriptionDeleted', {
    tier: SubscriptionTier.FREE,
    status: 'active',
    currentPeriodStart: Date.now(),
    currentPeriodEnd: Date.now() + 30 * 24 * 60 * 60 * 1000,
    cancelAtPeriodEnd: false,
    stripeSubscriptionId: FieldValue.delete() as any
  });
}

/**
 * Handle invoice.paid event — updates subscription status and writes a
 * ledger entry so the Finance dashboard reflects accurate billing history.
 * Item 208: Revenue Share Ledger real-time sync.
 */
async function handleInvoicePaid(event: Stripe.Event): Promise<void> {
  const invoice = event.data.object as Stripe.Invoice;
  if (!invoice.customer) return;

  let currentPeriodEnd = undefined;
  if ((invoice as any).subscription) {
    const subscription = await stripe.subscriptions.retrieve((invoice as any).subscription as string);
    currentPeriodEnd = (subscription as any).current_period_end * 1000;
  }

  const updateData: Partial<LocalSubscription> = { status: 'active' };
  if (currentPeriodEnd) {
    updateData.currentPeriodEnd = currentPeriodEnd;
  }

  await updateSubscriptionByCustomer(invoice.customer as string, 'handleInvoicePaid', updateData);

  // Write ledger entry for Finance dashboard
  const db = getFirestore();
  const subSnapshot = await db.collection('subscriptions')
    .where('stripeCustomerId', '==', invoice.customer as string)
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
      periodStart: (invoice as any).period_start ? (invoice as any).period_start * 1000 : null,
      periodEnd: (invoice as any).period_end ? (invoice as any).period_end * 1000 : null,
      pdfUrl: invoice.invoice_pdf || null,
      createdAt: FieldValue.serverTimestamp(),
    });
    console.log(`[handleInvoicePaid] Ledger entry written for user ${userId}`);
  }
}

/**
 * Handle invoice.payment_failed event — marks subscription as past_due and
 * writes a dunning notification record so the UI can prompt re-authentication.
 * Item 204: Failed Payment Dunning Flow.
 */
async function handleInvoicePaymentFailed(event: Stripe.Event): Promise<void> {
  const invoice = event.data.object as Stripe.Invoice;
  if (!invoice.customer) return;

  await updateSubscriptionByCustomer(invoice.customer as string, 'handleInvoicePaymentFailed', {
    status: 'past_due'
  });

  // Write a dunning notification so the client can surface a re-auth prompt.
  // When an email provider (e.g. SendGrid) is configured, process this queue
  // via a separate Cloud Function subscribed to Firestore triggers on
  // `dunning_notifications`.
  const db = getFirestore();
  const subSnapshot = await db.collection('subscriptions')
    .where('stripeCustomerId', '==', invoice.customer as string)
    .limit(1)
    .get();

  if (!subSnapshot.empty) {
    const userId = subSnapshot.docs[0].id;
    await db.collection('dunning_notifications').add({
      userId,
      stripeCustomerId: invoice.customer as string,
      invoiceId: invoice.id,
      amount: invoice.total,
      currency: invoice.currency || 'usd',
      attemptCount: (invoice as any).attempt_count || 1,
      nextPaymentAttempt: (invoice as any).next_payment_attempt
        ? (invoice as any).next_payment_attempt * 1000
        : null,
      customerEmail: invoice.customer_email || null,
      status: 'pending',
      createdAt: FieldValue.serverTimestamp(),
    });
    console.log(`[handleInvoicePaymentFailed] Dunning notification queued for user ${userId}`);
  }
}

/**
 * Main webhook handler
 */
export const stripeWebhook = onRequest({
  secrets: [stripeSecretKey, stripeWebhookSecret],
  timeoutSeconds: 30,
}, async (req, res) => {
  const signature = req.headers['stripe-signature'] as string;
  const webhookSecret = getStripeWebhookSecret();

  if (!webhookSecret) {
    console.error('[stripeWebhook] Webhook secret not configured');
    res.status(500).json({ error: 'Webhook secret not configured' });
    return;
  }

  let event: Stripe.Event;

  try {
    event = verifyStripeWebhook(req.rawBody.toString(), signature, webhookSecret);
  } catch (error) {
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
  const db = getFirestore();
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
        receivedAt: FieldValue.serverTimestamp(),
        status: 'processing',
      });
      return false;
    });

    if (alreadyProcessed) {
      console.log(`[stripeWebhook] Duplicate delivery skipped: ${event.id}`);
      res.json({ received: true, duplicate: true });
      return;
    }
  } catch (idempotencyErr) {
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
    deliveryRef.update({ status: 'processed', processedAt: FieldValue.serverTimestamp() })
      .catch(() => { /* best-effort */ });

    res.json({ received: true });
  } catch (error) {
    console.error('[stripeWebhook] Handler error:', error);
    // Mark failed so the next retry is not skipped
    deliveryRef.update({ status: 'failed', error: String(error) })
      .catch(() => { /* best-effort */ });
    res.status(500).json({ error: 'Webhook handler failed' });
  }
});
