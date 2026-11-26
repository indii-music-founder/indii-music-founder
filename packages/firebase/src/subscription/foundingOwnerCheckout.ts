/**
 * Founding Owner Checkout & Authoritative Fulfillment (ISSUE-1424)
 *
 * Enforces server-authoritative waitlist eligibility before creating a one-time
 * Founding Owner Stripe Checkout session, and materializes permanent software
 * access separately from the first-year included provider usage window and
 * permanent recognition record upon confirmed paid webhook delivery.
 */

import { randomUUID } from 'node:crypto';
import type Stripe from 'stripe';
import { getFirestore, FieldValue, type Firestore } from 'firebase-admin/firestore';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as logger from 'firebase-functions/logger';
import { z } from 'zod';

import { stripe, getPriceId } from '../stripe/config';
import { assertAllowedStripeRedirectUrl } from '../stripe/redirectAllowlist';
import { stripeSecretKey, arcjetKey } from '../config/secrets';
import { protectAuthenticatedApiRequest } from '../functions/security/arcjet';
import { requireVerifiedEmailV2, validateAppCheckV2 } from '../middleware/appCheck';
import { SubscriptionTier } from '../shared/subscription/types';
import { writeFounderEntitlementGrant } from '../functions/auth/entitlements';
import { FOUNDING_ARTIST_WAITLIST_COLLECTION } from '../foundingArtist/waitlist';

export const FOUNDING_OWNER_PRICE_CENTS = 250_000; // $2,500.00 one-time
export const FOUNDING_OWNER_INCLUDED_USAGE_DAYS = 365;
export const FOUNDING_OWNER_LICENSE_VERSION = 'founding-owner-license.v1' as const;

const ELIGIBLE_WAITLIST_STATUSES = new Set(['invited', 'accepted']);

const CheckoutInputSchema = z.object({
  successUrl: z.string().url(),
  cancelUrl: z.string().url(),
  recognitionName: z.string().trim().min(1).max(120).optional(),
}).strict();

export interface FoundingOwnerEligibility {
  uid: string;
  email: string;
  queuePosition: number;
  waitlistStatus: 'invited' | 'accepted';
}

export interface FoundingOwnerFulfillmentResult {
  alreadyFulfilled: boolean;
  uid: string;
  stripeSessionId: string;
  grantId?: string;
  firstYearIncludedUntil?: string;
}

/**
 * Verifies server-side that the caller is an email-verified, invited/accepted
 * member of the Founding Artist Beta waitlist and does not already hold a
 * Founding Owner license. Never trusts client-supplied eligibility claims.
 */
export async function verifyFoundingOwnerEligibility(
  uid: string,
  firestore: Firestore = getFirestore(),
): Promise<FoundingOwnerEligibility> {
  const [waitlistSnap, founderSnap] = await Promise.all([
    firestore.collection(FOUNDING_ARTIST_WAITLIST_COLLECTION).doc(uid).get(),
    firestore.collection('founders').doc(uid).get(),
  ]);

  if (founderSnap.exists) {
    throw new HttpsError('already-exists', 'This account already holds a permanent Founding Owner license.');
  }

  if (!waitlistSnap.exists) {
    throw new HttpsError('failed-precondition', 'Join the Founding Artist Beta waitlist and receive an invitation before purchasing Founding Owner access.');
  }

  const data = waitlistSnap.data() as {
    email?: unknown;
    emailVerified?: unknown;
    status?: unknown;
    queuePosition?: unknown;
  };

  if (data.emailVerified !== true || typeof data.email !== 'string' || !data.email.trim()) {
    throw new HttpsError('failed-precondition', 'Your waitlist email must be verified before purchasing Founding Owner access.');
  }

  if (typeof data.status !== 'string' || !ELIGIBLE_WAITLIST_STATUSES.has(data.status)) {
    throw new HttpsError(
      'failed-precondition',
      'Founding Owner access is available once your waitlist invitation is issued.',
    );
  }

  return {
    uid,
    email: data.email.trim().toLowerCase(),
    queuePosition: typeof data.queuePosition === 'number' && Number.isFinite(data.queuePosition) ? data.queuePosition : 0,
    waitlistStatus: data.status as 'invited' | 'accepted',
  };
}

/**
 * Creates a server-verified one-time Stripe Checkout session for eligible
 * Founding Artist waitlist members.
 */
export const createFoundingOwnerCheckout = onCall(
  {
    secrets: [stripeSecretKey, arcjetKey],
    timeoutSeconds: 60,
    memory: '512MiB',
    enforceAppCheck: false,
  },
  async (request) => {
    validateAppCheckV2(request);
    const uid = requireVerifiedEmailV2(request);
    if (request.auth?.token?.firebase?.sign_in_provider === 'anonymous') {
      throw new HttpsError('permission-denied', 'Anonymous accounts cannot purchase Founding Owner access.');
    }

    if (request.rawRequest) {
      const protection = await protectAuthenticatedApiRequest(request.rawRequest as never, {
        userId: uid,
        policy: request.auth?.token?.admin === true ? 'admin' : 'verified-free',
        operationId: `founding-owner-checkout:${randomUUID()}`,
      });
      if (!protection.allowed) {
        throw new HttpsError(
          protection.status === 429 ? 'resource-exhausted' : protection.status === 403 ? 'permission-denied' : 'unavailable',
          protection.message,
        );
      }
    }

    const parsed = CheckoutInputSchema.safeParse(request.data);
    if (!parsed.success) {
      throw new HttpsError('invalid-argument', 'Valid successUrl and cancelUrl are required.');
    }

    const validatedSuccessUrl = assertAllowedStripeRedirectUrl(parsed.data.successUrl, 'successUrl');
    const validatedCancelUrl = assertAllowedStripeRedirectUrl(parsed.data.cancelUrl, 'cancelUrl');

    const db = getFirestore();
    const eligibility = await verifyFoundingOwnerEligibility(uid, db);

    const priceId = getPriceId(SubscriptionTier.FOUNDER);
    if (!priceId) {
      throw new HttpsError('failed-precondition', 'Founding Owner checkout price is not configured yet.');
    }

    const customer = await stripe.customers.create(
      {
        email: eligibility.email,
        metadata: { userId: uid, waitlistQueuePosition: String(eligibility.queuePosition) },
      },
      { idempotencyKey: `founding_owner_customer_${uid}` },
    );

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      customer: customer.id,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: validatedSuccessUrl,
      cancel_url: validatedCancelUrl,
      client_reference_id: uid,
      automatic_tax: { enabled: true },
      metadata: {
        type: 'founder_seat',
        userId: uid,
        licenseVersion: FOUNDING_OWNER_LICENSE_VERSION,
        waitlistQueuePosition: String(eligibility.queuePosition),
        waitlistStatus: eligibility.waitlistStatus,
        ...(parsed.data.recognitionName ? { recognitionName: parsed.data.recognitionName } : {}),
      },
    });

    return {
      checkoutUrl: session.url || '',
      sessionId: session.id,
      disclosedPriceCents: FOUNDING_OWNER_PRICE_CENTS,
      includedUsageDays: FOUNDING_OWNER_INCLUDED_USAGE_DAYS,
    };
  },
);

/**
 * Authoritative, idempotent webhook fulfillment for a paid Founding Owner
 * one-time Checkout session.
 *
 * Enforces `payment_status === 'paid'` and exact minimum disclosed amount,
 * grants non-forgeable permanent software access separate from the 1-year
 * included provider capacity boundary, records permanent recognition, and
 * preserves rights across post-beta renames.
 */
export async function fulfillFoundingOwnerCheckout(
  session: Stripe.Checkout.Session,
  firestore: Firestore = getFirestore(),
  now: Date = new Date(),
): Promise<FoundingOwnerFulfillmentResult> {
  if (session.payment_status !== 'paid') {
    logger.info('[fulfillFoundingOwnerCheckout] Ignoring unpaid session until async payment succeeds', {
      sessionId: session.id,
      paymentStatus: session.payment_status,
    });
    return {
      alreadyFulfilled: false,
      uid: session.metadata?.userId || session.client_reference_id || '',
      stripeSessionId: session.id,
    };
  }

  const userId = session.metadata?.userId || session.client_reference_id;
  if (!userId || userId.includes('/') || userId.length > 128) {
    logger.error('[fulfillFoundingOwnerCheckout] Missing or invalid userId metadata', { sessionId: session.id });
    throw new Error('Founder seat checkout is missing userId metadata');
  }

  const paidCents = session.amount_total ?? 0;
  if (paidCents < FOUNDING_OWNER_PRICE_CENTS) {
    logger.error(`[fulfillFoundingOwnerCheckout] Underpaid founder seat: ${paidCents} < ${FOUNDING_OWNER_PRICE_CENTS}`, {
      sessionId: session.id,
    });
    throw new Error('Founder seat payment amount below seat price');
  }

  if (session.currency && session.currency.toLowerCase() !== 'usd') {
    throw new Error(`Unsupported currency for Founding Owner checkout: ${session.currency}`);
  }

  const grantedAt = now.toISOString();
  const firstYearIncludedUntil = new Date(
    now.getTime() + FOUNDING_OWNER_INCLUDED_USAGE_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();
  const recognitionName = typeof session.metadata?.recognitionName === 'string' && session.metadata.recognitionName.trim()
    ? session.metadata.recognitionName.trim()
    : (session.customer_details?.name || undefined);

  const queueRef = firestore.collection('founder_fulfillment_queue').doc(session.id);
  const founderRef = firestore.collection('founders').doc(userId);
  const userRef = firestore.collection('users').doc(userId);
  const waitlistRef = firestore.collection(FOUNDING_ARTIST_WAITLIST_COLLECTION).doc(userId);

  return firestore.runTransaction(async (tx) => {
    const [queueSnap, founderSnap, waitlistSnap] = await Promise.all([
      tx.get(queueRef),
      tx.get(founderRef),
      tx.get(waitlistRef),
    ]);

    if (queueSnap.exists && queueSnap.data()?.status === 'fulfilled') {
      const existingData = queueSnap.data() as { grantId?: string; firstYearIncludedUntil?: string };
      return {
        alreadyFulfilled: true,
        uid: userId,
        stripeSessionId: session.id,
        grantId: existingData.grantId,
        firstYearIncludedUntil: existingData.firstYearIncludedUntil,
      };
    }

    const existingFounderData = founderSnap.exists ? (founderSnap.data() as Record<string, unknown>) : undefined;
    const seatNumber = typeof existingFounderData?.seat === 'number' ? existingFounderData.seat : undefined;

    const grant = writeFounderEntitlementGrant(tx, firestore, userId, `${founderRef.path}#${session.id}`, {
      firstYearIncludedUntil,
      seatNumber,
      displayName: recognitionName,
      grantedAt,
    });

    tx.set(founderRef, {
      uid: userId,
      licenseVersion: FOUNDING_OWNER_LICENSE_VERSION,
      softwareAccess: 'permanent',
      postBetaMigrationProtected: true,
      providerCapacityBoundary: {
        firstYearIncludedUntil,
        meteredAfterFirstYear: true,
      },
      recognition: {
        permanent: true,
        ...(recognitionName ? { displayName: recognitionName } : {}),
        grantedAt,
      },
      stripeSessionId: session.id,
      paymentIntentId: typeof session.payment_intent === 'string' ? session.payment_intent : null,
      amountCents: paidCents,
      currency: (session.currency || 'usd').toLowerCase(),
      customerEmail: session.customer_details?.email || null,
      grantId: grant.grantId,
      activatedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });

    tx.set(queueRef, {
      userId,
      stripeSessionId: session.id,
      paymentIntentId: typeof session.payment_intent === 'string' ? session.payment_intent : null,
      amountCents: paidCents,
      customerEmail: session.customer_details?.email || null,
      licenseVersion: FOUNDING_OWNER_LICENSE_VERSION,
      grantId: grant.grantId,
      firstYearIncludedUntil,
      status: 'fulfilled',
      fulfilledAt: FieldValue.serverTimestamp(),
      createdAt: FieldValue.serverTimestamp(),
    }, { merge: true });

    tx.set(userRef, {
      founderPaymentStatus: 'fulfilled',
      founderPaymentSessionId: session.id,
      founderPaidAt: FieldValue.serverTimestamp(),
      founderSoftwareAccess: 'permanent',
      founderFirstYearIncludedUntil: firstYearIncludedUntil,
      founderPostBetaProtected: true,
    }, { merge: true });

    if (waitlistSnap.exists) {
      const currentStatus = waitlistSnap.data()?.status;
      if (currentStatus === 'invited' || currentStatus === 'waitlisted') {
        tx.update(waitlistRef, {
          status: 'accepted',
          acceptedAt: FieldValue.serverTimestamp(),
          foundingOwnerSessionId: session.id,
          updatedAt: FieldValue.serverTimestamp(),
        });
      }
    }

    return {
      alreadyFulfilled: false,
      uid: userId,
      stripeSessionId: session.id,
      grantId: grant.grantId,
      firstYearIncludedUntil,
    };
  });
}
