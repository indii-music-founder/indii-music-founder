/**
 * Firebase Cloud Function: Stripe Webhook Handler
 *
 * Handles Stripe webhook events to keep subscriptions in sync.
 */

import { onRequest } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';
import { stripe, mapStripeStatus, mapStripeTierToSubscriptionTier } from './config';
import { SubscriptionTier, Subscription } from '../../../src/services/subscription/types';

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
  const subscriptionData: Partial<Subscription> = {
    tier,
    status: mapStripeStatus(subscription.status),
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
 * Handle customer.subscription.created event
 */
async function handleSubscriptionCreated(event: Stripe.Event): Promise<void> {
  const subscription = event.data.object as Stripe.Subscription;

  const tier = mapStripeTierToSubscriptionTier(
    subscription.items.data[0]?.price.product as string
  );

  if (!tier) {
    console.error('[handleSubscriptionCreated] Unknown tier');
    return;
  }

  const stripeCustomerId = subscription.customer as string;

  // Find user by Stripe customer ID
  const db = getFirestore();
  const snapshot = await db
    .collection('subscriptions')
    .where('stripeCustomerId', '==', stripeCustomerId)
    .limit(1)
    .get();

  if (snapshot.empty) {
    console.error('[handleSubscriptionCreated] No user found for customer', stripeCustomerId);
    return;
  }

  const userId = snapshot.docs[0].id;
  const now = Date.now();

  await snapshot.docs[0].ref.update({
    tier,
    status: mapStripeStatus(subscription.status),
    currentPeriodStart: subscription.current_period_start * 1000,
    currentPeriodEnd: subscription.current_period_end * 1000,
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
    stripeSubscriptionId: subscription.id,
    updatedAt: now
  });

  console.log(`[handleSubscriptionCreated] Updated subscription for user ${userId}`);
}

/**
 * Handle customer.subscription.updated event
 */
async function handleSubscriptionUpdated(event: Stripe.Event): Promise<void> {
  const subscription = event.data.object as Stripe.Subscription;

  const tier = mapStripeTierToSubscriptionTier(
    subscription.items.data[0]?.price.product as string
  );

  if (!tier) {
    console.error('[handleSubscriptionUpdated] Unknown tier');
    return;
  }

  const stripeCustomerId = subscription.customer as string;

  const db = getFirestore();
  const snapshot = await db
    .collection('subscriptions')
    .where('stripeCustomerId', '==', stripeCustomerId)
    .limit(1)
    .get();

  if (snapshot.empty) {
    console.error('[handleSubscriptionUpdated] No user found for customer', stripeCustomerId);
    return;
  }

  const userId = snapshot.docs[0].id;

  await snapshot.docs[0].ref.update({
    tier,
    status: mapStripeStatus(subscription.status),
    currentPeriodStart: subscription.current_period_start * 1000,
    currentPeriodEnd: subscription.current_period_end * 1000,
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
    updatedAt: Date.now()
  });

  console.log(`[handleSubscriptionUpdated] Updated subscription for user ${userId}`);
}

/**
 * Handle customer.subscription.deleted event
 */
async function handleSubscriptionDeleted(event: Stripe.Event): Promise<void> {
  const subscription = event.data.object as Stripe.Subscription;
  const stripeCustomerId = subscription.customer as string;

  const db = getFirestore();
  const snapshot = await db
    .collection('subscriptions')
    .where('stripeCustomerId', '==', stripeCustomerId)
    .limit(1)
    .get();

  if (snapshot.empty) {
    console.error('[handleSubscriptionDeleted] No user found for customer', stripeCustomerId);
    return;
  }

  const userId = snapshot.docs[0].id;

  // Downgrade to free tier
  await snapshot.docs[0].ref.update({
    tier: SubscriptionTier.FREE,
    status: 'active',
    currentPeriodStart: Date.now(),
    currentPeriodEnd: Date.now() + 30 * 24 * 60 * 60 * 1000,
    cancelAtPeriodEnd: false,
    stripeSubscriptionId: null,
    updatedAt: Date.now()
  });

  console.log(`[handleSubscriptionDeleted] Downgraded user ${userId} to free tier`);
}

/**
 * Handle invoice.paid event
 */
async function handleInvoicePaid(event: Stripe.Event): Promise<void> {
  const invoice = event.data.object as Stripe.Invoice;

  if (!invoice.customer) {
    return;
  }

  const db = getFirestore();
  const snapshot = await db
    .collection('subscriptions')
    .where('stripeCustomerId', '==', invoice.customer as string)
    .limit(1)
    .get();

  if (snapshot.empty) {
    return;
  }

  const userId = snapshot.docs[0].id;

  // Update billing period end
  if (invoice.subscription) {
    const subscription = await stripe.subscriptions.retrieve(invoice.subscription as string);
    await snapshot.docs[0].ref.update({
      currentPeriodEnd: subscription.current_period_end * 1000,
      status: 'active',
      updatedAt: Date.now()
    });
  }

  console.log(`[handleInvoicePaid] Processed payment for user ${userId}`);
}

/**
 * Handle invoice.payment_failed event
 */
async function handleInvoicePaymentFailed(event: Stripe.Event): Promise<void> {
  const invoice = event.data.object as Stripe.Invoice;

  if (!invoice.customer) {
    return;
  }

  const db = getFirestore();
  const snapshot = await db
    .collection('subscriptions')
    .where('stripeCustomerId', '==', invoice.customer as string)
    .limit(1)
    .get();

  if (snapshot.empty) {
    return;
  }

  const userId = snapshot.docs[0].id;

  // Update status to past_due
  await snapshot.docs[0].ref.update({
    status: 'past_due',
    updatedAt: Date.now()
  });

  console.log(`[handleInvoicePaymentFailed] Payment failed for user ${userId}`);
}

/**
 * Main webhook handler
 */
export const stripeWebhook = onRequest(async (req, res) => {
  const signature = req.headers['stripe-signature'] as string;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error('[stripeWebhook] Webhook secret not configured');
    return res.status(500).json({ error: 'Webhook secret not configured' });
  }

  let event: Stripe.Event;

  try {
    event = verifyStripeWebhook(req.rawBody, signature, webhookSecret);
  } catch (error) {
    console.error('[stripeWebhook] Signature verification failed:', error);
    return res.status(400).json({ error: 'Invalid signature' });
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

    return res.json({ received: true });
  } catch (error) {
    console.error('[stripeWebhook] Handler error:', error);
    return res.status(500).json({ error: 'Webhook handler failed' });
  }
});
