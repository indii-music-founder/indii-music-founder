/**
 * POD paid-order gate (ISSUE-1407, founder decision 2026-08-28: Stripe
 * Checkout per order).
 *
 * Printful orders were pinned to drafts (containment in pod_printfulCreateOrder)
 * because nothing bound a payment to an order before confirmation — an
 * accidental confirm charged indii's Printful account directly.
 *
 * This module closes that loop:
 *   1. `pod_createOrderCheckout` binds a Stripe Checkout session to a specific
 *      Printful DRAFT order owned by the caller. The customer price is derived
 *      server-side from Printful's own cost estimate plus a platform markup —
 *      never from client input.
 *   2. The `checkout.session.completed` webhook (metadata.type === 'pod_order',
 *      handled in stripe/webhookHandler.ts) re-verifies the paid amount against
 *      the stored binding and only then confirms the Printful order.
 *
 * Until the webhook confirms, an order remains a Printful draft: a cancelled or
 * expired checkout leaves the draft in place and nothing is ever fulfilled or
 * charged to indii's Printful account by this path.
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions';
import { stripe } from '../stripe/config';
import { printfulApiKey, stripeSecretKey } from '../config/secrets';
import { getPrintfulOrder, estimatePrintfulOrderCosts } from './printfulApi';

const CHECKOUT_TTL_SECONDS = 30 * 60; // 30 minutes, mirroring marketplace checkout

export interface CreatePodCheckoutParams {
  orderId: string | number;
  successUrl: string;
  cancelUrl: string;
}

/**
 * Parse Printful's cost estimate into integer cents. Printful's v1
 * estimate-costs result reports money as decimal strings in the response
 * currency; this parser accepts either a top-level `{ total, currency }` or a
 * nested `{ cost: { total, currency } }` shape and rejects anything it cannot
 * interpret as a positive amount, rather than guessing.
 */
export function extractEstimateCents(estimate: unknown): { cents: number; currency: string } {
  const e = (estimate ?? {}) as {
    total?: unknown;
    currency?: unknown;
    cost?: { total?: unknown; currency?: unknown };
  };
  const rawTotal = e.total ?? e.cost?.total;
  const rawCurrency = e.currency ?? e.cost?.currency;

  const dollars = typeof rawTotal === 'number' ? rawTotal : Number(String(rawTotal ?? '').trim());
  if (!Number.isFinite(dollars) || dollars <= 0) {
    throw new HttpsError('internal', 'Printful returned an unusable cost estimate for this order.');
  }
  const currency = typeof rawCurrency === 'string' && rawCurrency.trim().length >= 3
    ? rawCurrency.trim().toLowerCase()
    : 'usd';
  return { cents: Math.round(dollars * 100), currency };
}

/**
 * Platform markup over Printful fulfillment cost, in whole percent. Read from
 * the server-owned `config/podCheckout` document (field `markupPercent`),
 * falling back to the POD_CHECKOUT_MARKUP_PERCENT env var, then 25%. Clamped
 * to [0, 500] so a config typo can never produce an absurd charge.
 */
export async function resolvePodMarkupPercent(): Promise<number> {
  let configured: unknown;
  try {
    const snap = await getFirestore().collection('config').doc('podCheckout').get();
    configured = snap.data()?.markupPercent;
  } catch (error: unknown) {
    logger.warn('[podCreateOrderCheckout] Could not read config/podCheckout — using fallback markup', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
  let markup: number;
  if (typeof configured === 'number' && Number.isFinite(configured)) {
    markup = configured;
  } else {
    const envValue = Number(process.env.POD_CHECKOUT_MARKUP_PERCENT);
    markup = Number.isFinite(envValue) ? envValue : 25;
  }
  return Math.max(0, Math.min(500, Math.floor(markup)));
}

function assertAllowedRedirect(url: string, field: string): void {
  const allowlist = (process.env.POD_CHECKOUT_URL_ALLOWLIST
    ?? 'https://app.indii.music,https://indii.music')
    .split(',')
    .map((entry) => entry.trim().replace(/\/$/, ''))
    .filter(Boolean);
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new HttpsError('invalid-argument', `${field} is not a valid URL.`);
  }
  if (parsed.protocol !== 'https:' || !allowlist.includes(`${parsed.protocol}//${parsed.host}`)) {
    throw new HttpsError('invalid-argument', `${field} must point at an approved indii.music origin.`);
  }
}

export const pod_createOrderCheckout = onCall({
  secrets: [printfulApiKey, stripeSecretKey],
  timeoutSeconds: 30,
  memory: '512MiB',
  enforceAppCheck: true,
}, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) {
    throw new HttpsError('unauthenticated', 'User must be signed in.');
  }

  const { orderId, successUrl, cancelUrl } = request.data as CreatePodCheckoutParams;
  if (!orderId || !successUrl || !cancelUrl) {
    throw new HttpsError('invalid-argument', 'orderId, successUrl, and cancelUrl are required.');
  }
  assertAllowedRedirect(successUrl, 'successUrl');
  assertAllowedRedirect(cancelUrl, 'cancelUrl');

  const db = getFirestore();
  const orderDocRef = db.collection('users').doc(uid).collection('pod_orders').doc(String(orderId));
  const orderDocSnap = await orderDocRef.get();
  if (!orderDocSnap.exists) {
    throw new HttpsError('permission-denied', 'You do not have permission to check out this order.');
  }
  const orderDoc = orderDocSnap.data()!;
  if (orderDoc.status === 'confirmed') {
    throw new HttpsError('failed-precondition', 'This order is already confirmed and paid.');
  }
  if (orderDoc.status === 'cancelled') {
    throw new HttpsError('failed-precondition', 'This order was cancelled.');
  }
  if (orderDoc.status === 'awaiting_payment' && orderDoc.checkoutSessionId) {
    logger.warn(`[podCreateOrderCheckout] Order ${orderId} already has a checkout binding — creating a fresh session`);
  }

  // The order must still be a Printful DRAFT — confirming happens only in the
  // paid webhook, never here.
  const printfulOrder = await getPrintfulOrder<{ status?: string; items?: Array<Record<string, unknown>>; recipient?: Record<string, unknown> }>(orderId);
  if (printfulOrder.status !== 'draft') {
    throw new HttpsError('failed-precondition', `Only draft orders can be checked out (order is ${String(printfulOrder.status)}).`);
  }

  const estimate = await estimatePrintfulOrderCosts({
    items: printfulOrder.items ?? [],
    recipient: printfulOrder.recipient ?? {},
  });
  const { cents: fulfillmentCents, currency } = extractEstimateCents(estimate);
  const markupPercent = await resolvePodMarkupPercent();
  const customerCents = Math.round(fulfillmentCents * (1 + markupPercent / 100));

  let session;
  try {
    session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      customer_email: request.auth?.token?.email || undefined,
      line_items: [{
        price_data: {
          currency,
          unit_amount: customerCents,
          product_data: { name: `indii merch order #${String(orderId)}` },
        },
        quantity: 1,
      }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      expires_at: Math.floor((Date.now() + CHECKOUT_TTL_SECONDS * 1000) / 1000),
      metadata: {
        type: 'pod_order',
        userId: uid,
        printfulOrderId: String(orderId),
        fulfillmentEstimateCents: String(fulfillmentCents),
      },
      client_reference_id: uid,
    }, {
      idempotencyKey: `pod_checkout_${uid}_${orderId}`,
    });
  } catch (error: unknown) {
    logger.error('[podCreateOrderCheckout] Stripe session creation failed:', error);
    throw new HttpsError('internal', error instanceof Error ? error.message : 'Failed to create checkout session.');
  }

  await orderDocRef.set({
    status: 'awaiting_payment',
    checkoutSessionId: session.id,
    customerCents,
    fulfillmentEstimateCents: fulfillmentCents,
    currency,
    markupPercent,
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });

  logger.info(`[podCreateOrderCheckout] Checkout bound: order ${orderId} → session ${session.id} (${customerCents} cents, markup ${markupPercent}%)`);
  return { checkoutUrl: session.url || '', sessionId: session.id, customerCents, currency };
});
