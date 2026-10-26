/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Firebase Cloud Function: Cancel Subscription
 *
 * Cancels subscription at the end of current billing period.
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';
import { stripe, mapStripeStatus } from '../stripe/config';
import { stripeSecretKey, arcjetKey } from '../config/secrets';
import { validateAppCheckV2 } from '../middleware/appCheck';
import { protectAuthenticatedApiRequest } from '../functions/security/arcjet';

export const cancelSubscription = onCall({
  secrets: [stripeSecretKey, arcjetKey],
  timeoutSeconds: 30,
  memory: '512MiB',
  enforceAppCheck: false,
}, async (request) => {
  validateAppCheckV2(request);
  if (!request.auth || !request.auth.uid) {
    throw new HttpsError('unauthenticated', 'User must be authenticated.');
  }
  if (request.auth.token?.firebase?.sign_in_provider === 'anonymous') {
    throw new HttpsError('permission-denied', 'Anonymous accounts may not perform this operation.');
  }
  if (request.rawRequest) {
    const protection = await protectAuthenticatedApiRequest(request.rawRequest as never, {
      userId: request.auth.uid,
      policy: 'verified-free',
      operationId: `cancel-subscription:${request.auth.uid}`,
    });
    if (!protection.allowed) {
      throw new HttpsError('resource-exhausted', 'Request rate limit exceeded. Please try again later.');
    }
  }

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
