/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Firebase Cloud Function: Get Customer Portal URL
 *
 * Creates a Stripe customer portal session for managing subscription.
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';
import { randomUUID } from 'node:crypto';
import { stripe } from '../stripe/config';
import { stripeSecretKey, arcjetKey } from '../config/secrets';
import { protectAuthenticatedApiRequest } from '../functions/security/arcjet';
import { validateAppCheckV2 } from '../middleware/appCheck';

export const getCustomerPortal = onCall({
  secrets: [stripeSecretKey, arcjetKey],
  timeoutSeconds: 30,
  memory: '512MiB',
  enforceAppCheck: false,
}, async (request) => {
  const { userId, returnUrl } = request.data;

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
      operationId: `get-customer-portal:${randomUUID()}`,
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

    if (!stripeCustomerId) {
      throw new HttpsError('failed-precondition', 'No Stripe customer found');
    }

    // Create customer portal session
    const session = await stripe.billingPortal.sessions.create({
      customer: stripeCustomerId,
      return_url: returnUrl
    });

    return { url: session.url };
  } catch (error: any) {
    console.error('[getCustomerPortal] Error:', error);
    throw new HttpsError('internal', error.message || 'Failed to create customer portal session');
  }
});
