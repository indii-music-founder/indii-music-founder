/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Firebase Cloud Function: Create Stripe Checkout Session
 *
 * Creates a Stripe checkout session for subscription purchase or upgrade.
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';
import { randomUUID } from 'node:crypto';
import { stripe, getPriceId } from '../stripe/config';
import { prepaidOffer, assertPrepaidCatalog } from '../stripe/prepaidPricing';
import { assertAllowedStripeRedirectUrl } from '../stripe/redirectAllowlist';
import Stripe from 'stripe';
import { CheckoutSessionParams, CheckoutSessionResponse } from '../shared/subscription/types';
import { Subscription, SubscriptionTier } from '../shared/subscription/types';
import { stripeSecretKey, arcjetKey } from '../config/secrets';
import { protectAuthenticatedApiRequest } from '../functions/security/arcjet';
import { validateAppCheckV2 } from '../middleware/appCheck';

export const createCheckoutSession = onCall({
  secrets: [stripeSecretKey, arcjetKey],
  timeoutSeconds: 60,
  memory: '512MiB',
  enforceAppCheck: false,
}, async (request) => {
  const { userId, tier, billingPeriod, successUrl, cancelUrl, customerEmail, trialDays } = request.data as CheckoutSessionParams;

  if (!userId || userId !== request.auth?.uid) {
    throw new HttpsError('unauthenticated', 'Unauthorized');
  }

  if (request.auth?.token?.email_verified === false || request.auth?.token?.firebase?.sign_in_provider === 'anonymous') {
    throw new HttpsError('unauthenticated', 'A verified signed-in user is required to create a checkout session.');
  }

  validateAppCheckV2(request);

  if (request.rawRequest) {
    const protection = await protectAuthenticatedApiRequest(request.rawRequest as never, {
      userId,
      policy: request.auth?.token?.admin ? 'admin' : 'verified-free',
      operationId: `create-checkout-session:${randomUUID()}`,
    });
    if (!protection.allowed) {
      throw new HttpsError(
        protection.status === 429 ? 'resource-exhausted' : protection.status === 403 ? 'permission-denied' : 'unavailable',
        protection.message,
      );
    }
  }

  if (tier === SubscriptionTier.FREE) {
    throw new HttpsError('invalid-argument', 'Cannot create checkout session for free tier');
  }

  if (tier === SubscriptionTier.FOUNDER) {
    throw new HttpsError('invalid-argument', 'Founder passes must be activated manually via admin.');
  }

  const validatedSuccessUrl = assertAllowedStripeRedirectUrl(successUrl, 'successUrl');
  const validatedCancelUrl = assertAllowedStripeRedirectUrl(cancelUrl, 'cancelUrl');

  try {
    // Determine price ID and cadence
    const cadence = billingPeriod ?? (tier === SubscriptionTier.PRO_YEARLY ? 'annual' : 'monthly');
    const priceId = getPriceId(tier, cadence);

    if (!priceId) {
      throw new HttpsError('failed-precondition', `No Stripe price configured for tier: ${tier} (${cadence})`);
    }

    const offer = prepaidOffer(tier, cadence);
    let introductoryCoupon: string | undefined;
    if (offer) {
      introductoryCoupon = process.env[offer.couponEnv];
      if (!introductoryCoupon) {
        throw new HttpsError('failed-precondition', 'Introductory prepaid billing is not configured yet.');
      }
      const [price, coupon] = await Promise.all([
        stripe.prices.retrieve(priceId),
        stripe.coupons.retrieve(introductoryCoupon, { expand: ['applies_to'] }),
      ]);
      assertPrepaidCatalog(price, coupon, offer);
    }

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
        }, { idempotencyKey: `create_customer_${userId}` });
        stripeCustomerId = customer.id;

        // Update subscription with Stripe customer ID
        await subscriptionDoc.ref.update({ stripeCustomerId });
      }
    } else {
      // Create new Stripe customer for new user
      const customer = await stripe.customers.create({
        email: customerEmail || request.auth?.token?.email,
        metadata: { userId }
      }, { idempotencyKey: `create_customer_${userId}` });
      stripeCustomerId = customer.id;
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
      success_url: validatedSuccessUrl,
      cancel_url: validatedCancelUrl,
      metadata: { userId, tier, billingPeriod: cadence },
      // A once-only fixed discount preserves whole-dollar first-term prices.
      // Do not stack customer promotion codes onto the introductory offer.
      ...(introductoryCoupon ? {
        discounts: [{ coupon: introductoryCoupon }],
        subscription_data: { metadata: { userId, tier, billingPeriod: cadence, introductoryOffer: 'first_prepaid_term_v1' } },
      } : { allow_promotion_codes: true }),
      automatic_tax: { enabled: true },
      client_reference_id: userId
    };

    // Add trial period if specified.
    // SECURITY: trialDays previously came straight from the client — any user
    // could mint an arbitrarily long free trial. Clamp to a server-side max
    // regardless of what the client sends.
    const SERVER_MAX_TRIAL_DAYS = 14;
    if (trialDays && trialDays > 0) {
      sessionParams.subscription_data = {
        ...sessionParams.subscription_data,
        trial_period_days: Math.min(Math.floor(trialDays), SERVER_MAX_TRIAL_DAYS),
        metadata: { ...sessionParams.subscription_data?.metadata, userId, tier, billingPeriod: cadence }
      };
    }

    // Create checkout session
    const session = await stripe.checkout.sessions.create(sessionParams);

    const response: CheckoutSessionResponse = {
      checkoutUrl: session.url || '',
      sessionId: session.id
    };

    return response;
  } catch (error: any) {
    if (error instanceof HttpsError) {
      throw error;
    }
    console.error('[createCheckoutSession] Error:', error);
    throw new HttpsError('internal', error.message || 'Failed to create checkout session');
  }
});
