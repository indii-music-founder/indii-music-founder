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

            expect(mapStripeTierToSubscriptionTier('prod_start_beta')).toBe(SubscriptionTier.START);
            expect(mapStripeTierToSubscriptionTier('prod_start_beta', 'month')).toBe(SubscriptionTier.START);
            expect(mapStripeTierToSubscriptionTier('prod_build_beta')).toBe(SubscriptionTier.BUILD);
            expect(mapStripeTierToSubscriptionTier('prod_scale_beta')).toBe(SubscriptionTier.SCALE);
        });
    });

    describe('getPriceId', () => {
        it('returns null when price is not configured without throwing', () => {
            delete process.env.STRIPE_PRICE_PRO_MONTHLY;
            delete process.env.STRIPE_PRICE_START_MONTHLY;
            expect(getPriceId(SubscriptionTier.START, false)).toBeNull();
            expect(getPriceId(SubscriptionTier.PRO_MONTHLY, false)).toBeNull();
        });

        it('returns configured price ID when present for legacy boolean isYearly', () => {
            process.env.STRIPE_PRICE_PRO_MONTHLY = 'price_pro_mo_test';
            process.env.STRIPE_PRICE_PRO_YEARLY = 'price_pro_yr_test';
            expect(getPriceId(SubscriptionTier.PRO_MONTHLY, false)).toBe('price_pro_mo_test');
            expect(getPriceId(SubscriptionTier.PRO_MONTHLY, true)).toBe('price_pro_yr_test');
        });

        it('resolves multi-period pricing across monthly, quarterly, six-month, and annual cadences', () => {
            process.env.STRIPE_PRICE_START_MONTHLY = 'price_start_mo';
            process.env.STRIPE_PRICE_START_QUARTERLY = 'price_start_qtr';
            process.env.STRIPE_PRICE_START_SIX_MONTH = 'price_start_6mo';
            process.env.STRIPE_PRICE_START_ANNUAL = 'price_start_ann';

            expect(getPriceId(SubscriptionTier.START, 'monthly')).toBe('price_start_mo');
            expect(getPriceId(SubscriptionTier.START, 'quarterly')).toBe('price_start_qtr');
            expect(getPriceId(SubscriptionTier.START, 'six_month')).toBe('price_start_6mo');
            expect(getPriceId(SubscriptionTier.START, 'six-month')).toBe('price_start_6mo');
            expect(getPriceId(SubscriptionTier.START, 'annual')).toBe('price_start_ann');
            expect(getPriceId(SubscriptionTier.START, 'yearly')).toBe('price_start_ann');
        });

        it('resolves Build and Scale multi-period prices with fallbacks', () => {
            process.env.STRIPE_PRICE_BUILD_MONTHLY = 'price_build_mo';
            process.env.STRIPE_PRICE_BUILD_QUARTERLY = 'price_build_qtr';
            process.env.STRIPE_PRICE_SCALE_MONTHLY = 'price_scale_mo';
            process.env.STRIPE_PRICE_SCALE_ANNUAL = 'price_scale_ann';

            expect(getPriceId(SubscriptionTier.BUILD, 'monthly')).toBe('price_build_mo');
            expect(getPriceId(SubscriptionTier.BUILD, 'quarterly')).toBe('price_build_qtr');
            expect(getPriceId(SubscriptionTier.SCALE, 'monthly')).toBe('price_scale_mo');
            expect(getPriceId(SubscriptionTier.SCALE, 'annual')).toBe('price_scale_ann');
        });
    });
});
