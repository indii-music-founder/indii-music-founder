/**
 * Firebase Cloud Function: Resume Subscription
 *
 * Resumes a cancelled subscription (if it hasn't been cancelled yet).
 */

import { onCall } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';
import { stripe, mapStripeStatus } from '../stripe/config';

export const resumeSubscription = onCall(async (request) => {
  const { userId } = request.data;

  if (!userId || userId !== request.auth?.uid) {
    throw new Error('Unauthorized');
  }

  try {
    const db = getFirestore();
    const subscriptionDoc = await db.collection('subscriptions').doc(userId).get();

    if (!subscriptionDoc.exists()) {
      throw new Error('Subscription not found');
    }

    const subscription = subscriptionDoc.data();
    const stripeCustomerId = subscription.stripeCustomerId;
    const stripeSubscriptionId = subscription.stripeSubscriptionId;

    if (!stripeCustomerId || !stripeSubscriptionId) {
      throw new Error('No active subscription found');
    }

    // Check if subscription is set to cancel at period end
    const stripeSubscription = await stripe.subscriptions.retrieve(stripeSubscriptionId);

    if (!stripeSubscription.cancel_at_period_end) {
      throw new Error('Subscription is not scheduled for cancellation');
    }

    // Resume by removing cancel_at_period_end
    const updatedSubscription = await stripe.subscriptions.update(stripeSubscriptionId, {
      cancel_at_period_end: false
    });

    // Update in Firestore
    await subscriptionDoc.ref.update({
      cancelAtPeriodEnd: false,
      status: mapStripeStatus(updatedSubscription.status),
      updatedAt: Date.now()
    });

    return { success: true };
  } catch (error) {
    console.error('[resumeSubscription] Error:', error);
    throw new Error('Failed to resume subscription');
  }
});
