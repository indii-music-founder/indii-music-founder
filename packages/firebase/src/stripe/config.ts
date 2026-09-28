/**
 * Stripe Configuration and Utilities
 */

import Stripe from 'stripe';
import { Subscription, SubscriptionTier, BillingPeriod } from '../shared/subscription/types';

import { getStripeSecretKey } from '../config/secrets';

// Lazy-initialized Stripe singleton to avoid crashing during Firebase CLI analysis
// (secrets aren't available at module load time)
let _stripe: Stripe | null = null;

function getStripe(): Stripe {
  if (!_stripe) {
    _stripe = new Stripe(getStripeSecretKey(), {
      apiVersion: '2026-02-25.clover' as Stripe.LatestApiVersion,
      typescript: true,
    });
  }
  return _stripe;
}

// Re-export as a getter proxy for backward compatibility
export const stripe = new Proxy({} as Stripe, {
  get(_target, prop) {
    return (getStripe() as unknown as Record<string, unknown>)[prop as string];
  },
});

/**
 * Resolve a Stripe price env var without hardcoded product fallbacks.
 * Callers reject empty values before creating Checkout sessions.
 */
function resolvePriceId(envVar: string): string {
  const value = process.env[envVar];

  if (!value) {
    if (process.env.NODE_ENV !== 'test' && process.env.VITEST !== 'true') {
      console.warn(`[Stripe] Missing price ID for ${envVar}. Checkout for the related tier is disabled until configured.`);
    }
    return '';
  }

  return value;
}

// Stripe price IDs for each tier and billing period (lazy getters for test safety and dynamic env resolution)
export const STRIPE_PRICES: Record<SubscriptionTier, {
  monthly?: string;
  quarterly?: string;
  six_month?: string;
  yearly?: string;
  annual?: string;
  oneTime?: string;
}> = {
  [SubscriptionTier.FREE]: {},
  [SubscriptionTier.START]: {
    get monthly() { return resolvePriceId('STRIPE_PRICE_START_MONTHLY') || resolvePriceId('STRIPE_PRICE_PRO_MONTHLY'); },
    get quarterly() { return resolvePriceId('STRIPE_PRICE_START_QUARTERLY'); },
    get six_month() { return resolvePriceId('STRIPE_PRICE_START_SIX_MONTH'); },
    get yearly() { return resolvePriceId('STRIPE_PRICE_START_ANNUAL') || resolvePriceId('STRIPE_PRICE_START_YEARLY') || resolvePriceId('STRIPE_PRICE_PRO_YEARLY'); },
    get annual() { return this.yearly; },
  },
  [SubscriptionTier.BUILD]: {
    get monthly() { return resolvePriceId('STRIPE_PRICE_BUILD_MONTHLY') || resolvePriceId('STRIPE_PRICE_STUDIO_MONTHLY'); },
    get quarterly() { return resolvePriceId('STRIPE_PRICE_BUILD_QUARTERLY'); },
    get six_month() { return resolvePriceId('STRIPE_PRICE_BUILD_SIX_MONTH'); },
    get yearly() { return resolvePriceId('STRIPE_PRICE_BUILD_ANNUAL') || resolvePriceId('STRIPE_PRICE_BUILD_YEARLY') || resolvePriceId('STRIPE_PRICE_STUDIO_YEARLY'); },
    get annual() { return this.yearly; },
  },
  [SubscriptionTier.SCALE]: {
    get monthly() { return resolvePriceId('STRIPE_PRICE_SCALE_MONTHLY') || resolvePriceId('STRIPE_PRICE_STUDIO_MONTHLY'); },
    get quarterly() { return resolvePriceId('STRIPE_PRICE_SCALE_QUARTERLY'); },
    get six_month() { return resolvePriceId('STRIPE_PRICE_SCALE_SIX_MONTH'); },
    get yearly() { return resolvePriceId('STRIPE_PRICE_SCALE_ANNUAL') || resolvePriceId('STRIPE_PRICE_SCALE_YEARLY') || resolvePriceId('STRIPE_PRICE_STUDIO_YEARLY'); },
    get annual() { return this.yearly; },
  },
  [SubscriptionTier.PRO_MONTHLY]: {
    get monthly() { return resolvePriceId('STRIPE_PRICE_START_MONTHLY') || resolvePriceId('STRIPE_PRICE_PRO_MONTHLY'); },
    get yearly() { return resolvePriceId('STRIPE_PRICE_START_ANNUAL') || resolvePriceId('STRIPE_PRICE_PRO_YEARLY'); },
    get annual() { return this.yearly; },
  },
  [SubscriptionTier.PRO_YEARLY]: {
    get monthly() { return resolvePriceId('STRIPE_PRICE_START_MONTHLY') || resolvePriceId('STRIPE_PRICE_PRO_MONTHLY'); },
    get yearly() { return resolvePriceId('STRIPE_PRICE_START_ANNUAL') || resolvePriceId('STRIPE_PRICE_PRO_YEARLY'); },
    get annual() { return this.yearly; },
  },
  [SubscriptionTier.STUDIO]: {
    get monthly() { return resolvePriceId('STRIPE_PRICE_BUILD_MONTHLY') || resolvePriceId('STRIPE_PRICE_STUDIO_MONTHLY'); },
    get yearly() { return resolvePriceId('STRIPE_PRICE_BUILD_ANNUAL') || resolvePriceId('STRIPE_PRICE_STUDIO_YEARLY'); },
    get annual() { return this.yearly; },
  },
  [SubscriptionTier.FOUNDER]: {
    get oneTime() { return resolvePriceId('STRIPE_PRICE_FOUNDER_ONE_TIME'); },
  },
};

/**
 * Get Stripe price ID for a tier and billing period.
 * Supports boolean isYearly for backwards compatibility, or explicit BillingPeriod.
 * Returns the oneTime price if present.
 */
export function getPriceId(
  tier: SubscriptionTier,
  periodOrIsYearly: boolean | BillingPeriod | 'six-month' | 'yearly' = 'monthly'
): string | null {
  const prices = STRIPE_PRICES[tier];
  if (!prices) return null;

  if (prices.oneTime) return prices.oneTime;

  if (typeof periodOrIsYearly === 'boolean') {
    return (periodOrIsYearly ? prices.yearly : prices.monthly) || null;
  }

  const normalized = periodOrIsYearly === 'six-month' ? 'six_month'
    : periodOrIsYearly === 'yearly' ? 'annual'
    : periodOrIsYearly;

  switch (normalized) {
    case 'annual':
      return prices.annual || prices.yearly || null;
    case 'quarterly':
      return prices.quarterly || null;
    case 'six_month':
      return prices.six_month || null;
    case 'monthly':
    default:
      return prices.monthly || null;
  }
}

/**
 * Map Stripe subscription status to our subscription status
 */
export function mapStripeStatus(status: Stripe.Subscription.Status): Subscription['status'] {
  switch (status) {
    case 'active':
      return 'active';
    case 'past_due':
      return 'past_due';
    case 'canceled':
      return 'canceled';
    case 'trialing':
      return 'trialing';
    case 'incomplete':
      return 'incomplete';
    case 'incomplete_expired':
      return 'canceled';
    case 'unpaid':
      return 'past_due';
    default:
      return 'canceled';
  }
}

/**
 * Map a Stripe product ID (and optional billing interval) to our SubscriptionTier.
 * Product IDs must be configured through environment variables.
 *
 * When a Pro product has both monthly and yearly prices under the same product ID,
 * the caller should pass the billing interval from `price.recurring.interval`.
 * Without the interval, Pro defaults to PRO_MONTHLY.
 */
export function mapStripeTierToSubscriptionTier(
  productId: string,
  billingInterval?: 'month' | 'year' | string | null
): SubscriptionTier | null {
  // Public beta tiers (Start / Build / Scale)
  if (process.env.STRIPE_PRODUCT_START && productId === process.env.STRIPE_PRODUCT_START) {
    return SubscriptionTier.START;
  }
  if (process.env.STRIPE_PRODUCT_BUILD && productId === process.env.STRIPE_PRODUCT_BUILD) {
    return SubscriptionTier.BUILD;
  }
  if (process.env.STRIPE_PRODUCT_SCALE && productId === process.env.STRIPE_PRODUCT_SCALE) {
    return SubscriptionTier.SCALE;
  }

  // Legacy Studio
  if (process.env.STRIPE_PRODUCT_STUDIO && productId === process.env.STRIPE_PRODUCT_STUDIO) return SubscriptionTier.STUDIO;

  // Legacy Pro — use billing interval to distinguish monthly vs yearly
  if (process.env.STRIPE_PRODUCT_PRO && productId === process.env.STRIPE_PRODUCT_PRO) {
    return billingInterval === 'year' ? SubscriptionTier.PRO_YEARLY : SubscriptionTier.PRO_MONTHLY;
  }

  return null;
}
