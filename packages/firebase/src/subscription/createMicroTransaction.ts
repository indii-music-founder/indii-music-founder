import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';
import { stripe } from '../stripe/config';
import Stripe from 'stripe';
import { stripeSecretKey, arcjetKey } from '../config/secrets';
import { validateAppCheckV2 } from '../middleware/appCheck';
import { protectAuthenticatedApiRequest } from '../functions/security/arcjet';

export const createMicroTransaction = onCall({
  secrets: [stripeSecretKey, arcjetKey],
  timeoutSeconds: 60,
  memory: '512MiB',
  enforceAppCheck: false,
}, async (request) => {
  validateAppCheckV2(request);
  if (!request.auth || !request.auth.uid) {
    throw new HttpsError('unauthenticated', 'Unauthorized');
  }
  if (request.auth.token?.firebase?.sign_in_provider === 'anonymous') {
    throw new HttpsError('permission-denied', 'Anonymous accounts may not perform this operation.');
  }
  if (request.rawRequest) {
    const protection = await protectAuthenticatedApiRequest(request.rawRequest as never, {
      userId: request.auth.uid,
      policy: 'verified-free',
      operationId: `create-micro-transaction:${request.auth.uid}`,
    });
    if (!protection.allowed) {
      throw new HttpsError('resource-exhausted', 'Request rate limit exceeded. Please try again later.');
    }
  }

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
      await db.collection('subscriptions').doc(userId).set({ stripeCustomerId }, { merge: true });
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    if (error instanceof HttpsError) {
      throw error;
    }
    console.error('[createMicroTransaction] Error:', error);
    throw new HttpsError('internal', error.message || 'Failed to create micro-transaction session');
  }
});
