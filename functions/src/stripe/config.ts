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
      apiVersion: '2025-12-15.clover',
      typescript: true,
    });
  }
  return _stripe;
}

// Re-export as a getter proxy for backward compatibility
export const stripe = new Proxy({} as Stripe, {
  get(_target, prop) {
    return (getStripe() as any)[prop];
  },
});

// Placeholder sentinel values used in development only
const PLACEHOLDER_PRICE_IDS: Record<string, string> = {
  STRIPE_PRICE_PRO_MONTHLY: 'price_pro_monthly_id',
  STRIPE_PRICE_PRO_YEARLY: 'price_pro_yearly_id',
  STRIPE_PRICE_STUDIO_MONTHLY: 'price_studio_monthly_id',
  STRIPE_PRICE_STUDIO_YEARLY: 'price_studio_yearly_id',
};

/**
 * Resolve a Stripe price env var. In production, warns if the variable is
 * missing or still set to the development placeholder. Does NOT throw — because
 * all Cloud Functions share the same entry point and a throw here kills
 * unrelated functions (e.g. video generation).
 */
function resolvePriceId(envVar: string): string {
  const value = process.env[envVar];
  const placeholder = PLACEHOLDER_PRICE_IDS[envVar] ?? 'price_not_configured';

  if (process.env.NODE_ENV === 'production') {
    if (!value || value === placeholder) {
      console.warn(
        `[Stripe] Missing or placeholder price ID for ${envVar}. ` +
        `Checkout will fail until a real Stripe price ID is set.`
      );
    }
  }

  return value || placeholder;
}

// Stripe price IDs for each tier and billing period
export const STRIPE_PRICES: Record<SubscriptionTier, {
  monthly?: string;
  yearly?: string;
}> = {
  [SubscriptionTier.FREE]: {},
  [SubscriptionTier.PRO_MONTHLY]: {
    monthly: resolvePriceId('STRIPE_PRICE_PRO_MONTHLY'),
    yearly: resolvePriceId('STRIPE_PRICE_PRO_YEARLY')
  },
  [SubscriptionTier.STUDIO]: {
    monthly: resolvePriceId('STRIPE_PRICE_STUDIO_MONTHLY'),
    yearly: resolvePriceId('STRIPE_PRICE_STUDIO_YEARLY')
  },
  [SubscriptionTier.PRO_YEARLY]: {
    monthly: resolvePriceId('STRIPE_PRICE_PRO_MONTHLY'),
    yearly: resolvePriceId('STRIPE_PRICE_PRO_YEARLY')
  }
};

/**
 * Get Stripe price ID for a tier and billing period
 */
export function getPriceId(tier: SubscriptionTier, isYearly: boolean): string | null {
  const prices = STRIPE_PRICES[tier];
  if (!prices) return null;

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
 * Map Stripe price tier to our subscription tier
 */
export function mapStripeTierToSubscriptionTier(productId: string): SubscriptionTier | null {
  // Check environment variables first (allows manual overrides)
  if (process.env.STRIPE_PRODUCT_PRO && productId === process.env.STRIPE_PRODUCT_PRO) return SubscriptionTier.PRO_MONTHLY;
  if (process.env.STRIPE_PRODUCT_STUDIO && productId === process.env.STRIPE_PRODUCT_STUDIO) return SubscriptionTier.STUDIO;

  // For now, map based on known production/test patterns
  const p = productId.toLowerCase();
  if (p.includes('pro')) return SubscriptionTier.PRO_MONTHLY;
  if (p.includes('studio')) return SubscriptionTier.STUDIO;
  return null;
}

