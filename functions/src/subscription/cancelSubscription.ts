/**
 * Firebase Cloud Function: Cancel Subscription
 *
 * Cancels subscription at the end of current billing period.
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';
import { stripe, mapStripeStatus } from '../stripe/config';
import { stripeSecretKey } from '../config/secrets';

export const cancelSubscription = onCall({
  secrets: [stripeSecretKey],
  timeoutSeconds: 30,
  memory: '128MiB',
}, async (request) => {
  const { userId } = request.data;

  if (!userId || userId !== request.auth?.uid) {
    throw new HttpsError('unauthenticated', 'Unauthorized');
  }

  try {
    const db = getFirestore();
    const subscriptionDoc = await db.collection('subscriptions').doc(userId).get();

    if (!subscriptionDoc.exists) {
      throw new HttpsError('not-found', 'Subscription not found');
    }

    const subscription = subscriptionDoc.data();

    if (!subscription) {
      throw new HttpsError('not-found', 'Subscription data not found');
    }

    const stripeCustomerId = subscription.stripeCustomerId;
    const stripeSubscriptionId = subscription.stripeSubscriptionId;

    if (!stripeCustomerId || !stripeSubscriptionId) {
      throw new HttpsError('failed-precondition', 'No active subscription found');
    }

    if (subscription.cancelAtPeriodEnd) {
      console.log(`[cancelSubscription] Subscription for ${userId} already set to cancel.`);
      return { success: true };
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
  } catch (error: any) {
    console.error('[cancelSubscription] Error:', error);
    throw new HttpsError('internal', error.message || 'Failed to cancel subscription');
  }
});
