/**
 * Firebase Cloud Function: Resume Subscription
 *
 * Resumes a cancelled subscription (if it hasn't been cancelled yet).
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';
import { stripe, mapStripeStatus } from '../stripe/config';
import { stripeSecretKey } from '../config/secrets';

export const resumeSubscription = onCall({
  secrets: [stripeSecretKey],
  timeoutSeconds: 30,
  memory: '128MiB',
  enforceAppCheck: process.env.SKIP_APP_CHECK !== 'true',
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

    // Check if subscription is set to cancel at period end
    const stripeSubscription = await stripe.subscriptions.retrieve(stripeSubscriptionId);

    if (!stripeSubscription.cancel_at_period_end) {
      throw new HttpsError('failed-precondition', 'Subscription is not scheduled for cancellation');
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
  } catch (error: any) {
    console.error('[resumeSubscription] Error:', error);
    throw new HttpsError('internal', error.message || 'Failed to resume subscription');
  }
});
