/**
 * Stripe Configuration and Utilities
 */

import Stripe from 'stripe';
import { SubscriptionTier } from '../../../src/services/subscription/types';

// Initialize Stripe with secret key
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-11-20.acacia',
  typescript: true
});

// Stripe price IDs for each tier and billing period
export const STRIPE_PRICES: Record<SubscriptionTier, {
  monthly?: string;
  yearly?: string;
}> = {
  [SubscriptionTier.FREE]: {},
  [SubscriptionTier.PRO_MONTHLY]: {
    monthly: process.env.STRIPE_PRICE_PRO_MONTHLY || 'price_pro_monthly_id',
    yearly: process.env.STRIPE_PRICE_PRO_YEARLY || 'price_pro_yearly_id'
  },
  [SubscriptionTier.STUDIO]: {
    monthly: process.env.STRIPE_PRICE_STUDIO_MONTHLY || 'price_studio_monthly_id',
    yearly: process.env.STRIPE_PRICE_STUDIO_YEARLY || 'price_studio_yearly_id'
  },
  [SubscriptionTier.PRO_YEARLY]: {
    monthly: process.env.STRIPE_PRICE_PRO_MONTHLY || 'price_pro_monthly_id',
    yearly: process.env.STRIPE_PRICE_PRO_YEARLY || 'price_pro_yearly_id'
  }
};

/**
 * Get Stripe price ID for a tier and billing period
 */
export function getPriceId(tier: SubscriptionTier, isYearly: boolean): string | null {
  const prices = STRIPE_PRICES[tier];
  if (!prices) return null;

  return isYearly ? prices.yearly : prices.monthly;
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
  // This would typically look up the product ID in a database
  // For now, map based on known patterns
  if (productId.includes('pro')) return SubscriptionTier.PRO_MONTHLY;
  if (productId.includes('studio')) return SubscriptionTier.STUDIO;
  return null;
}

export { stripe };
