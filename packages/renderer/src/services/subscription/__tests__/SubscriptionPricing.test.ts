import { describe, it, expect } from 'vitest';
import {
  SubscriptionTier,
  BILLING_PERIODS,
  calculateBillingTotal,
  TIER_CONFIGS,
  getTierOrder,
  BillingPeriod,
} from '../SubscriptionTier';

describe('Subscription Pricing & Cadence Math', () => {
  describe('calculateBillingTotal', () => {
    it('calculates monthly billing with 0% discount and whole number totals', () => {
      const startMonthly = calculateBillingTotal(22, 'monthly');
      expect(startMonthly.total).toBe(22);
      expect(startMonthly.monthlyEquivalent).toBe(22);
      expect(startMonthly.months).toBe(1);
      expect(startMonthly.discountPercent).toBe(0);

      const buildMonthly = calculateBillingTotal(55, 'monthly');
      expect(buildMonthly.total).toBe(55);
      expect(buildMonthly.monthlyEquivalent).toBe(55);
      expect(buildMonthly.months).toBe(1);

      const scaleMonthly = calculateBillingTotal(110, 'monthly');
      expect(scaleMonthly.total).toBe(110);
      expect(scaleMonthly.monthlyEquivalent).toBe(110);
      expect(scaleMonthly.months).toBe(1);
    });

    it('calculates quarterly billing with ~5% discount and whole number totals', () => {
      // Start ($22/mo): 22 * 3 * 0.95 = 62.7 -> rounded to 63 (~$21/mo)
      const startQuarterly = calculateBillingTotal(22, 'quarterly');
      expect(startQuarterly.total).toBe(63);
      expect(startQuarterly.monthlyEquivalent).toBe(21);
      expect(startQuarterly.months).toBe(3);
      expect(startQuarterly.discountPercent).toBe(5);

      // Build ($55/mo): 55 * 3 * 0.95 = 156.75 -> rounded to 157 (~$52/mo)
      const buildQuarterly = calculateBillingTotal(55, 'quarterly');
      expect(buildQuarterly.total).toBe(157);
      expect(buildQuarterly.monthlyEquivalent).toBe(52);
      expect(buildQuarterly.months).toBe(3);

      // Scale ($110/mo): 110 * 3 * 0.95 = 313.5 -> rounded to 314 (~$105/mo)
      const scaleQuarterly = calculateBillingTotal(110, 'quarterly');
      expect(scaleQuarterly.total).toBe(314);
      expect(scaleQuarterly.monthlyEquivalent).toBe(105);
      expect(scaleQuarterly.months).toBe(3);
    });

    it('calculates six-month billing with ~10% discount and whole number totals', () => {
      // Start ($22/mo): 22 * 6 * 0.90 = 118.8 -> rounded to 119 (~$20/mo)
      const startSixMonth = calculateBillingTotal(22, 'six_month');
      expect(startSixMonth.total).toBe(119);
      expect(startSixMonth.monthlyEquivalent).toBe(20);
      expect(startSixMonth.months).toBe(6);
      expect(startSixMonth.discountPercent).toBe(10);

      // Build ($55/mo): 55 * 6 * 0.90 = 297 (~$50/mo)
      const buildSixMonth = calculateBillingTotal(55, 'six_month');
      expect(buildSixMonth.total).toBe(297);
      expect(buildSixMonth.monthlyEquivalent).toBe(50);
      expect(buildSixMonth.months).toBe(6);

      // Scale ($110/mo): 110 * 6 * 0.90 = 594 (~$99/mo)
      const scaleSixMonth = calculateBillingTotal(110, 'six_month');
      expect(scaleSixMonth.total).toBe(594);
      expect(scaleSixMonth.monthlyEquivalent).toBe(99);
      expect(scaleSixMonth.months).toBe(6);
    });

    it('supports legacy six-month alias with hyphen', () => {
      const startHyphen = calculateBillingTotal(22, 'six-month');
      expect(startHyphen.total).toBe(119);
      expect(startHyphen.months).toBe(6);
    });

    it('calculates annual billing with ~20% discount and whole number totals', () => {
      // Start ($22/mo): 22 * 12 * 0.80 = 211.2 -> rounded to 211 (~$18/mo)
      const startAnnual = calculateBillingTotal(22, 'annual');
      expect(startAnnual.total).toBe(211);
      expect(startAnnual.monthlyEquivalent).toBe(18);
      expect(startAnnual.months).toBe(12);
      expect(startAnnual.discountPercent).toBe(20);

      // Build ($55/mo): 55 * 12 * 0.80 = 528 (~$44/mo)
      const buildAnnual = calculateBillingTotal(55, 'annual');
      expect(buildAnnual.total).toBe(528);
      expect(buildAnnual.monthlyEquivalent).toBe(44);
      expect(buildAnnual.months).toBe(12);

      // Scale ($110/mo): 110 * 12 * 0.80 = 1056 (~$88/mo)
      const scaleAnnual = calculateBillingTotal(110, 'annual');
      expect(scaleAnnual.total).toBe(1056);
      expect(scaleAnnual.monthlyEquivalent).toBe(88);
      expect(scaleAnnual.months).toBe(12);
    });

    it('strictly enforces no .99 or non-integer pricing across all tiers and cadences', () => {
      const prices = [22, 55, 110];
      const periods: BillingPeriod[] = ['monthly', 'quarterly', 'six_month', 'annual'];

      for (const price of prices) {
        for (const period of periods) {
          const res = calculateBillingTotal(price, period);
          expect(Number.isInteger(res.total)).toBe(true);
          expect(Number.isInteger(res.monthlyEquivalent)).toBe(true);
          expect(res.total.toString()).not.toMatch(/\.99$/);
          expect(res.total.toString()).not.toMatch(/\.95$/);
        }
      }
    });

    it('handles zero or negative price gracefully', () => {
      const zero = calculateBillingTotal(0, 'annual');
      expect(zero.total).toBe(0);
      expect(zero.monthlyEquivalent).toBe(0);

      const negative = calculateBillingTotal(-10, 'monthly');
      expect(negative.total).toBe(0);
      expect(negative.monthlyEquivalent).toBe(0);
    });
  });

  describe('BILLING_PERIODS configuration', () => {
    it('defines all four supported cadences with expected commit discounts', () => {
      expect(BILLING_PERIODS.monthly.months).toBe(1);
      expect(BILLING_PERIODS.monthly.discountRate).toBe(0);

      expect(BILLING_PERIODS.quarterly.months).toBe(3);
      expect(BILLING_PERIODS.quarterly.discountRate).toBe(0.05);

      expect(BILLING_PERIODS.six_month.months).toBe(6);
      expect(BILLING_PERIODS.six_month.discountRate).toBe(0.10);

      expect(BILLING_PERIODS.annual.months).toBe(12);
      expect(BILLING_PERIODS.annual.discountRate).toBe(0.20);
    });
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
