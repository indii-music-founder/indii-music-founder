/**
 * Firebase Cloud Function: Stripe Webhook Handler
 *
 * Handles Stripe webhook events to keep subscriptions in sync.
 */

import { onRequest } from 'firebase-functions/v2/https';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions';
import Stripe from 'stripe';
import { stripe, mapStripeStatus, mapStripeTierToSubscriptionTier } from './config';
import { SubscriptionTier, Subscription as LocalSubscription } from '../shared/subscription/types';
import { stripeSecretKey, stripeWebhookSecret, getStripeWebhookSecret } from '../config/secrets';
import { enqueueConversionEvent } from '../marketing/conversionEventOutbox';
import { buildConversionEventId } from '@indii/shared';

function maskId(id: string): string {
  if (!id) return '';
  return id.length > 4 ? `${id.slice(0, 4)}***` : '***';
}

/**
 * Verify Stripe webhook signature
 */
function verifyStripeWebhook(
  payload: string,
  signature: string,
  secret: string
): Stripe.Event {
  return stripe.webhooks.constructEvent(payload, signature, secret);
}


/**
 * Handle checkout.session.completed event
 */
async function handleMicroTransactionCheckoutCompleted(session: Stripe.Checkout.Session): Promise<void> {
  if (session.payment_status !== 'paid') {
    logger.info(`[handleMicroTransaction] Session ${session.id} not paid yet (${session.payment_status})`);
    return;
  }

  const userId = session.metadata?.userId;
  const credits = parseInt(session.metadata?.credits || '0', 10);

  if (!userId || isNaN(credits) || credits <= 0) {
    logger.error('[handleMicroTransaction] Invalid metadata for micro-transaction');
    return;
  }

  // SECURITY (defense in depth): metadata alone is never authority for
  // minting credits. A genuine credit-pack session was created by
  // createMicroTransaction with exactly one line item priced at the
  // configured STRIPE_PRICE_CREDIT_PACK and quantity == credits. Re-read the
  // session from Stripe and require that shape before touching user_credits,
  // so a forged or mis-routed session can never mint arbitrary credits.
  const expectedPriceId = process.env.STRIPE_PRICE_CREDIT_PACK;
  if (!expectedPriceId) {
    logger.error('[handleMicroTransaction] STRIPE_PRICE_CREDIT_PACK is not configured — refusing to credit');
    return;
  }
  let lineItems: Stripe.LineItem[] = [];
  try {
    const liveSession = await stripe.checkout.sessions.retrieve(session.id, {
      expand: ['line_items'],
    });
    lineItems = liveSession.line_items?.data ?? [];
  } catch (error: unknown) {
    logger.error(`[handleMicroTransaction] Failed to re-retrieve session ${session.id} from Stripe — refusing to credit`, {
      error: error instanceof Error ? error.message : String(error),
    });
    return;
  }
  const singleLineItem = lineItems.length === 1 ? lineItems[0] : undefined;
  if (!singleLineItem || singleLineItem.price?.id !== expectedPriceId || singleLineItem.quantity !== credits) {
    logger.error(
      `[handleMicroTransaction] Session ${session.id} does not match the configured credit pack (items=${lineItems.length}, price=${singleLineItem?.price?.id ?? 'none'}, qty=${singleLineItem?.quantity ?? 'n/a'}, credits=${credits}) — refusing to credit`,
    );
    return;
  }

  const db = getFirestore();
  const creditsRef = db.collection('user_credits').doc(userId);
  // Deterministic per-session log. Checking it FIRST inside the transaction
  // makes the whole credit operation idempotent: a stale-processing retake
  // (>5 min) re-executes this handler, and without this guard the second
  // transaction would credit the balance again for the same purchase.
  const logRef = db.collection('user_credits').doc(userId).collection('transactions').doc(session.id);

  await db.runTransaction(async (t) => {
    const logSnap = await t.get(logRef);
    if (logSnap.exists) {
      logger.info(`[handleMicroTransaction] Session ${session.id} already credited — skipping duplicate delivery.`);
      return;
    }
    const doc = await t.get(creditsRef);
    if (!doc.exists) {
      t.set(creditsRef, { balance: credits, updatedAt: Date.now() });
    } else {
      const currentBalance = doc.data()?.balance || 0;
      t.update(creditsRef, { balance: currentBalance + credits, updatedAt: Date.now() });
    }

    t.set(logRef, {
      amount: credits,
      type: 'purchase',
      sessionId: session.id,
      timestamp: Date.now()
    });
  });

  logger.info(`[handleMicroTransaction] Added ${credits} credits to user ${maskId(userId)}`);
}

async function handleLicensingCheckoutCompleted(session: Stripe.Checkout.Session): Promise<void> {
  if (session.payment_status !== 'paid') {
    logger.info(`[handleLicensingCheckoutCompleted] Session ${session.id} not paid yet (${session.payment_status})`);
    return;
  }

  const userId = session.metadata?.userId;
  const agreementId = session.metadata?.agreementId;
  const expectedTermsHash = session.metadata?.termsHash;
  if (!userId || !agreementId || !expectedTermsHash) {
    throw new Error('Licensing checkout is missing a versioned agreement reference.');
  }

  const db = getFirestore();
  const agreementRef = db.collection('license_agreements').doc(agreementId);
  const agreementSnapshot = await agreementRef.get();
  if (!agreementSnapshot.exists) throw new Error(`License agreement ${agreementId} was not found.`);

  const agreement = agreementSnapshot.data() ?? {};
  const licensee = agreement.licensee as { name?: unknown; email?: unknown } | undefined;
  const term = agreement.term as { startsAt?: unknown; endsAt?: unknown } | undefined;
  const rightsCovered = agreement.rightsCovered;
  const feeCents = agreement.feeCents;
  const connectedAccountId = agreement.connectedAccountId;
  const trackTitle = agreement.trackTitle;
  const artist = agreement.artist;

  const agreementIsComplete = agreement.status === 'accepted'
    && agreement.licensorUserId === userId
    && typeof agreement.agreementVersion === 'string' && agreement.agreementVersion.length > 0
    && typeof agreement.termsHash === 'string' && agreement.termsHash === expectedTermsHash
    && typeof agreement.acceptedAt !== 'undefined' && agreement.acceptedAt !== null
    && typeof licensee?.name === 'string' && licensee.name.trim().length > 0
    && typeof licensee?.email === 'string' && licensee.email.trim().length > 0
    && typeof agreement.usage === 'string' && agreement.usage.trim().length > 0
    && typeof agreement.territory === 'string' && agreement.territory.trim().length > 0
    && typeof term?.startsAt !== 'undefined' && term.startsAt !== null
    && Object.prototype.hasOwnProperty.call(term ?? {}, 'endsAt')
    && (agreement.exclusivity === 'exclusive' || agreement.exclusivity === 'non-exclusive')
    && Array.isArray(rightsCovered) && rightsCovered.length > 0
    && rightsCovered.every((right) => typeof right === 'string' && right.trim().length > 0)
    && typeof agreement.masterRights === 'boolean'
    && typeof agreement.compositionRights === 'boolean'
    && Number.isInteger(feeCents) && feeCents > 0
    && typeof connectedAccountId === 'string' && /^acct_[a-zA-Z0-9]+$/.test(connectedAccountId)
    && typeof trackTitle === 'string' && trackTitle.trim().length > 0
    && typeof artist === 'string' && artist.trim().length > 0;

  if (!agreementIsComplete) {
    throw new Error(`License agreement ${agreementId} is incomplete or was not accepted.`);
  }
  if (session.consent?.terms_of_service !== 'accepted') {
    throw new Error(`License agreement ${agreementId} lacks Stripe terms acceptance.`);
  }
  if (session.customer_details?.email
    && session.customer_details.email.toLowerCase() !== String(licensee.email).toLowerCase()) {
    throw new Error(`License agreement ${agreementId} licensee does not match the Stripe customer.`);
  }
  if (typeof session.amount_subtotal !== 'number' || session.amount_subtotal < feeCents) {
    throw new Error(`License checkout ${session.id} was underpaid for agreement ${agreementId}.`);
  }

  const artistAmount = feeCents as number;

  // Execute Stripe transfer to connected account
  let transfer: Stripe.Transfer;
  try {
    transfer = await stripe.transfers.create({
      amount: artistAmount,
      currency: 'usd',
      destination: connectedAccountId,
      description: `indii Sync License payout - Session: ${session.id}`,
    }, {
      idempotencyKey: `transfer_${session.id}`,
    });
    logger.info(`[handleLicensingCheckoutCompleted] Transferred ${artistAmount} cents to connected account ${connectedAccountId}, transferId: ${transfer.id}`);
  } catch (err: any) {
    logger.error(`[handleLicensingCheckoutCompleted] Stripe transfer failed for session ${session.id}:`, err);
    throw err; // Throw to trigger webhook retry
  }

  // Record fulfillment with deterministic document IDs. Stripe retries return
  // the same transfer for the idempotency key above; deterministic Firestore
  // IDs make the rest of fulfillment idempotent as well. A batch prevents a
  // license without its matching financial ledger entry (or vice versa).
  const licenseRef = db.collection('licenses').doc(session.id);
  const ledgerRef = db.collection(`users/${userId}/ledger`).doc(`sync_license_${session.id}`);
  const batch = db.batch();

  batch.set(licenseRef, {
    userId,
    title: trackTitle,
    artist,
    licenseType: 'sync',
    status: 'active',
    amount: artistAmount,
    agreementId,
    agreementVersion: agreement.agreementVersion,
    termsHash: agreement.termsHash,
    licensee,
    usage: agreement.usage,
    territory: agreement.territory,
    term,
    exclusivity: agreement.exclusivity,
    rightsCovered,
    masterRights: agreement.masterRights,
    compositionRights: agreement.compositionRights,
    acceptedAt: agreement.acceptedAt,
    stripeSessionId: session.id,
    stripeTransferId: transfer.id,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });

  batch.set(ledgerRef, {
    type: 'sync_license_sale',
    amount: artistAmount,
    currency: 'usd',
    status: 'paid',
    stripeSessionId: session.id,
    stripeTransferId: transfer.id,
    createdAt: FieldValue.serverTimestamp(),
  }, { merge: true });

  batch.set(agreementRef, {
    status: 'active',
    stripeSessionId: session.id,
    stripeTransferId: transfer.id,
    fulfilledAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });

  await batch.commit();
}

/**
 * Founder seat purchase completed (ISSUE-866).
 *
 * Founder activation itself stays a deliberate step (seat numbering, public
 * display name, agreement hash, GitHub commit — see activateFounderPass), but
 * the PAYMENT must never be silently dropped. This handler verifies the paid
 * amount, records an idempotent fulfillment task, and flags the user profile
 * so the UI can show "payment received — activation pending".
 */
async function handleFounderSeatCheckoutCompleted(session: Stripe.Checkout.Session): Promise<void> {
  const userId = session.metadata?.userId || session.client_reference_id;
  if (!userId) {
    logger.error('[handleFounderSeatCheckoutCompleted] Missing userId metadata — cannot fulfill', { sessionId: session.id });
    throw new Error('Founder seat checkout is missing userId metadata');
  }

  const FOUNDER_SEAT_PRICE_CENTS = 250000; // $2,500.00
  const paidCents = session.amount_total ?? 0;
  if (paidCents < FOUNDER_SEAT_PRICE_CENTS) {
    logger.error(`[handleFounderSeatCheckoutCompleted] Underpaid founder seat: ${paidCents} < ${FOUNDER_SEAT_PRICE_CENTS}`, { sessionId: session.id });
    throw new Error('Founder seat payment amount below seat price');
  }

  const db = getFirestore();
  // Idempotent by session id — Stripe retries must not duplicate the task.
  await db.collection('founder_fulfillment_queue').doc(session.id).set({
    userId,
    stripeSessionId: session.id,
    paymentIntentId: typeof session.payment_intent === 'string' ? session.payment_intent : null,
    amountCents: paidCents,
    customerEmail: session.customer_details?.email || null,
    status: 'paid_pending_activation',
    createdAt: FieldValue.serverTimestamp(),
  }, { merge: true });

  await db.collection('users').doc(userId).set({
    founderPaymentStatus: 'paid_pending_activation',
    founderPaymentSessionId: session.id,
    founderPaidAt: FieldValue.serverTimestamp(),
  }, { merge: true });

  logger.info(`[handleFounderSeatCheckoutCompleted] Founder payment recorded for ${maskId(userId)} — activation queued`);
}

/**
 * Marketplace purchase completed (ISSUE-977 / ISSUE-978).
 *
 * The reservation (see createMarketplaceCheckout.ts) already decremented
 * inventory atomically before Stripe was ever contacted. This handler's job
 * is purely to turn a *paid* reservation into a durable, idempotent sale —
 * it must never touch inventory again (that already happened at reservation
 * time, which is what prevents oversell).
 */
async function handleMarketplacePurchaseCompleted(session: Stripe.Checkout.Session): Promise<void> {
  if (session.payment_status !== 'paid') {
    logger.info(`[handleMarketplacePurchaseCompleted] Session ${session.id} not paid yet (${session.payment_status})`);
    return;
  }

  const reservationId = session.metadata?.reservationId;
  if (!reservationId) {
    logger.error('[handleMarketplacePurchaseCompleted] Missing reservationId metadata', { sessionId: session.id });
    return;
  }

  const db = getFirestore();
  const reservationRef = db.collection('marketplace_reservations').doc(reservationId);

  await db.runTransaction(async (tx) => {
    const resSnap = await tx.get(reservationRef);
    if (!resSnap.exists) {
      logger.error(`[handleMarketplacePurchaseCompleted] Reservation ${reservationId} not found`);
      return;
    }
    const reservation = resSnap.data()!;

    // Idempotent: duplicate webhook delivery for an already-completed reservation is a no-op.
    if (reservation.status === 'completed') {
      logger.info(`[handleMarketplacePurchaseCompleted] Reservation ${reservationId} already completed — skipping`);
      return;
    }

    // SECURITY (defense in depth): the reservation must be bound to THIS
    // Stripe session, and the paid amount must equal the server-reserved
    // price. A forged checkout carrying someone else's reservationId (or an
    // underpaid session) must never complete that reservation.
    if (reservation.stripeSessionId !== session.id) {
      logger.error(
        `[handleMarketplacePurchaseCompleted] Reservation ${reservationId} is bound to Stripe session ${maskId(String(reservation.stripeSessionId ?? ''))}, not ${maskId(session.id)} — refusing`,
      );
      return;
    }
    if (Number(session.amount_total) !== Number(reservation.priceCents)) {
      logger.error(
        `[handleMarketplacePurchaseCompleted] Paid amount ${String(session.amount_total)} != reserved ${String(reservation.priceCents)} for reservation ${reservationId} — refusing`,
      );
      return;
    }

    const purchaseRef = db.collection('purchases').doc(session.id); // Stripe session id = natural idempotency key
    tx.set(purchaseRef, {
      buyerId: reservation.buyerId,
      sellerId: reservation.sellerId,
      productId: reservation.productId,
      amount: reservation.priceCents,
      currency: reservation.currency,
      status: 'completed',
      transactionId: session.id,
      createdAt: FieldValue.serverTimestamp(),
    }, { merge: true });

    tx.set(db.collection('revenue').doc(), {
      userId: reservation.sellerId,
      productId: reservation.productId,
      productName: reservation.productTitle,
      amount: reservation.priceCents,
      currency: reservation.currency,
      source: reservation.source === 'social' ? 'social_drop' : reservation.source,
      sourceId: reservation.sourceId || undefined,
      customerId: reservation.buyerId,
      status: 'completed',
      createdAt: FieldValue.serverTimestamp(),
    });

    tx.update(reservationRef, { status: 'completed', completedAt: FieldValue.serverTimestamp() });
  });

  logger.info(`[handleMarketplacePurchaseCompleted] Finalized sale for reservation ${reservationId}, session ${session.id}`);
}

/**
 * Marketplace checkout expired/cancelled without payment — release the
 * inventory reservation made at checkout-creation time (ISSUE-978).
 */
async function handleMarketplaceCheckoutExpired(session: Stripe.Checkout.Session): Promise<void> {
  const reservationId = session.metadata?.reservationId;
  if (!reservationId || session.metadata?.type !== 'marketplace_purchase') return;

  const db = getFirestore();
  const reservationRef = db.collection('marketplace_reservations').doc(reservationId);
  const productRef = db.collection('products').doc(session.metadata!.productId as string);

  await db.runTransaction(async (tx) => {
    const resSnap = await tx.get(reservationRef);
    if (!resSnap.exists) return;
    const reservation = resSnap.data()!;

    // Only release reservations still pending — a completed or already-released one is untouched.
    if (reservation.status !== 'reserved') return;

    if (reservation.hasInventoryTracking) {
      tx.update(productRef, { inventory: FieldValue.increment(1) });
    }
    tx.update(reservationRef, { status: 'released', releasedReason: 'checkout_expired' });
  });

  logger.info(`[handleMarketplaceCheckoutExpired] Released reservation ${reservationId} for expired session ${session.id}`);
}

/**
 * Emit a sale conversion event for a Stripe checkout session.
 * Exported for testing.
 */
export async function emitSaleConversion(session: Stripe.Checkout.Session): Promise<void> {
  const userId = session.metadata?.userId;
  if (!userId) return; // Artist unknown, cannot attribute

  const amountCents = session.amount_total ?? 0;
  if (amountCents <= 0) return; // No revenue to record

  const eventId = buildConversionEventId({
    platform: 'stripe',
    eventType: 'sale',
    sourceId: session.id,
  });

  const occurredAt = new Date().toISOString();
  const metadata: Record<string, string> = {
    stripeSessionId: session.id,
  };
  if (session.metadata?.fbclid) {
    metadata.fbclid = session.metadata.fbclid;
  }

  const conversionEvent = {
    schemaVersion: 'conversion-event.v1' as const,
    eventId,
    artistId: userId,
    platform: 'stripe' as const,
    eventType: 'sale' as const,
    occurredAt,
    revenueMinor: amountCents,
    costMinor: 0,
    currency: session.currency?.toUpperCase() || 'USD',
    campaignId: session.metadata?.campaignId || '',
    adCreativeId: '',
    smartLinkSlug: '',
    utmSource: '',
    utmMedium: '',
    utmCampaign: '',
    metadata,
  };

  await enqueueConversionEvent(conversionEvent);
  logger.info('[emitSaleConversion] Queued Stripe sale conversion', {
    userId: maskId(userId),
    sessionId: session.id,
    revenueMinor: amountCents,
  });
}

async function handleCheckoutCompleted(event: Stripe.Event): Promise<void> {
  const session = event.data.object as Stripe.Checkout.Session;

  // Route micro-transactions separately.
  if (session.metadata?.type === 'micro_transaction') {
    await handleMicroTransactionCheckoutCompleted(session);
    return;
  }

  // Route marketplace purchases separately.
  if (session.metadata?.type === 'marketplace_purchase') {
    await handleMarketplacePurchaseCompleted(session);
    return;
  }

  // Route licensing purchases separately.
  if (session.metadata?.type === 'licensing_purchase') {
    await handleLicensingCheckoutCompleted(session);
    return;
  }

  // Route founder seat purchases separately (ISSUE-866).
  if (session.metadata?.type === 'founder_seat') {
    await handleFounderSeatCheckoutCompleted(session);
    return;
  }

  // Emit sale conversion for all paid checkouts (attributable to an artist).
  try {
    await emitSaleConversion(session);
  } catch (err) {
    logger.warn('[handleCheckoutCompleted] Sale conversion emission failed', { error: err });
    // Non-fatal: subscription logic continues even if conversion emit fails
  }


  if (!session.customer || !session.metadata?.userId || !session.metadata?.tier) {
    logger.error('[handleCheckoutCompleted] Missing required metadata');
    return;
  }

  const userId = session.metadata.userId;
  const tier = session.metadata.tier as SubscriptionTier;
  const stripeCustomerId = session.customer as string;

  // Get subscription details from session
  const subscription = await stripe.subscriptions.retrieve(
    session.subscription as string
  );

  const db = getFirestore();
  const now = Date.now();

  // Update or create subscription
  const subscriptionData: Partial<LocalSubscription> = {
    tier,
    status: mapStripeStatus((subscription as unknown as { status: Stripe.Subscription.Status }).status),
    currentPeriodStart: (subscription as unknown as { current_period_start: number }).current_period_start * 1000,
    currentPeriodEnd: (subscription as unknown as { current_period_end: number }).current_period_end * 1000,
    cancelAtPeriodEnd: (subscription as unknown as { cancel_at_period_end: boolean }).cancel_at_period_end,
    stripeCustomerId,
    stripeSubscriptionId: subscription.id,
    updatedAt: now
  };

  await db.collection('subscriptions').doc(userId).set(subscriptionData, { merge: true });

  logger.info(`[handleCheckoutCompleted] Updated subscription for user ${maskId(userId)}`);
}

/**
 * Helper to update subscription by Stripe customer ID using a transaction.
 * Throws an error if the customer is not found so Stripe can retry later.
 */
async function updateSubscriptionByCustomer(
  stripeCustomerId: string,
  callerName: string,
  updateData: Partial<LocalSubscription>
): Promise<void> {
  const db = getFirestore();

  await db.runTransaction(async (tx) => {
    const snapshot = await tx.get(
      db.collection('subscriptions').where('stripeCustomerId', '==', stripeCustomerId).limit(1)
    );

    if (snapshot.empty) {
      throw new Error(`[${callerName}] No user found for customer ${stripeCustomerId}. Retrying expected.`);
    }

    const docRef = snapshot.docs[0].ref;
    tx.update(docRef, { ...updateData, updatedAt: Date.now() });
    logger.info(`[${callerName}] Updated subscription for user ${maskId(snapshot.docs[0].id)}`);
  });
}

/**
 * Handle customer.subscription.created event
 */
async function handleSubscriptionCreated(event: Stripe.Event): Promise<void> {
  const subscription = event.data.object as Stripe.Subscription;
  const priceItem = subscription.items.data[0];
  const tier = mapStripeTierToSubscriptionTier(
    priceItem?.price.product as string,
    priceItem?.price.recurring?.interval ?? null
  );

  if (!tier) {
    logger.error('[handleSubscriptionCreated] Unknown tier');
    return;
  }

  await updateSubscriptionByCustomer(subscription.customer as string, 'handleSubscriptionCreated', {
    tier,
    status: mapStripeStatus((subscription as unknown as { status: Stripe.Subscription.Status }).status),
    currentPeriodStart: (subscription as unknown as { current_period_start: number }).current_period_start * 1000,
    currentPeriodEnd: (subscription as unknown as { current_period_end: number }).current_period_end * 1000,
    cancelAtPeriodEnd: (subscription as unknown as { cancel_at_period_end: boolean }).cancel_at_period_end,
    stripeSubscriptionId: subscription.id
  });
}

/**
 * Handle customer.subscription.updated event
 */
async function handleSubscriptionUpdated(event: Stripe.Event): Promise<void> {
  const subscription = event.data.object as Stripe.Subscription;
  const priceItem = subscription.items.data[0];
  const tier = mapStripeTierToSubscriptionTier(
    priceItem?.price.product as string,
    priceItem?.price.recurring?.interval ?? null
  );

  if (!tier) {
    logger.error('[handleSubscriptionUpdated] Unknown tier');
    return;
  }

  await updateSubscriptionByCustomer(subscription.customer as string, 'handleSubscriptionUpdated', {
    tier,
    status: mapStripeStatus((subscription as unknown as { status: Stripe.Subscription.Status }).status),
    currentPeriodStart: (subscription as unknown as { current_period_start: number }).current_period_start * 1000,
    currentPeriodEnd: (subscription as unknown as { current_period_end: number }).current_period_end * 1000,
    cancelAtPeriodEnd: (subscription as unknown as { cancel_at_period_end: boolean }).cancel_at_period_end
  });
}

/**
 * Handle customer.subscription.deleted event
 */
async function handleSubscriptionDeleted(event: Stripe.Event): Promise<void> {
  const subscription = event.data.object as Stripe.Subscription;

  await updateSubscriptionByCustomer(subscription.customer as string, 'handleSubscriptionDeleted', {
    tier: SubscriptionTier.FREE,
    status: 'active',
    currentPeriodStart: Date.now(),
    currentPeriodEnd: Date.now() + 30 * 24 * 60 * 60 * 1000,
    cancelAtPeriodEnd: false,
    stripeSubscriptionId: FieldValue.delete() as unknown as string
  });
}

/**
 * Handle invoice.paid event — updates subscription status and writes a
 * ledger entry so the Finance dashboard reflects accurate billing history.
 * Item 208: Revenue Share Ledger real-time sync.
 */
async function handleInvoicePaid(event: Stripe.Event): Promise<void> {
  const invoice = event.data.object as Stripe.Invoice;
  if (!invoice.customer) return;

  let currentPeriodEnd = undefined;
  if ((invoice as unknown as { subscription?: string }).subscription) {
    const subscription = await stripe.subscriptions.retrieve((invoice as unknown as { subscription: string }).subscription);
    currentPeriodEnd = (subscription as unknown as { current_period_end: number }).current_period_end * 1000;
  }

  const updateData: Partial<LocalSubscription> = { status: 'active' };
  if (currentPeriodEnd) {
    updateData.currentPeriodEnd = currentPeriodEnd;
  }

  await updateSubscriptionByCustomer(invoice.customer as string, 'handleInvoicePaid', updateData);

  // Write ledger entry for Finance dashboard
  const db = getFirestore();
  const subSnapshot = await db.collection('subscriptions')
    .where('stripeCustomerId', '==', invoice.customer as string)
    .limit(1)
    .get();

  if (!subSnapshot.empty) {
    const userId = subSnapshot.docs[0].id;
    // Deterministic document ID keyed by the invoice: the webhook idempotency
    // guard allows a retake after a crashed worker (>5 min stale processing),
    // and a second write with a random ID would duplicate the ledger row and
    // double-count the payment in Finance. set() (not add()) makes a duplicate
    // delivery overwrite the same row with identical content.
    await db.collection(`users/${userId}/ledger`).doc(`subscription_payment_${invoice.id}`).set({
      type: 'subscription_payment',
      invoiceId: invoice.id,
      invoiceNumber: invoice.number || invoice.id,
      amount: invoice.total,
      currency: invoice.currency || 'usd',
      status: 'paid',
      periodStart: (invoice as unknown as { period_start?: number }).period_start ? (invoice as unknown as { period_start: number }).period_start * 1000 : null,
      periodEnd: (invoice as unknown as { period_end?: number }).period_end ? (invoice as unknown as { period_end: number }).period_end * 1000 : null,
      pdfUrl: invoice.invoice_pdf || null,
      createdAt: FieldValue.serverTimestamp(),
    });
    logger.info(`[handleInvoicePaid] Ledger entry written for user ${maskId(userId)}`);
  }
}

/**
 * Handle invoice.payment_failed event — marks subscription as past_due and
 * writes a dunning notification record so the UI can prompt re-authentication.
 * Item 204: Failed Payment Dunning Flow.
 */
async function handleInvoicePaymentFailed(event: Stripe.Event): Promise<void> {
  const invoice = event.data.object as Stripe.Invoice;
  if (!invoice.customer) return;

  await updateSubscriptionByCustomer(invoice.customer as string, 'handleInvoicePaymentFailed', {
    status: 'past_due'
  });

  // Write a dunning notification so the client can surface a re-auth prompt.
  // When an email provider (e.g. SendGrid) is configured, process this queue
  // via a separate Cloud Function subscribed to Firestore triggers on
  // `dunning_notifications`.
  const db = getFirestore();
  const subSnapshot = await db.collection('subscriptions')
    .where('stripeCustomerId', '==', invoice.customer as string)
    .limit(1)
    .get();

  if (!subSnapshot.empty) {
    const userId = subSnapshot.docs[0].id;
    // Deterministic ID keyed by the invoice — duplicate delivery (including a
    // stale-processing retake) must not queue the same dunning prompt twice.
    await db.collection('dunning_notifications').doc(`dunning_${invoice.id}`).set({
      userId,
      stripeCustomerId: invoice.customer as string,
      invoiceId: invoice.id,
      amount: invoice.total,
      currency: invoice.currency || 'usd',
      attemptCount: (invoice as unknown as { attempt_count?: number }).attempt_count || 1,
      nextPaymentAttempt: (invoice as unknown as { next_payment_attempt?: number }).next_payment_attempt
        ? (invoice as unknown as { next_payment_attempt: number }).next_payment_attempt * 1000
        : null,
      customerEmail: invoice.customer_email || null,
      status: 'pending',
      createdAt: FieldValue.serverTimestamp(),
    });
    logger.info(`[handleInvoicePaymentFailed] Dunning notification queued for user ${maskId(userId)}`);
  }
}

/**
 * Handle charge.refunded — reverse credit-pack grants when a purchase is
 * fully refunded. Partial refunds are logged but do not claw back credits
 * (pro-rated clawback is tracked in OPEN_ISSUES_V3). Non-credit-pack refunds
 * (subscriptions, marketplace, licensing) need distinct financial flows and
 * are intentionally out of scope here.
 */
async function handleChargeRefunded(event: Stripe.Event): Promise<void> {
  const charge = event.data.object as Stripe.Charge;
  const paymentIntent = typeof charge.payment_intent === 'string' ? charge.payment_intent : null;
  if (!paymentIntent) return;

  let session: Stripe.Checkout.Session | undefined;
  try {
    const sessions = await stripe.checkout.sessions.list({ payment_intent: paymentIntent, limit: 1 });
    session = sessions.data[0];
  } catch (error: unknown) {
    logger.error('[handleChargeRefunded] Failed to look up checkout session — throwing for retry', {
      chargeId: charge.id,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }

  if (!session || session.metadata?.type !== 'micro_transaction') {
    logger.info(`[handleChargeRefunded] Charge ${charge.id} is not a credit-pack purchase — no credit action`);
    return;
  }

  const userId = session.metadata?.userId;
  const credits = parseInt(session.metadata?.credits || '0', 10);
  if (!userId || !Number.isFinite(credits) || credits <= 0) {
    logger.error(`[handleChargeRefunded] Credit-pack session ${session.id} has invalid metadata — cannot reverse`);
    return;
  }

  const fullyRefunded = (charge.amount_refunded ?? 0) >= charge.amount;
  if (!fullyRefunded) {
    logger.info(`[handleChargeRefunded] Partial refund on session ${session.id} — credits not clawed back`);
    return;
  }

  const db = getFirestore();
  const creditsRef = db.collection('user_credits').doc(userId);
  // Deterministic per-charge refund log → idempotent across Stripe retries.
  const refundLogRef = creditsRef.collection('transactions').doc(`refund_${charge.id}`);

  await db.runTransaction(async (t) => {
    const logSnap = await t.get(refundLogRef);
    if (logSnap.exists) {
      logger.info(`[handleChargeRefunded] Charge ${charge.id} already reversed — skipping duplicate delivery`);
      return;
    }
    const doc = await t.get(creditsRef);
    const current = doc.exists ? (doc.data()?.balance || 0) : 0;
    const applied = Math.max(0, Math.min(current, credits));
    if (applied > 0) {
      t.update(creditsRef, { balance: current - applied, updatedAt: Date.now() });
    }
    t.set(refundLogRef, {
      amount: -credits,
      applied,
      shortfall: credits - applied,
      type: 'refund',
      chargeId: charge.id,
      sessionId: session!.id,
      timestamp: Date.now()
    });
  });

  logger.info(`[handleChargeRefunded] Reversed up to ${credits} credits for user ${maskId(userId)} (charge ${charge.id})`);
}

/**
 * Handle charge.dispute.created — record an early-warning doc for finance.
 * No automatic balance action: disputes are resolved out-of-band; this makes
 * them visible instead of silently landing in the unhandled-events log.
 */
async function handleChargeDisputeCreated(event: Stripe.Event): Promise<void> {
  const dispute = event.data.object as Stripe.Dispute;
  const db = getFirestore();
  // Deterministic ID keyed by the dispute — duplicate deliveries overwrite.
  await db.collection('payment_disputes').doc(dispute.id).set({
    chargeId: dispute.charge,
    amount: dispute.amount,
    currency: dispute.currency,
    reason: dispute.reason,
    status: dispute.status,
    recordedAt: FieldValue.serverTimestamp(),
  });
  logger.warn(`[handleChargeDisputeCreated] Dispute ${dispute.id} recorded for finance review`);
}

/**
 * Main webhook handler
 */
export const stripeWebhook = onRequest({
  secrets: [stripeSecretKey, stripeWebhookSecret],
  timeoutSeconds: 30,
}, async (req, res) => {
  const signature = req.headers['stripe-signature'] as string;
  const webhookSecret = getStripeWebhookSecret();

  if (!webhookSecret) {
    logger.error('[stripeWebhook] Webhook secret not configured');
    res.status(500).json({ error: 'Webhook secret not configured' });
    return;
  }

  let event: Stripe.Event;

  try {
    event = verifyStripeWebhook(req.rawBody.toString(), signature, webhookSecret);
  } catch (error) {
    logger.error('[stripeWebhook] Signature verification failed:', error);
    res.status(400).json({ error: 'Invalid signature' });
    return;
  }

  // ── Idempotency guard: atomic check-and-set via transaction ──────────
  // Stripe retries webhooks on timeout/5xx. Without an atomic guard, two
  // concurrent deliveries of the same event can both read "not processed"
  // and both proceed, causing double subscription changes or duplicate
  // invoice credits. Using runTransaction() makes the check-and-write
  // atomic, closing that race window.
  const db = getFirestore();
  const deliveryRef = db.collection('stripe_webhook_deliveries').doc(event.id);
  try {
    const alreadyProcessed = await db.runTransaction(async (tx) => {
      const snap = await tx.get(deliveryRef);
      if (snap.exists) {
        // ISSUE-883: a 'failed' delivery is retryable — Stripe's retry must
        // reprocess it, not be swallowed as a duplicate. A stale 'processing'
        // claim (>5 min old) is also retakeable: a crashed worker never flips
        // its doc to failed, and Stripe only retries after we 500/timeout.
        const status = snap.get('status');
        const receivedAt = snap.get('receivedAt');
        const receivedMs = typeof receivedAt?.toMillis === 'function' ? receivedAt.toMillis() : 0;
        const staleProcessing = status === 'processing' && (Date.now() - receivedMs) > 5 * 60 * 1000;
        if (status !== 'failed' && !staleProcessing) {
          return true; // Processed, or another worker is actively on it
        }
        tx.update(deliveryRef, {
          status: 'processing',
          receivedAt: FieldValue.serverTimestamp(),
          retriedAt: FieldValue.serverTimestamp(),
          retryCount: FieldValue.increment(1),
        });
        return false;
      }
      // Atomically mark as in-flight so concurrent retries are blocked
      tx.set(deliveryRef, {
        eventId: event.id,
        type: event.type,
        receivedAt: FieldValue.serverTimestamp(),
        status: 'processing',
      });
      return false;
    });

    if (alreadyProcessed) {
      logger.info(`[stripeWebhook] Duplicate delivery skipped: ${event.id}`);
      res.json({ received: true, duplicate: true });
      return;
    }
  } catch (idempotencyErr) {
    // Fail closed. Stripe will retry a 5xx delivery; proceeding without the
    // atomic claim can duplicate non-idempotent financial side effects.
    logger.error('[stripeWebhook] Idempotency check failed:', idempotencyErr);
    res.status(500).json({ error: 'Webhook idempotency check failed' });
    return;
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed':
      case 'checkout.session.async_payment_succeeded':
        await handleCheckoutCompleted(event);
        break;
      case 'checkout.session.expired':
      case 'checkout.session.async_payment_failed':
        await handleMarketplaceCheckoutExpired(event.data.object as Stripe.Checkout.Session);
        break;
      case 'customer.subscription.created':
        await handleSubscriptionCreated(event);
        break;
      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event);
        break;
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event);
        break;
      case 'invoice.paid':
        await handleInvoicePaid(event);
        break;
      case 'invoice.payment_failed':
        await handleInvoicePaymentFailed(event);
        break;
      case 'charge.refunded':
        await handleChargeRefunded(event);
        break;
      case 'charge.dispute.created':
        await handleChargeDisputeCreated(event);
        break;
      default:
        logger.warn({
          message: `[stripeWebhook] Unhandled event type: ${event.type}`,
          eventId: event.id,
          eventType: event.type
        });
        res.json({ received: true, status: 'unhandled_event', type: event.type });
        return;
    }

    // Mark delivery complete (best-effort)
    deliveryRef.update({ status: 'processed', processedAt: FieldValue.serverTimestamp() })
      .catch((err: unknown) => { logger.warn('[stripeWebhook] Best-effort status update failed (processed):', err); });

    res.json({ received: true });
  } catch (error) {
    logger.error('[stripeWebhook] Handler error:', error);
    // Mark failed so the next retry is not skipped
    deliveryRef.update({ status: 'failed', error: String(error) })
      .catch((err: unknown) => { logger.warn('[stripeWebhook] Best-effort status update failed (failed):', err); });
    res.status(500).json({ error: 'Webhook handler failed' });
  }
});
