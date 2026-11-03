import { describe, expect, it } from 'vitest';

import { SubscriptionTier } from '../../shared/subscription/types';
import { clampTextStreamOutputTokens, minimumTextStreamReservationCost, reservationCoversTextStreamCost } from './textStreamAdmission';

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

describe('agent-stream cost admission', () => {
    it('rejects a fixed micro-reservation for a large request', () => {
        const cost = minimumTextStreamReservationCost(
            [{ role: 'user', parts: [{ text: 'x'.repeat(400_000) }] }],
            { maxOutputTokens: 8_192 },
            'gemini-3.1-pro-preview',
        );
        expect(cost).toBeGreaterThan(0.001);
        expect(reservationCoversTextStreamCost(0.001, cost)).toBe(false);
        expect(reservationCoversTextStreamCost(cost, cost)).toBe(true);
    });

    it('uses the pro rate for approved specialist endpoints', () => {
        const contents = [{ role: 'user', parts: [{ text: 'prompt' }] }];
        const config = { maxOutputTokens: 8_192 };
        expect(minimumTextStreamReservationCost(contents, config, 'projects/p/locations/l/endpoints/e'))
            .toBe(minimumTextStreamReservationCost(contents, config, 'gemini-3.1-pro-preview'));
    });

    it.each([undefined, NaN, Infinity, -1, '0.1'])('rejects malformed reservation amounts (%s)', amount => {
        expect(reservationCoversTextStreamCost(amount, 0.01)).toBe(false);
    });
});
