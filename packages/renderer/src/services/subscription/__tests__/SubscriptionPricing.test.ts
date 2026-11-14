import { describe, it, expect } from 'vitest';
import {
  SubscriptionTier,
  BILLING_PERIODS,
  calculateBillingTotal,
  TIER_CONFIGS,
  getTierOrder,
} from '../SubscriptionTier';

describe('Subscription Pricing & Cadence Math', () => {
  describe.each([
    { period: 'monthly' as const, months: 1, discount: 0, totals: [22, 55, 110] },
    { period: 'quarterly' as const, months: 3, discount: 15, totals: [56, 140, 281] },
    { period: 'six_month' as const, months: 6, discount: 30, totals: [92, 231, 462] },
    { period: 'annual' as const, months: 12, discount: 50, totals: [132, 330, 660] },
  ])('$period introductory and renewal pricing', ({ period, months, discount, totals }) => {
    it.each([22, 55, 110])('calculates the first term and undiscounted renewal for $%s/month', (price) => {
      const result = calculateBillingTotal(price, period);
      expect(result.total).toBe(totals[[22, 55, 110].indexOf(price)]);
      expect(result.monthlyEquivalent).toBe(Math.round(result.total / months));
      expect(result.months).toBe(months);
      expect(result.discountPercent).toBe(discount);
      expect(result.renewalTotal).toBe(price * months);
      expect(BILLING_PERIODS[period].discountRate).toBe(discount / 100);
    });
  });

  it('preserves the six-month alias and free pricing', () => {
    expect(calculateBillingTotal(22, 'six-month')).toEqual(calculateBillingTotal(22, 'six_month'));
    expect(calculateBillingTotal(0, 'annual').total).toBe(0);
    expect(calculateBillingTotal(-10, 'monthly').renewalTotal).toBe(0);
  });

  describe('TIER_CONFIGS stage-appropriate limits', () => {
    it('verifies Start tier configuration limits and safety floors', () => {
      const start = TIER_CONFIGS[SubscriptionTier.START];
      expect(start.price).toBe(22);
      expect(start.storage.totalGB).toBe(25);
      expect(start.videoGenerations.totalDurationMinutes).toBe(15);
      expect(start.videoGenerations.maxResolution).toBe('1080p');
      expect(start.imageGenerations.monthly).toBe(250);
      expect(start.aiChat.tokensPerMonth).toBe(50000);
    });

    it('verifies Build tier configuration limits', () => {
      const build = TIER_CONFIGS[SubscriptionTier.BUILD];
      expect(build.price).toBe(55);
      expect(build.storage.totalGB).toBe(100);
      expect(build.videoGenerations.totalDurationMinutes).toBe(60);
      expect(build.videoGenerations.maxResolution).toBe('1080p');
      expect(build.imageGenerations.monthly).toBe(1000);
      expect(build.aiChat.tokensPerMonth).toBe(250000);
    });

    it('verifies Scale tier configuration limits', () => {
      const scale = TIER_CONFIGS[SubscriptionTier.SCALE];
      expect(scale.price).toBe(110);
      expect(scale.storage.totalGB).toBe(500);
      expect(scale.videoGenerations.totalDurationMinutes).toBe(180);
      expect(scale.videoGenerations.maxResolution).toBe('4K');
      expect(scale.imageGenerations.monthly).toBe(3000);
      expect(scale.aiChat.tokensPerMonth).toBe(1000000);
    });

    it('verifies Founder tier configuration', () => {
      const founder = TIER_CONFIGS[SubscriptionTier.FOUNDER];
      expect(founder.price).toBe(2500);
      expect(founder.billingPeriod).toBe('once');
    });

    it('verifies Free tier configuration', () => {
      const free = TIER_CONFIGS[SubscriptionTier.FREE];
      expect(free.price).toBe(0);
      expect(free.storage.totalGB).toBe(2);
      expect(free.videoGenerations.totalDurationMinutes).toBe(5);
    });
  });

  describe('getTierOrder', () => {
    it('returns tiers ordered by natural progression from Free to Founder', () => {
      const order = getTierOrder();
      expect(order).toEqual([
        SubscriptionTier.FREE,
        SubscriptionTier.START,
        SubscriptionTier.BUILD,
        SubscriptionTier.SCALE,
        SubscriptionTier.FOUNDER,
      ]);
    });
  });
});
