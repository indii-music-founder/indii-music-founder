import { describe, expect, it, vi } from 'vitest';

import {
  admitVerifiedEntitlementProvisioning,
  entitlementTierToBudgetTier,
  requireVerifiedAccountEntitlement,
  requireVerifiedServerEntitlement,
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
