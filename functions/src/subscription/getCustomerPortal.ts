/**
 * Firebase Cloud Function: Get Customer Portal URL
 *
 * Creates a Stripe customer portal session for managing subscription.
 */

import { onCall } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';
import { stripe } from '../stripe/config';

export const getCustomerPortal = onCall(async (request) => {
  const { userId, returnUrl } = request.data;

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

    if (!stripeCustomerId) {
      throw new Error('No Stripe customer found');
    }

    // Create customer portal session
    const session = await stripe.billingPortal.sessions.create({
      customer: stripeCustomerId,
      return_url: returnUrl
    });

    return { url: session.url };
  } catch (error) {
    console.error('[getCustomerPortal] Error:', error);
    throw new Error('Failed to create customer portal session');
  }
});
