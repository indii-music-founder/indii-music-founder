import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  firestore: vi.fn(),
  auth: vi.fn(),
}));

vi.mock('firebase-functions/v2/https', () => ({
  onCall: vi.fn((_options: unknown, handler: unknown) => handler),
  HttpsError: class HttpsError extends Error {
    constructor(
      public code: string,
      message: string,
      public details?: unknown,
    ) {
      super(message);
    }
  },
}));

vi.mock('firebase-admin/firestore', () => ({
  getFirestore: () => mocks.firestore(),
  FieldValue: { serverTimestamp: () => '__server_timestamp__' },
}));

vi.mock('firebase-admin/auth', () => ({
  getAuth: () => mocks.auth(),
}));

vi.mock('../../middleware/appCheck', () => ({
  validateAppCheckV2: vi.fn(),
}));

vi.mock('../security/arcjet', () => ({
  protectAuthenticatedApiRequest: vi.fn(),
  policyClassForServerEntitlement: vi.fn(),
}));

vi.mock('../../config/secrets', () => ({
  arcjetKey: { name: 'ARCJET_KEY' },
}));

import {
  admitVerifiedEntitlementProvisioning,
  entitlementTierToBudgetTier,
  requireVerifiedAccountEntitlement,
  requireVerifiedServerEntitlement,
  resolveServerProvenTier,
  tierRank,
  type AccountEntitlement,
  type EntitlementRepository,
} from './entitlements';
import { SubscriptionTier } from '../../shared/subscription/types';

function activeEntitlement(tier: SubscriptionTier = SubscriptionTier.FREE): AccountEntitlement {
  return {
    schemaVersion: 'account-entitlement.v1',
    uid: 'artist-1',
    tier,
    status: 'active',
    source: 'verified_email',
    grantId: 'grant-1',
  };
}

describe('verified account entitlements', () => {
  it('refuses to issue a spend-bearing entitlement for an unverified email', async () => {
    const repository: EntitlementRepository = {
      provisionVerifiedAccount: vi.fn(),
    };

    await expect(requireVerifiedAccountEntitlement({ uid: 'artist-1', emailVerified: false }, repository))
      .rejects.toThrow('Verify your email');
    expect(repository.provisionVerifiedAccount).not.toHaveBeenCalled();
  });

  it('provisions the server-owned Free entitlement from a verified identity only', async () => {
    const entitlement = activeEntitlement();
    const repository: EntitlementRepository = {
      provisionVerifiedAccount: vi.fn().mockResolvedValue(entitlement),
    };

    await expect(requireVerifiedAccountEntitlement({ uid: 'artist-1', emailVerified: true }, repository))
      .resolves.toEqual(entitlement);
    expect(repository.provisionVerifiedAccount).toHaveBeenCalledWith('artist-1');
  });

  it('checks the current Firebase Auth account before a queue worker can spend', async () => {
    const repository: EntitlementRepository = {
      provisionVerifiedAccount: vi.fn().mockResolvedValue(activeEntitlement()),
    };
    const directory = { getUser: vi.fn().mockResolvedValue({ uid: 'artist-1', emailVerified: true }) };

    await expect(requireVerifiedServerEntitlement('artist-1', directory, repository))
      .resolves.toMatchObject({ tier: SubscriptionTier.FREE });
    expect(directory.getUser).toHaveBeenCalledWith('artist-1');
  });

  it('maps only server-recognized entitlement tiers into spend policy tiers', () => {
    expect(entitlementTierToBudgetTier(SubscriptionTier.FREE)).toBe('free');
    expect(entitlementTierToBudgetTier(SubscriptionTier.PRO_MONTHLY)).toBe('pro');
    expect(entitlementTierToBudgetTier(SubscriptionTier.PRO_YEARLY)).toBe('pro');
    expect(entitlementTierToBudgetTier(SubscriptionTier.STUDIO)).toBe('enterprise');
    expect(entitlementTierToBudgetTier(SubscriptionTier.FOUNDER)).toBe('founder');
  });

  it('requires App Check before resolving an entitlement or consuming an Arcjet decision', async () => {
    const validateAppCheck = vi.fn(() => {
      throw new Error('Unauthorized: Missing App Check token.');
    });
    const resolveEntitlement = vi.fn();
    const protect = vi.fn();

    await expect(admitVerifiedEntitlementProvisioning({
      auth: { uid: 'artist-1', token: { admin: false } },
      rawRequest: { method: 'POST', headers: {} },
    } as never, { validateAppCheck, resolveEntitlement, protect })).rejects.toThrow('Missing App Check');
    expect(resolveEntitlement).not.toHaveBeenCalled();
    expect(protect).not.toHaveBeenCalled();
  });

  it('fails closed when Arcjet rate-limits a verified account', async () => {
    const entitlement = activeEntitlement();
    const validateAppCheck = vi.fn();
    const resolveEntitlement = vi.fn().mockResolvedValue(entitlement);
    const protect = vi.fn().mockResolvedValue({
      allowed: false,
      status: 429,
      code: 'RATE_LIMITED',
      message: 'Too many requests. Please slow down.',
      retryAfterSeconds: 30,
    });
    const policyForEntitlement = vi.fn().mockReturnValue('verified-free');

    await expect(admitVerifiedEntitlementProvisioning({
      auth: { uid: 'artist-1', token: { admin: false } },
      rawRequest: { method: 'POST', headers: {} },
    } as never, { validateAppCheck, resolveEntitlement, protect, policyForEntitlement } as never)).rejects.toMatchObject({
      code: 'resource-exhausted',
      details: { code: 'RATE_LIMITED', retryAfterSeconds: 30 },
    });
    expect(protect).toHaveBeenCalledWith(
      expect.objectContaining({ method: 'POST' }),
      expect.objectContaining({ userId: 'artist-1', policy: 'verified-free' }),
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Server-proven tier resolution — the founder/paid-tiers fix. Entitlements must
// resolve from server-owned registries (founders/{uid}, subscriptions/{uid}),
// never from client-writable profile fields, and must self-heal a stale FREE.
// ─────────────────────────────────────────────────────────────────────────────

describe('server-proven tier resolution', () => {
  it('ranks tiers so upgrades are one-directional and safe', () => {
    expect(tierRank(SubscriptionTier.FREE)).toBe(0);
    expect(tierRank(SubscriptionTier.PRO_MONTHLY)).toBe(1);
    expect(tierRank(SubscriptionTier.PRO_YEARLY)).toBe(1);
    expect(tierRank(SubscriptionTier.STUDIO)).toBe(2);
    expect(tierRank(SubscriptionTier.FOUNDER)).toBe(3);
  });

  it('prefers the founder registry over any subscription record', () => {
    expect(resolveServerProvenTier({
      isFounder: true,
      subscription: { tier: 'pro_monthly', status: 'active' },
    })).toBe(SubscriptionTier.FOUNDER);
  });

  it('materializes paid tiers from a non-canceled subscription doc', () => {
    expect(resolveServerProvenTier({
      isFounder: false,
      subscription: { tier: 'studio', status: 'active' },
    })).toBe(SubscriptionTier.STUDIO);
    expect(resolveServerProvenTier({
      isFounder: false,
      subscription: { tier: 'pro_monthly', status: 'trialing' },
    })).toBe(SubscriptionTier.PRO_MONTHLY);
    expect(resolveServerProvenTier({
      isFounder: false,
      subscription: { tier: 'pro_yearly', status: 'past_due' },
    })).toBe(SubscriptionTier.PRO_YEARLY);
  });

  it('ignores canceled or free subscriptions and falls back to FREE', () => {
    expect(resolveServerProvenTier({
      isFounder: false,
      subscription: { tier: 'founder', status: 'canceled' },
    })).toBe(SubscriptionTier.FREE);
    expect(resolveServerProvenTier({
      isFounder: false,
      subscription: { tier: 'free', status: 'active' },
    })).toBe(SubscriptionTier.FREE);
    expect(resolveServerProvenTier({ isFounder: false })).toBe(SubscriptionTier.FREE);
  });
});

describe('firestore entitlement provisioning (founder self-heal)', () => {
  function firestoreHarness(documents: Map<string, Record<string, unknown>>) {
    const ref = (path: string) => ({
      path,
      collection: (name: string) => ({
        doc: (id: string) => ref(`${path}/${name}/${id}`),
      }),
    });
    const transaction = {
      get: vi.fn(async (reference: { path: string }) => {
        const data = documents.get(reference.path);
        return { exists: Boolean(data), data: () => data };
      }),
      set: vi.fn((reference: { path: string }, values: Record<string, unknown>) => {
        documents.set(reference.path, { ...(documents.get(reference.path) || {}), ...values });
      }),
      create: vi.fn((reference: { path: string }, values: Record<string, unknown>) => {
        documents.set(reference.path, { ...values });
      }),
    };
    const db = {
      collection: (name: string) => ({ doc: (id: string) => ref(`${name}/${id}`) }),
      runTransaction: vi.fn(async (
        handler: (tx: typeof transaction) => Promise<unknown>,
      ) => handler(transaction)),
    };
    return { db, transaction };
  }

  it('provisions FOUNDER when founders/{uid} exists and no entitlement is recorded', async () => {
    const documents = new Map<string, Record<string, unknown>>([
      ['founders/artist-1', { uid: 'artist-1', seat: 1 }],
    ]);
    const { db } = firestoreHarness(documents);
    mocks.firestore.mockReturnValue(db);

    const entitlement = await requireVerifiedAccountEntitlement({ uid: 'artist-1', emailVerified: true });

    expect(entitlement).toMatchObject({ tier: SubscriptionTier.FOUNDER, source: 'founder_registry_migration' });
    expect(documents.get('users/artist-1/entitlements/current')).toMatchObject({
      tier: SubscriptionTier.FOUNDER,
      uid: 'artist-1',
    });
  });

  it('upgrades a stale FREE entitlement in place when the founder registry appears later', async () => {
    const documents = new Map<string, Record<string, unknown>>([
      ['founders/artist-1', { uid: 'artist-1', seat: 1 }],
      ['users/artist-1/entitlements/current', {
        schemaVersion: 'account-entitlement.v1',
        uid: 'artist-1',
        tier: SubscriptionTier.FREE,
        status: 'active',
        source: 'verified_email',
        grantId: 'grant-free',
      }],
    ]);
    const { db, transaction } = firestoreHarness(documents);
    mocks.firestore.mockReturnValue(db);

    const entitlement = await requireVerifiedAccountEntitlement({ uid: 'artist-1', emailVerified: true });

    expect(entitlement).toMatchObject({ tier: SubscriptionTier.FOUNDER });
    expect(transaction.set).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'users/artist-1/entitlements/current' }),
      expect.objectContaining({ tier: SubscriptionTier.FOUNDER }),
    );
  });

  it('materializes a paid tier from subscriptions/{uid} with a subscription-migration grant', async () => {
    const documents = new Map<string, Record<string, unknown>>([
      ['subscriptions/artist-1', { tier: 'pro_monthly', status: 'active' }],
    ]);
    const { db } = firestoreHarness(documents);
    mocks.firestore.mockReturnValue(db);

    const entitlement = await requireVerifiedAccountEntitlement({ uid: 'artist-1', emailVerified: true });

    expect(entitlement).toMatchObject({ tier: SubscriptionTier.PRO_MONTHLY, source: 'subscription_migration' });
    expect(documents.get('users/artist-1/entitlements/current')).toMatchObject({
      tier: SubscriptionTier.PRO_MONTHLY,
    });
  });

  it('keeps an existing FOUNDER entitlement without rewriting it', async () => {
    const documents = new Map<string, Record<string, unknown>>([
      ['founders/artist-1', { uid: 'artist-1', seat: 1 }],
      ['users/artist-1/entitlements/current', {
        schemaVersion: 'account-entitlement.v1',
        uid: 'artist-1',
        tier: SubscriptionTier.FOUNDER,
        status: 'active',
        source: 'founder_activation',
        grantId: 'grant-founder',
      }],
    ]);
    const { db, transaction } = firestoreHarness(documents);
    mocks.firestore.mockReturnValue(db);

    const entitlement = await requireVerifiedAccountEntitlement({ uid: 'artist-1', emailVerified: true });

    expect(entitlement.grantId).toBe('grant-founder');
    expect(transaction.set).not.toHaveBeenCalled();
    expect(transaction.create).not.toHaveBeenCalled();
  });
});
