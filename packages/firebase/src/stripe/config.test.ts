import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mapStripeStatus, mapStripeTierToSubscriptionTier, getPriceId } from './config';
import { SubscriptionTier } from '../shared/subscription/types';

describe('Stripe Config Utilities', () => {
    const originalEnv = { ...process.env };

    beforeEach(() => {
        process.env = { ...originalEnv };
    });

    afterEach(() => {
        process.env = originalEnv;
    });

    describe('mapStripeStatus', () => {
        it('maps active, trialing, and past_due accurately', () => {
            expect(mapStripeStatus('active')).toBe('active');
            expect(mapStripeStatus('trialing')).toBe('trialing');
            expect(mapStripeStatus('past_due')).toBe('past_due');
            expect(mapStripeStatus('unpaid')).toBe('past_due');
            expect(mapStripeStatus('canceled')).toBe('canceled');
            expect(mapStripeStatus('incomplete')).toBe('incomplete');
            expect(mapStripeStatus('incomplete_expired')).toBe('canceled');
        });
    });

    describe('mapStripeTierToSubscriptionTier', () => {
        it('maps legacy Pro and Studio products', () => {
            process.env.STRIPE_PRODUCT_PRO = 'prod_pro_123';
            process.env.STRIPE_PRODUCT_STUDIO = 'prod_studio_456';

            expect(mapStripeTierToSubscriptionTier('prod_pro_123', 'month')).toBe(SubscriptionTier.PRO_MONTHLY);
            expect(mapStripeTierToSubscriptionTier('prod_pro_123', 'year')).toBe(SubscriptionTier.PRO_YEARLY);
            expect(mapStripeTierToSubscriptionTier('prod_studio_456', 'month')).toBe(SubscriptionTier.STUDIO);
            expect(mapStripeTierToSubscriptionTier('unknown_prod')).toBeNull();
        });

        it('maps public beta Start, Build, and Scale products (ISSUE-1422)', () => {
            process.env.STRIPE_PRODUCT_START = 'prod_start_beta';
            process.env.STRIPE_PRODUCT_BUILD = 'prod_build_beta';
            process.env.STRIPE_PRODUCT_SCALE = 'prod_scale_beta';

            expect(mapStripeTierToSubscriptionTier('prod_start_beta', 'month')).toBe(SubscriptionTier.PRO_MONTHLY);
            expect(mapStripeTierToSubscriptionTier('prod_start_beta', 'year')).toBe(SubscriptionTier.PRO_YEARLY);
            expect(mapStripeTierToSubscriptionTier('prod_build_beta')).toBe(SubscriptionTier.STUDIO);
            expect(mapStripeTierToSubscriptionTier('prod_scale_beta')).toBe(SubscriptionTier.STUDIO);
        });
    });

    describe('getPriceId', () => {
        it('returns null when price is not configured without throwing', () => {
            delete process.env.STRIPE_PRICE_PRO_MONTHLY;
            expect(getPriceId(SubscriptionTier.PRO_MONTHLY, false)).toBeNull();
        });

        it('returns configured price ID when present', () => {
            process.env.STRIPE_PRICE_PRO_MONTHLY = 'price_pro_mo_test';
            expect(getPriceId(SubscriptionTier.PRO_MONTHLY, false)).toBe('price_pro_mo_test');
        });
    });
});
