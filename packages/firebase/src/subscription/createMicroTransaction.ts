import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';
import { stripe } from '../stripe/config';
import Stripe from 'stripe';
import { stripeSecretKey } from '../config/secrets';

export const createMicroTransaction = onCall({
  secrets: [stripeSecretKey],
  timeoutSeconds: 60,
  memory: '256MiB',
  enforceAppCheck: true, // App Check globally active
}, async (request) => {
  const { userId, credits, successUrl, cancelUrl } = request.data as { userId: string, credits: number, successUrl: string, cancelUrl: string };

  if (!userId || userId !== request.auth?.uid) {
    throw new HttpsError('unauthenticated', 'Unauthorized');
  }

  if (!credits || credits <= 0) {
    throw new HttpsError('invalid-argument', 'Credits must be greater than 0');
  }

  try {
    const db = getFirestore();

    // Get or create Stripe customer
    const subscriptionDoc = await db.collection('subscriptions').doc(userId).get();
    let stripeCustomerId: string;

    if (subscriptionDoc.exists) {
      const subscription = subscriptionDoc.data();
      if (subscription?.stripeCustomerId) {
        stripeCustomerId = subscription.stripeCustomerId;
      } else {
        const customer = await stripe.customers.create({
          email: request.auth?.token?.email,
          metadata: { userId }
        }, { idempotencyKey: `create_customer_mt_${userId}` });
        stripeCustomerId = customer.id;
        await subscriptionDoc.ref.update({ stripeCustomerId });
      }
    } else {
      const customer = await stripe.customers.create({
        email: request.auth?.token?.email,
        metadata: { userId }
      }, { idempotencyKey: `create_customer_mt_${userId}` });
      stripeCustomerId = customer.id;
    }

    const priceId = process.env.STRIPE_PRICE_CREDIT_PACK;

    if (!priceId) {
      throw new HttpsError('failed-precondition', 'No Stripe price configured for micro-transactions');
    }

    // Build checkout session parameters
    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      mode: 'payment',
      payment_method_types: ['card'],
      customer: stripeCustomerId,
      line_items: [
        {
          price: priceId,
          quantity: credits
        }
      ],
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: { userId, type: 'micro_transaction', credits: credits.toString() },
      client_reference_id: userId
    };

    const session = await stripe.checkout.sessions.create(sessionParams);

    return {
      checkoutUrl: session.url || '',
      sessionId: session.id
    };
  } catch (error: any) {
    if (error instanceof HttpsError) {
      throw error;
    }
    console.error('[createMicroTransaction] Error:', error);
    throw new HttpsError('internal', error.message || 'Failed to create micro-transaction session');
  }
});
