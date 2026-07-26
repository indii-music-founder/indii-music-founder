import { describe, expect, it } from 'vitest';

import { SubscriptionTier } from '../../shared/subscription/types';
import { clampTextStreamOutputTokens } from './textStreamAdmission';

describe('clampTextStreamOutputTokens', () => {
    it('gives a verified Free account a bounded product sample', () => {
        expect(clampTextStreamOutputTokens(undefined, SubscriptionTier.FREE)).toBe(1_024);
        expect(clampTextStreamOutputTokens(9_999, SubscriptionTier.FREE)).toBe(1_024);
    });

    it('keeps paid and Founder calls bounded per request without treating browser input as authority', () => {
        expect(clampTextStreamOutputTokens(9_999, SubscriptionTier.PRO_MONTHLY)).toBe(8_192);
        expect(clampTextStreamOutputTokens(0, SubscriptionTier.FOUNDER)).toBe(1);
    });
});
