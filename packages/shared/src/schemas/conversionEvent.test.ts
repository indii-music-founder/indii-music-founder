import { describe, expect, it } from 'vitest';

import {
    ConversionEventSchema,
    OPTIMIZABLE_EVENT_TYPES,
    buildConversionEventId,
} from './conversionEvent.js';

const VALID = {
    schemaVersion: 'conversion-event.v1' as const,
    eventId: 'smart_link:link_click:abc',
    artistId: 'artist-uid',
    platform: 'smart_link' as const,
    eventType: 'link_click' as const,
    occurredAt: '2026-07-31T12:00:00.000Z',
};

describe('ConversionEventSchema', () => {
    it('fills every optional field with a zero value', () => {
        const parsed = ConversionEventSchema.parse(VALID);

        // Producers should never have to spell out empty attribution; the
        // warehouse columns are NOT NULL with defaults.
        expect(parsed).toMatchObject({
            revenueMinor: 0, costMinor: 0, currency: 'USD',
            campaignId: '', adCreativeId: '', smartLinkSlug: '',
            utmSource: '', utmMedium: '', utmCampaign: '', metadata: {},
        });
    });

    it('rejects fractional money', () => {
        // Money is minor units as integers — a float here is the bug this
        // schema exists to catch before it reaches an artist's dashboard.
        expect(ConversionEventSchema.safeParse({ ...VALID, revenueMinor: 25.99 }).success).toBe(false);
    });

    it('rejects negative money', () => {
        expect(ConversionEventSchema.safeParse({ ...VALID, costMinor: -1 }).success).toBe(false);
    });

    it('rejects a non-ISO timestamp', () => {
        expect(ConversionEventSchema.safeParse({ ...VALID, occurredAt: '2026-07-31' }).success).toBe(false);
    });

    it('rejects unknown fields rather than silently dropping them', () => {
        // strict(): a typo'd producer field must fail loudly, not vanish
        // between the emitter and the warehouse.
        expect(ConversionEventSchema.safeParse({ ...VALID, revenue: 100 }).success).toBe(false);
    });

    it('rejects an unknown event type', () => {
        expect(ConversionEventSchema.safeParse({ ...VALID, eventType: 'stream' }).success).toBe(false);
    });

    it('rejects an empty artistId', () => {
        expect(ConversionEventSchema.safeParse({ ...VALID, artistId: '   ' }).success).toBe(false);
    });

    it('requires a 3-letter currency', () => {
        expect(ConversionEventSchema.safeParse({ ...VALID, currency: 'DOLLARS' }).success).toBe(false);
    });
});

describe('OPTIMIZABLE_EVENT_TYPES', () => {
    it('excludes ad_click', () => {
        // Optimizing toward the click Meta bills us for is circular — it
        // rewards the platform for charging us.
        expect(OPTIMIZABLE_EVENT_TYPES).not.toContain('ad_click');
    });

    it('covers the outcomes we observe ourselves', () => {
        expect(OPTIMIZABLE_EVENT_TYPES).toEqual(
            expect.arrayContaining(['link_click', 'dsp_redirect', 'presave', 'sale']),
        );
    });
});

describe('buildConversionEventId', () => {
    it('is deterministic for the same natural identity', () => {
        const parts = { platform: 'shopify' as const, eventType: 'sale' as const, sourceId: 'order-9' };
        expect(buildConversionEventId(parts)).toBe(buildConversionEventId(parts));
    });

    it('separates the same source id across platforms and event types', () => {
        expect(buildConversionEventId({ platform: 'shopify', eventType: 'sale', sourceId: 'x' }))
            .not.toBe(buildConversionEventId({ platform: 'stripe', eventType: 'sale', sourceId: 'x' }));
        expect(buildConversionEventId({ platform: 'presave', eventType: 'presave', sourceId: 'x' }))
            .not.toBe(buildConversionEventId({ platform: 'presave', eventType: 'email_capture', sourceId: 'x' }));
    });
});
