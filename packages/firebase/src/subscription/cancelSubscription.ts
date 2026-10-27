/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Firebase Cloud Function: Cancel Subscription
 *
 * Cancels subscription at the end of current billing period.
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';
import { randomUUID } from 'node:crypto';
import { stripe, mapStripeStatus } from '../stripe/config';
import { stripeSecretKey, arcjetKey } from '../config/secrets';
import { protectAuthenticatedApiRequest } from '../functions/security/arcjet';
import { validateAppCheckV2 } from '../middleware/appCheck';

export const cancelSubscription = onCall({
  secrets: [stripeSecretKey, arcjetKey],
  timeoutSeconds: 30,
  memory: '512MiB',
  enforceAppCheck: false,
}, async (request) => {
  const { userId } = request.data;

  if (!userId || userId !== request.auth?.uid) {
    throw new HttpsError('unauthenticated', 'Unauthorized');
  }

  if (request.auth?.token?.email_verified === false || request.auth?.token?.firebase?.sign_in_provider === 'anonymous') {
    throw new HttpsError('unauthenticated', 'A verified signed-in user is required.');
  }

  validateAppCheckV2(request);

  if (request.rawRequest) {
    const protection = await protectAuthenticatedApiRequest(request.rawRequest as never, {
      userId,
      policy: request.auth?.token?.admin ? 'admin' : 'paid',
      operationId: `cancel-subscription:${randomUUID()}`,
    });
    if (!protection.allowed) {
      throw new HttpsError(
        protection.status === 429 ? 'resource-exhausted' : protection.status === 403 ? 'permission-denied' : 'unavailable',
        protection.message,
      );
    }
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
