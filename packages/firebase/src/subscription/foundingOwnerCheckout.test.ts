import { beforeEach, describe, expect, it, vi } from 'vitest';
import type Stripe from 'stripe';

const docs = new Map<string, Record<string, unknown>>();

function makeDocRef(path: string) {
  return {
    path,
    id: path.split('/').pop()!,
    get: async () => {
      const data = docs.get(path);
      return {
        exists: data !== undefined,
        id: path.split('/').pop()!,
        data: () => data,
      };
    },
    collection: (sub: string) => makeCollectionRef(`${path}/${sub}`),
  };
}

function makeCollectionRef(path: string) {
  return {
    path,
    doc: (id: string) => makeDocRef(`${path}/${id}`),
  };
}

function makeFakeFirestore() {
  return {
    collection: (name: string) => makeCollectionRef(name),
    runTransaction: async <T>(fn: (tx: unknown) => Promise<T>): Promise<T> => {
      const tx = {
        get: async (ref: ReturnType<typeof makeDocRef>) => ref.get(),
        set: (ref: ReturnType<typeof makeDocRef>, data: Record<string, unknown>, opts?: { merge?: boolean }) => {
          const prev = opts?.merge ? (docs.get(ref.path) ?? {}) : {};
          docs.set(ref.path, { ...prev, ...data });
        },
        create: (ref: ReturnType<typeof makeDocRef>, data: Record<string, unknown>) => {
          if (docs.has(ref.path)) {
            throw new Error(`Document already exists: ${ref.path}`);
          }
          docs.set(ref.path, data);
        },
        update: (ref: ReturnType<typeof makeDocRef>, patch: Record<string, unknown>) => {
          const prev = docs.get(ref.path) ?? {};
          docs.set(ref.path, { ...prev, ...patch });
        },
      };
      return fn(tx);
    },
  };
}

vi.mock('firebase-admin/firestore', () => ({
  FieldValue: { serverTimestamp: () => '__SERVER_TS__' },
  getFirestore: () => makeFakeFirestore(),
}));

vi.mock('firebase-functions/v2/https', () => ({
  HttpsError: class HttpsError extends Error {
    constructor(public code: string, message: string) {
      super(message);
    }
  },
  onCall: (_opts: unknown, handler: unknown) => handler,
}));

vi.mock('firebase-functions/logger', () => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}));

vi.mock('../stripe/config', () => ({
  stripe: {
    customers: { create: vi.fn().mockResolvedValue({ id: 'cus_founder_1' }) },
    checkout: { sessions: { create: vi.fn().mockResolvedValue({ id: 'cs_founder_1', url: 'https://checkout.stripe.com/cs_founder_1' }) } },
  },
  getPriceId: vi.fn().mockReturnValue('price_founder_2500'),
}));

import {
  FOUNDING_OWNER_PRICE_CENTS,
  verifyFoundingOwnerEligibility,
  fulfillFoundingOwnerCheckout,
} from './foundingOwnerCheckout';
import { tierRank, entitlementTierToBudgetTier } from '../functions/auth/entitlements';
import { SubscriptionTier } from '../shared/subscription/types';

describe('Founding Owner eligibility, fulfillment, and tier ranking (ISSUE-1424)', () => {
  beforeEach(() => {
    docs.clear();
  });

  it('ranks and budgets all public beta tiers (START, BUILD, SCALE) and keeps FOUNDER highest', () => {
    expect(tierRank(SubscriptionTier.FREE)).toBe(0);
    expect(tierRank(SubscriptionTier.START)).toBeGreaterThan(tierRank(SubscriptionTier.FREE));
    expect(tierRank(SubscriptionTier.BUILD)).toBeGreaterThan(tierRank(SubscriptionTier.START));
    expect(tierRank(SubscriptionTier.SCALE)).toBeGreaterThan(tierRank(SubscriptionTier.BUILD));
    expect(tierRank(SubscriptionTier.FOUNDER)).toBeGreaterThan(tierRank(SubscriptionTier.SCALE));

    expect(entitlementTierToBudgetTier(SubscriptionTier.START)).toBe('pro');
    expect(entitlementTierToBudgetTier(SubscriptionTier.BUILD)).toBe('pro');
    expect(entitlementTierToBudgetTier(SubscriptionTier.SCALE)).toBe('enterprise');
    expect(entitlementTierToBudgetTier(SubscriptionTier.FOUNDER)).toBe('founder');
  });

  it('rejects waitlist eligibility when user is not waitlisted, unverified, still waiting, or already a founder', async () => {
    const db = makeFakeFirestore() as never;

    await expect(verifyFoundingOwnerEligibility('user-missing', db)).rejects.toMatchObject({
      code: 'failed-precondition',
    });

    docs.set('foundingArtistWaitlist/user-uninvited', {
      email: 'artist@example.com',
      emailVerified: true,
      status: 'waitlisted',
      queuePosition: 12,
    });
    await expect(verifyFoundingOwnerEligibility('user-uninvited', db)).rejects.toMatchObject({
      code: 'failed-precondition',
    });

    docs.set('foundingArtistWaitlist/user-unverified', {
      email: 'artist@example.com',
      emailVerified: false,
      status: 'invited',
      queuePosition: 3,
    });
    await expect(verifyFoundingOwnerEligibility('user-unverified', db)).rejects.toMatchObject({
      code: 'failed-precondition',
    });

    docs.set('foundingArtistWaitlist/user-invited', {
      email: 'Invited@Example.com',
      emailVerified: true,
      status: 'invited',
      queuePosition: 4,
    });
    const eligible = await verifyFoundingOwnerEligibility('user-invited', db);
    expect(eligible).toEqual({
      uid: 'user-invited',
      email: 'invited@example.com',
      queuePosition: 4,
      waitlistStatus: 'invited',
    });

    docs.set('founders/user-invited', { uid: 'user-invited', softwareAccess: 'permanent' });
    await expect(verifyFoundingOwnerEligibility('user-invited', db)).rejects.toMatchObject({
      code: 'already-exists',
    });
  });

  it('ignores unpaid sessions and rejects underpaid sessions', async () => {
    const db = makeFakeFirestore() as never;
    const unpaid = {
      id: 'cs_unpaid',
      payment_status: 'unpaid',
      amount_total: FOUNDING_OWNER_PRICE_CENTS,
      currency: 'usd',
      metadata: { type: 'founder_seat', userId: 'artist-1' },
    } as unknown as Stripe.Checkout.Session;

    const unpaidRes = await fulfillFoundingOwnerCheckout(unpaid, db);
    expect(unpaidRes.alreadyFulfilled).toBe(false);
    expect(docs.has('founders/artist-1')).toBe(false);

    const underpaid = {
      id: 'cs_underpaid',
      payment_status: 'paid',
      amount_total: FOUNDING_OWNER_PRICE_CENTS - 1,
      currency: 'usd',
      metadata: { type: 'founder_seat', userId: 'artist-1' },
    } as unknown as Stripe.Checkout.Session;

    await expect(fulfillFoundingOwnerCheckout(underpaid, db)).rejects.toThrow('below seat price');
  });

  it('atomically grants permanent software access, 1-year usage boundary, recognition, and waitlist acceptance idempotently', async () => {
    const db = makeFakeFirestore() as never;
    const now = new Date('2026-11-26T12:00:00.000Z');
    docs.set('foundingArtistWaitlist/artist-42', {
      email: 'founder42@example.com',
      emailVerified: true,
      status: 'invited',
      queuePosition: 7,
    });

    const paidSession = {
      id: 'cs_paid_42',
      payment_status: 'paid',
      amount_total: FOUNDING_OWNER_PRICE_CENTS,
      currency: 'usd',
      payment_intent: 'pi_42',
      customer_details: { email: 'founder42@example.com', name: 'Nova Vale' },
      metadata: { type: 'founder_seat', userId: 'artist-42', recognitionName: 'Nova Vale' },
    } as unknown as Stripe.Checkout.Session;

    const first = await fulfillFoundingOwnerCheckout(paidSession, db, now);
    expect(first.alreadyFulfilled).toBe(false);
    expect(first.uid).toBe('artist-42');
    expect(first.firstYearIncludedUntil).toBe('2027-11-26T12:00:00.000Z');

    const entitlement = docs.get('users/artist-42/entitlements/current');
    expect(entitlement).toMatchObject({
      uid: 'artist-42',
      tier: SubscriptionTier.FOUNDER,
      status: 'active',
      softwareAccess: 'permanent',
      postBetaMigrationProtected: true,
      providerCapacityBoundary: {
        firstYearIncludedUntil: '2027-11-26T12:00:00.000Z',
        meteredAfterFirstYear: true,
      },
      recognition: {
        permanent: true,
        displayName: 'Nova Vale',
        grantedAt: '2026-11-26T12:00:00.000Z',
      },
    });

    expect(docs.get('foundingArtistWaitlist/artist-42')?.status).toBe('accepted');
    expect(docs.get('founders/artist-42')).toMatchObject({
      softwareAccess: 'permanent',
      postBetaMigrationProtected: true,
      stripeSessionId: 'cs_paid_42',
    });

    // Idempotent retry returns alreadyFulfilled without throwing or duplicating audit docs.
    const second = await fulfillFoundingOwnerCheckout(paidSession, db, now);
    expect(second.alreadyFulfilled).toBe(true);
    expect(second.grantId).toBe(first.grantId);
  });
});
