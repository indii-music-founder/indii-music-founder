/**
 * Firebase Cloud Function: Create Stripe Checkout Session
 *
 * Creates a Stripe checkout session for subscription purchase or upgrade.
 */

import { onCall } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';
import { stripe, getPriceId } from '../stripe/config';
import Stripe from 'stripe';
import { CheckoutSessionParams, CheckoutSessionResponse } from '../../../src/services/subscription/types';
import { Subscription, SubscriptionTier } from '../../../src/services/subscription/types';

export const createCheckoutSession = onCall(async (request) => {
  const { userId, tier, successUrl, cancelUrl, customerEmail, trialDays } = request.data as CheckoutSessionParams;

  if (!userId || userId !== request.auth?.uid) {
    throw new Error('Unauthorized');
  }

  if (tier === SubscriptionTier.FREE) {
    throw new Error('Cannot create checkout session for free tier');
  }

  try {
    const db = getFirestore();

    // Get or create Stripe customer
    const subscriptionDoc = await db.collection('subscriptions').doc(userId).get();
    let stripeCustomerId: string;

    if (subscriptionDoc.exists) {
      const subscription = subscriptionDoc.data() as Subscription;
      if (subscription.stripeCustomerId) {
        stripeCustomerId = subscription.stripeCustomerId;
      } else {
        // Create new Stripe customer
        const customer = await stripe.customers.create({
          email: customerEmail || request.auth?.token?.email,
          metadata: { userId }
        });
        stripeCustomerId = customer.id;

        // Update subscription with Stripe customer ID
        await subscriptionDoc.ref.update({ stripeCustomerId });
      }
    } else {
      // Create new Stripe customer for new user
      const customer = await stripe.customers.create({
        email: customerEmail || request.auth?.token?.email,
        metadata: { userId }
      });
      stripeCustomerId = customer.id;
    }

    // Determine price ID
    const isYearly = tier === SubscriptionTier.PRO_YEARLY;
    const priceId = getPriceId(tier, isYearly);

    if (!priceId) {
      throw new Error(`No Stripe price configured for tier: ${tier}`);
    }

    // Build checkout session parameters
    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      mode: 'subscription',
      payment_method_types: ['card'],
      customer: stripeCustomerId,
      line_items: [
        {
          price: priceId,
          quantity: 1
        }
      ],
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: { userId, tier },
      allow_promotion_codes: true,
      client_reference_id: userId
    };

    // Add trial period if specified
    if (trialDays && trialDays > 0) {
      sessionParams.subscription_data = {
        trial_period_days: trialDays,
        metadata: { userId, tier }
      };
    }

    // Create checkout session
    const session = await stripe.checkout.sessions.create(sessionParams);

    const response: CheckoutSessionResponse = {
      checkoutUrl: session.url || '',
      sessionId: session.id
    };

    return response;
  } catch (error) {
    console.error('[createCheckoutSession] Error:', error);
    throw new Error('Failed to create checkout session');
  }
});
