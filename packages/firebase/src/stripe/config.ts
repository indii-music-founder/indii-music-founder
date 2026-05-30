/**
 * Stripe Configuration and Utilities
 */

import Stripe from 'stripe';
import { Subscription, SubscriptionTier } from '../shared/subscription/types';

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
    console.warn(`[Stripe] Missing price ID for ${envVar}. Checkout for the related tier is disabled until configured.`);
    return '';
  }

  return value;
}

// Stripe price IDs for each tier and billing period
export const STRIPE_PRICES: Record<SubscriptionTier, {
  monthly?: string;
  yearly?: string;
  oneTime?: string;
}> = {
  [SubscriptionTier.FREE]: {},
  [SubscriptionTier.PRO_MONTHLY]: {
    monthly: resolvePriceId('STRIPE_PRICE_PRO_MONTHLY'),
    yearly: resolvePriceId('STRIPE_PRICE_PRO_YEARLY'),
  },
  [SubscriptionTier.PRO_YEARLY]: {
    monthly: resolvePriceId('STRIPE_PRICE_PRO_MONTHLY'),
    yearly: resolvePriceId('STRIPE_PRICE_PRO_YEARLY'),
  },
  [SubscriptionTier.STUDIO]: {
    monthly: resolvePriceId('STRIPE_PRICE_STUDIO_MONTHLY'),
    yearly: resolvePriceId('STRIPE_PRICE_STUDIO_YEARLY'),
  },
  [SubscriptionTier.FOUNDER]: {
    oneTime: resolvePriceId('STRIPE_PRICE_FOUNDER_PASS'),
  },
};

/** Price ID for the Founders Pass one-time checkout */
export const STRIPE_FOUNDER_PRICE_ID = resolvePriceId('STRIPE_PRICE_FOUNDER_PASS');

/**
 * Get Stripe price ID for a tier and billing period.
 * For FOUNDER tier, returns the oneTime price regardless of isYearly.
 */
export function getPriceId(tier: SubscriptionTier, isYearly: boolean): string | null {
  const prices = STRIPE_PRICES[tier];
  if (!prices) return null;

  // Founder pass is a one-time purchase — return oneTime if present
  if (prices.oneTime) return prices.oneTime;

  return (isYearly ? prices.yearly : prices.monthly) || null;
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
  // Founder (one-time — no interval)
  if (process.env.STRIPE_PRODUCT_FOUNDER && productId === process.env.STRIPE_PRODUCT_FOUNDER) return SubscriptionTier.FOUNDER;

  // Studio (interval doesn't distinguish tiers here — Studio is Studio)
  if (process.env.STRIPE_PRODUCT_STUDIO && productId === process.env.STRIPE_PRODUCT_STUDIO) return SubscriptionTier.STUDIO;

  // Pro — use billing interval to distinguish monthly vs yearly
  if (process.env.STRIPE_PRODUCT_PRO && productId === process.env.STRIPE_PRODUCT_PRO) {
    return billingInterval === 'year' ? SubscriptionTier.PRO_YEARLY : SubscriptionTier.PRO_MONTHLY;
  }

  return null;
}
