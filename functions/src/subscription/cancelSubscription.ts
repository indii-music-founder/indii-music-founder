/**
 * Firebase Cloud Function: Cancel Subscription
 *
 * Cancels subscription at the end of current billing period.
 */

import { onCall } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';
import { stripe, mapStripeStatus } from '../stripe/config';

export const cancelSubscription = onCall(async (request) => {
  const { userId } = request.data;

  if (!userId || userId !== request.auth?.uid) {
    throw new Error('Unauthorized');
  }

  try {
    const db = getFirestore();
    const subscriptionDoc = await db.collection('subscriptions').doc(userId).get();

    if (!subscriptionDoc.exists) {
      throw new Error('Subscription not found');
    }

    const subscription = subscriptionDoc.data();

    if (!subscription) {
      throw new Error('Subscription data not found');
    }

    const stripeCustomerId = subscription.stripeCustomerId;
    const stripeSubscriptionId = subscription.stripeSubscriptionId;

    if (!stripeCustomerId || !stripeSubscriptionId) {
      throw new Error('No active subscription found');
    }

    // Cancel at period end in Stripe
    const stripeSubscription = await stripe.subscriptions.update(stripeSubscriptionId, {
      cancel_at_period_end: true
    });

    // Update in Firestore
    await subscriptionDoc.ref.update({
      cancelAtPeriodEnd: true,
      status: mapStripeStatus(stripeSubscription.status),
      updatedAt: Date.now()
    });

    return { success: true };
  } catch (error) {
    console.error('[cancelSubscription] Error:', error);
    throw new Error('Failed to cancel subscription');
  }
});
