import type Stripe from 'stripe';
import { HttpsError } from 'firebase-functions/v2/https';
import { BILLING_PERIODS, calculateBillingTotal, SubscriptionTier, TIER_CONFIGS, type BillingPeriod } from '../shared/subscription/SubscriptionTier';

export interface PrepaidOffer {
  tier: SubscriptionTier;
  period: BillingPeriod;
  months: number;
  firstTermCents: number;
  renewalCents: number;
  discountCents: number;
  couponEnv: string;
}

/** The recurring price is always full price; only the first invoice is discounted. */
export function prepaidOffer(tier: SubscriptionTier, cadence: string): PrepaidOffer | null {
  const period = cadence === 'six-month' ? 'six_month' : cadence === 'yearly' ? 'annual' : cadence;
  if (!Object.hasOwn(BILLING_PERIODS, period)) throw new HttpsError('invalid-argument', 'Unsupported billing period');
  if (period === 'monthly') return null;
  const canonicalTier = tier === SubscriptionTier.PRO_MONTHLY || tier === SubscriptionTier.PRO_YEARLY
    ? SubscriptionTier.START : tier === SubscriptionTier.STUDIO ? SubscriptionTier.BUILD : tier;
  if (![SubscriptionTier.START, SubscriptionTier.BUILD, SubscriptionTier.SCALE].includes(canonicalTier)) {
    throw new HttpsError('invalid-argument', 'Unsupported prepaid subscription tier');
  }
  const quote = calculateBillingTotal(TIER_CONFIGS[canonicalTier].price, period as BillingPeriod);
  return {
    tier: canonicalTier, period: period as BillingPeriod, months: quote.months,
    firstTermCents: quote.total * 100, renewalCents: quote.renewalTotal * 100,
    discountCents: (quote.renewalTotal - quote.total) * 100,
    couponEnv: `STRIPE_COUPON_${canonicalTier.toUpperCase()}_${period.toUpperCase()}_INTRO`,
  };
}

export function assertPrepaidCatalog(price: Stripe.Price, coupon: Stripe.Coupon, offer: PrepaidOffer): void {
  const recurring = price.recurring;
  const matchingPeriod = recurring?.interval === 'month' && recurring.interval_count === offer.months
    || recurring?.interval === 'year' && recurring.interval_count === 1 && offer.months === 12;
  const productId = typeof price.product === 'string' ? price.product : price.product?.id;
  if (!price.active || price.currency !== 'usd' || price.unit_amount !== offer.renewalCents
    || price.billing_scheme !== 'per_unit' || price.transform_quantity || !matchingPeriod
    || recurring?.usage_type !== 'licensed') {
    throw new HttpsError('failed-precondition', 'The configured prepaid renewal price does not match the published offer.');
  }
  if (!coupon.valid || coupon.duration !== 'once' || coupon.currency !== 'usd'
    || coupon.amount_off !== offer.discountCents || coupon.percent_off != null
    || coupon.livemode !== price.livemode
    || coupon.applies_to?.products && !coupon.applies_to.products.includes(productId)) {
    throw new HttpsError('failed-precondition', 'The configured introductory discount does not match the published first-term offer.');
  }
}
