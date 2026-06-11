import { describe, expect, it } from 'vitest';
import {
  createDefaultSubscription,
  normalizeSubscriptionData,
  normalizeSubscriptionTier,
} from './subscriptionDefaults';
import { SubscriptionTier } from '../shared/subscription/types';

describe('subscriptionDefaults', () => {
  it('creates stable free subscription defaults for new users', () => {
    const subscription = createDefaultSubscription('user-123', 1000);

    expect(subscription).toEqual({
      id: 'free_user-123',
      userId: 'user-123',
      tier: SubscriptionTier.FREE,
      status: 'active',
      currentPeriodStart: 1000,
      currentPeriodEnd: 1000 + 30 * 24 * 60 * 60 * 1000,
      cancelAtPeriodEnd: false,
      createdAt: 1000,
      updatedAt: 1000,
    });
  });

  it('normalizes legacy membership tiers into subscription tiers', () => {
    expect(normalizeSubscriptionTier('pro')).toBe(SubscriptionTier.PRO_MONTHLY);
    expect(normalizeSubscriptionTier('enterprise')).toBe(SubscriptionTier.STUDIO);
    expect(normalizeSubscriptionTier('founder')).toBe(SubscriptionTier.FOUNDER);
    expect(normalizeSubscriptionTier('unknown')).toBe(SubscriptionTier.FREE);
  });

  it('repairs partial subscription documents without downgrading paid tiers', () => {
    const subscription = normalizeSubscriptionData('user-123', {
      tier: 'pro',
      stripeCustomerId: 'cus_123',
      currentPeriodStart: { toMillis: () => 2000 },
      currentPeriodEnd: { toDate: () => new Date(3000) },
    }, 1000);

    expect(subscription).toMatchObject({
      id: 'free_user-123',
      userId: 'user-123',
      tier: SubscriptionTier.PRO_MONTHLY,
      status: 'active',
      stripeCustomerId: 'cus_123',
      currentPeriodStart: 2000,
      currentPeriodEnd: 3000,
      cancelAtPeriodEnd: false,
      createdAt: 1000,
      updatedAt: 1000,
    });
  });
});
