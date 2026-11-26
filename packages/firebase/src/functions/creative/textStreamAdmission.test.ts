import { describe, expect, it } from 'vitest';

import { SubscriptionTier } from '../../shared/subscription/types';
import { clampTextStreamOutputTokens, minimumTextStreamReservationCost, reservationCoversTextStreamCost, sanitizeTextStreamThinkingConfig } from './textStreamAdmission';

describe('clampTextStreamOutputTokens', () => {
    it('gives a verified Free account a bounded product sample', () => {
        expect(clampTextStreamOutputTokens(undefined, SubscriptionTier.FREE)).toBe(1_024);
        expect(clampTextStreamOutputTokens(9_999, SubscriptionTier.FREE)).toBe(1_024);
    });

    it.each([null, false, '', '100', [], {}, NaN, Infinity])('uses the tier cap for malformed hints (%j)', hint => {
        expect(clampTextStreamOutputTokens(hint, SubscriptionTier.FREE)).toBe(1_024);
        expect(clampTextStreamOutputTokens(hint, SubscriptionTier.PRO_MONTHLY)).toBe(8_192);
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

    it('reserves against the conservative Gemini 3.8 Flash standard rates', () => {
        const cost = minimumTextStreamReservationCost(
            [{ role: 'user', parts: [{ text: 'prompt' }] }],
            { maxOutputTokens: 1_000_000 },
            'gemini-3.8-flash',
        );
        expect(cost).toBeGreaterThan(8.25);
    });

    it.each([undefined, NaN, Infinity, -1, '0.1'])('rejects malformed reservation amounts (%s)', amount => {
        expect(reservationCoversTextStreamCost(amount, 0.01)).toBe(false);
    });
});

describe('sanitizeTextStreamThinkingConfig (Gemini 4 Neon alignment)', () => {
    it.each(['LOW', 'MEDIUM', 'HIGH', 'XHIGH'])('preserves Neon %s and strips legacy thinkingBudget', level => {
        expect(sanitizeTextStreamThinkingConfig('gemini-4-neon', {
            thinkingLevel: level.toLowerCase(),
            thinkingBudget: 2048,
            includeThoughts: true,
        })).toEqual({ thinkingLevel: level, includeThoughts: true });
    });

    it('maps MINIMAL and thinkingBudget: 0 to LOW for gemini-4-neon', () => {
        expect(sanitizeTextStreamThinkingConfig('gemini-4-neon', { thinkingLevel: 'minimal' })).toEqual({ thinkingLevel: 'LOW' });
        expect(sanitizeTextStreamThinkingConfig('gemini-4-neon', { thinkingBudget: 0 })).toEqual({ thinkingLevel: 'LOW' });
    });

    it('rejects unsupported thinking levels for gemini-4-neon and XHIGH for gemini-4-argon', () => {
        expect(() => sanitizeTextStreamThinkingConfig('gemini-4-neon', { thinkingLevel: 'ULTRA' })).toThrow('Unsupported thinking level');
        expect(() => sanitizeTextStreamThinkingConfig('gemini-4-argon', { thinkingLevel: 'XHIGH' })).toThrow('Unsupported thinking level');
    });
});
