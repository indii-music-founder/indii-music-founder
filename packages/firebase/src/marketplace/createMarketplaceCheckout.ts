/**
 * Firebase Cloud Function: Create Marketplace Checkout
 *
 * Server-authoritative Stripe Checkout session creation for marketplace
 * purchases. Fixes ISSUE-977 (client-supplied amount caused a 100x pricing
 * error) and ISSUE-978 (inventory/revenue were mutated before payment
 * succeeded) by:
 *
 *   1. Loading the product's price directly from Firestore — never trusting
 *      a client-supplied amount.
 *   2. Atomically reserving inventory (if tracked) for a short window tied
 *      to the Stripe Checkout session's own expiry, so a concurrent buyer
 *      cannot oversell the same last unit.
 *   3. Deferring the actual sale/revenue/entitlement record to the
 *      `checkout.session.completed` webhook (see webhookHandler.ts), which
 *      only fires after Stripe confirms payment.
 *
 * Reservation release on cancel/expiry is handled by the
 * `checkout.session.expired` webhook event.
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions';
import { stripe } from '../stripe/config';
import { stripeSecretKey } from '../config/secrets';

const RESERVATION_TTL_SECONDS = 30 * 60; // 30 minutes

export interface CreateMarketplaceCheckoutParams {
  productId: string;
  source?: string;
  sourceId?: string;
  successUrl: string;
  cancelUrl: string;
}

export const createMarketplaceCheckout = onCall({
  secrets: [stripeSecretKey],
  timeoutSeconds: 30,
  memory: '512MiB',
  enforceAppCheck: true,
}, async (request) => {
  const buyerId = request.auth?.uid;
  if (!buyerId) {
    throw new HttpsError('unauthenticated', 'User must be signed in.');
  }

  const { productId, source, sourceId, successUrl, cancelUrl } = request.data as CreateMarketplaceCheckoutParams;
  if (!productId || !successUrl || !cancelUrl) {
    throw new HttpsError('invalid-argument', 'productId, successUrl, and cancelUrl are required.');
  }

  const db = getFirestore();
  const productRef = db.collection('products').doc(productId);
  const reservationRef = db.collection('marketplace_reservations').doc();

  // Atomically validate + reserve inventory (if tracked) before ever talking to Stripe.
  const reservation = await db.runTransaction(async (tx) => {
    const productSnap = await tx.get(productRef);
    if (!productSnap.exists) {
      throw new HttpsError('not-found', 'Product not found.');
    }
    const product = productSnap.data()!;
    if (product.isActive !== true) {
      throw new HttpsError('failed-precondition', 'This product is no longer available.');
    }
    if (product.sellerId === buyerId) {
      throw new HttpsError('failed-precondition', 'Sellers cannot purchase their own listing.');
    }

    const hasInventoryTracking = typeof product.inventory === 'number';
    if (hasInventoryTracking && product.inventory <= 0) {
      throw new HttpsError('failed-precondition', 'This item is sold out.');
    }

    if (hasInventoryTracking) {
      tx.update(productRef, { inventory: FieldValue.increment(-1) });
    }

    const priceCents = product.price; // Already an integer in cents — authoritative, server-loaded.
    const expiresAt = Date.now() + RESERVATION_TTL_SECONDS * 1000;

    tx.set(reservationRef, {
      productId,
      buyerId,
      sellerId: product.sellerId,
      productTitle: product.title,
      priceCents,
      currency: product.currency || 'USD',
      hasInventoryTracking,
      source: source || 'direct',
      sourceId: sourceId || null,
      status: 'reserved',
      expiresAt,
      createdAt: FieldValue.serverTimestamp(),
    });

    return { priceCents, title: product.title as string, sellerId: product.sellerId as string, currency: (product.currency as string) || 'USD' };
  });

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      customer_email: request.auth?.token?.email || undefined,
      line_items: [{
        price_data: {
          currency: reservation.currency.toLowerCase(),
          unit_amount: reservation.priceCents,
          product_data: { name: reservation.title },
        },
        quantity: 1,
      }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      expires_at: Math.floor((Date.now() + RESERVATION_TTL_SECONDS * 1000) / 1000),
      metadata: {
        type: 'marketplace_purchase',
        reservationId: reservationRef.id,
        productId,
        buyerId,
        sellerId: reservation.sellerId,
        source: source || 'direct',
        sourceId: sourceId || '',
      },
      client_reference_id: buyerId,
    });

    await reservationRef.update({ stripeSessionId: session.id });

    return { checkoutUrl: session.url || '', sessionId: session.id };
  } catch (error: unknown) {
    logger.error('[createMarketplaceCheckout] Stripe session creation failed — releasing reservation:', error);

    // Release the reservation since no checkout session was ever created for it.
    await db.runTransaction(async (tx) => {
      const resSnap = await tx.get(reservationRef);
      if (!resSnap.exists || resSnap.data()?.status !== 'reserved') return;
      if (resSnap.data()?.hasInventoryTracking) {
        tx.update(productRef, { inventory: FieldValue.increment(1) });
      }
      tx.update(reservationRef, { status: 'released', releasedReason: 'checkout_creation_failed' });
    });

    throw new HttpsError('internal', error instanceof Error ? error.message : 'Failed to create checkout session.');
  }
});
