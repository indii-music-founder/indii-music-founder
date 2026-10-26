/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Firebase Cloud Function: Get Customer Portal URL
 *
 * Creates a Stripe customer portal session for managing subscription.
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';
import { stripe } from '../stripe/config';
import { stripeSecretKey, arcjetKey } from '../config/secrets';
import { validateAppCheckV2 } from '../middleware/appCheck';
import { protectAuthenticatedApiRequest } from '../functions/security/arcjet';

export const getCustomerPortal = onCall({
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
      operationId: `get-customer-portal:${request.auth.uid}`,
    });
    if (!protection.allowed) {
      throw new HttpsError('resource-exhausted', 'Request rate limit exceeded. Please try again later.');
    }
  }

  const { userId, returnUrl } = request.data;

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
