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

// Placeholder sentinel values used in development only.
// Real test-mode price IDs are set below as defaults so local emulation works.
const PLACEHOLDER_PRICE_IDS: Record<string, string> = {
  STRIPE_PRICE_PRO_MONTHLY:    'price_1TC4ceECGAoF2ZTQOjOAzJMR',
  STRIPE_PRICE_PRO_YEARLY:     'price_1TC4cfECGAoF2ZTQgaNAFI1Q',
  STRIPE_PRICE_STUDIO_MONTHLY: 'price_1TC4cqECGAoF2ZTQdZiAsoXo',
  STRIPE_PRICE_STUDIO_YEARLY:  'price_1TC4cqECGAoF2ZTQdZiAsoXo', // no yearly yet — same as monthly
  STRIPE_PRICE_FOUNDER_PASS:   'price_1TC4crECGAoF2ZTQ0rlpPs9q',
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
  oneTime?: string;
}> = {
  [SubscriptionTier.FREE]: {},
  [SubscriptionTier.PRO_MONTHLY]: {
    monthly: resolvePriceId('STRIPE_PRICE_PRO_MONTHLY'),
    yearly:  resolvePriceId('STRIPE_PRICE_PRO_YEARLY'),
  },
  [SubscriptionTier.PRO_YEARLY]: {
    monthly: resolvePriceId('STRIPE_PRICE_PRO_MONTHLY'),
    yearly:  resolvePriceId('STRIPE_PRICE_PRO_YEARLY'),
  },
  [SubscriptionTier.STUDIO]: {
    monthly: resolvePriceId('STRIPE_PRICE_STUDIO_MONTHLY'),
    yearly:  resolvePriceId('STRIPE_PRICE_STUDIO_YEARLY'),
  },
  [SubscriptionTier.FOUNDER]: {
    oneTime: resolvePriceId('STRIPE_PRICE_FOUNDER_PASS'),
  },
};

/** Price ID for the Founders Pass one-time checkout */
export const STRIPE_FOUNDER_PRICE_ID = resolvePriceId('STRIPE_PRICE_FOUNDER_PASS');

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

// Canonical product ID → tier mapping (test-mode IDs baked in; override via env for live)
const PRODUCT_TIER_MAP: Record<string, SubscriptionTier> = {
  'prod_UAPRroIFgVlgBH': SubscriptionTier.PRO_MONTHLY,  // indiiOS Pro (test)
  'prod_UAPRv11hqs79bP': SubscriptionTier.STUDIO,        // indiiOS Studio (test)
  'prod_UAPRfFZ19hlLEV': SubscriptionTier.FOUNDER,       // indiiOS Founders Pass (test)
};

/**
 * Map a Stripe product ID to our SubscriptionTier.
 * Checks env overrides first (for live-mode product IDs), then the baked-in map.
 */
export function mapStripeTierToSubscriptionTier(productId: string): SubscriptionTier | null {
  if (process.env.STRIPE_PRODUCT_PRO     && productId === process.env.STRIPE_PRODUCT_PRO)     return SubscriptionTier.PRO_MONTHLY;
  if (process.env.STRIPE_PRODUCT_STUDIO  && productId === process.env.STRIPE_PRODUCT_STUDIO)  return SubscriptionTier.STUDIO;
  if (process.env.STRIPE_PRODUCT_FOUNDER && productId === process.env.STRIPE_PRODUCT_FOUNDER) return SubscriptionTier.FOUNDER;
  return PRODUCT_TIER_MAP[productId] ?? null;
}

