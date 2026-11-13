import { describe, expect, it } from 'vitest';
import type Stripe from 'stripe';
import { assertPrepaidCatalog, prepaidOffer } from './prepaidPricing';
import { SubscriptionTier } from '../shared/subscription/SubscriptionTier';

function catalog() {
  return {
    price: { active: true, currency: 'usd', unit_amount: 132000, product: 'prod_scale', billing_scheme: 'per_unit', transform_quantity: null,
      livemode: false, recurring: { interval: 'year', interval_count: 1, usage_type: 'licensed' } } as Stripe.Price,
    coupon: { valid: true, duration: 'once', currency: 'usd', amount_off: 66000, percent_off: null, livemode: false } as Stripe.Coupon,
  };
}
const offer = prepaidOffer(SubscriptionTier.SCALE, 'annual')!;

describe('introductory prepaid Stripe catalog', () => {
  it.each([
    [SubscriptionTier.START, 'quarterly', 5600, 6600],
    [SubscriptionTier.START, 'six_month', 9200, 13200],
    [SubscriptionTier.START, 'annual', 13200, 26400],
    [SubscriptionTier.BUILD, 'quarterly', 14000, 16500],
    [SubscriptionTier.BUILD, 'six_month', 23100, 33000],
    [SubscriptionTier.BUILD, 'annual', 33000, 66000],
    [SubscriptionTier.SCALE, 'quarterly', 28100, 33000],
    [SubscriptionTier.SCALE, 'six_month', 46200, 66000],
    [SubscriptionTier.SCALE, 'annual', 66000, 132000],
  ] as const)('quotes %s %s correctly', (tier, period, firstTermCents, renewalCents) => {
    expect(prepaidOffer(tier, period)).toMatchObject({ firstTermCents, renewalCents, discountCents: renewalCents - firstTermCents });
  });

  it('uses full-price recurring billing with only the first invoice discounted', () => {
    const { price, coupon } = catalog();
    expect(offer).toMatchObject({ firstTermCents: 66000, renewalCents: 132000, discountCents: 66000, months: 12 });
    expect(() => assertPrepaidCatalog(price, coupon, offer)).not.toThrow();
  });
  it('uses fixed savings consistent with whole-dollar quarterly pricing', () => {
    expect(prepaidOffer(SubscriptionTier.START, 'quarterly')).toMatchObject({ firstTermCents: 5600, renewalCents: 6600, discountCents: 1000 });
  });
  it('normalizes aliases and leaves monthly billing unchanged', () => {
    expect(prepaidOffer(SubscriptionTier.PRO_YEARLY, 'yearly')).toMatchObject({ tier: SubscriptionTier.START, firstTermCents: 13200 });
    expect(prepaidOffer(SubscriptionTier.BUILD, 'six-month')).toEqual(prepaidOffer(SubscriptionTier.BUILD, 'six_month'));
    expect(prepaidOffer(SubscriptionTier.START, 'monthly')).toBeNull();
    expect(() => prepaidOffer(SubscriptionTier.START, 'forever')).toThrow('Unsupported billing period');
  });
  it.each([
    { unit_amount: 105600 }, { currency: 'eur' }, { active: false },
    { recurring: { interval: 'month', interval_count: 1, usage_type: 'licensed' } },
    { recurring: { interval: 'year', interval_count: 1, usage_type: 'metered' } },
  ])('rejects a mismatched recurring price: %j', (override) => {
    const { price, coupon } = catalog();
    expect(() => assertPrepaidCatalog({ ...price, ...override } as Stripe.Price, coupon, offer)).toThrow('renewal price');
  });
  it.each([
    { duration: 'forever' }, { duration: 'repeating' }, { amount_off: 26400 },
    { percent_off: 50 }, { currency: 'eur' }, { valid: false }, { livemode: true },
    { applies_to: { products: ['prod_other'] } },
  ])('rejects a mismatched or recurring discount: %j', (override) => {
    const { price, coupon } = catalog();
    expect(() => assertPrepaidCatalog(price, { ...coupon, ...override } as Stripe.Coupon, offer)).toThrow('introductory discount');
  });
});
