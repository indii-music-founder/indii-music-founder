import { describe, expect, it, vi } from 'vitest';

import { buildCapiPayload, hashUserData, sendConversions } from './metaConversionsApi.js';
import type { ConversionEvent } from '@indii/shared';

vi.mock('firebase-functions/v2', () => ({
    logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

function makeEvent(overrides: Partial<ConversionEvent> = {}): ConversionEvent {
    return {
        schemaVersion: 'conversion-event.v1',
        eventId: 'smart_link:dsp_redirect:abc',
        artistId: 'artist-uid',
        platform: 'smart_link',
        eventType: 'dsp_redirect',
        occurredAt: '2026-07-31T12:00:00.000Z',
        revenueMinor: 0,
        costMinor: 0,
        currency: 'USD',
        campaignId: 'camp-1',
        adCreativeId: '',
        smartLinkSlug: 'summer',
        utmSource: 'facebook',
        utmMedium: 'cpc',
        utmCampaign: 'summer-launch',
        metadata: { fbclid: 'IwAR123' },
        ...overrides,
    };
}

describe('hashUserData', () => {
    it('normalizes before hashing so digests actually match Meta', () => {
        // Un-normalized input hashes to a different value and silently fails to
        // match — the normalization IS the contract.
        expect(hashUserData({ email: '  Fan@Example.COM ' }))
            .toEqual(hashUserData({ email: 'fan@example.com' }));
    });

    it('strips punctuation from phone numbers', () => {
        expect(hashUserData({ phone: '+1 (555) 010-1234' }))
            .toEqual(hashUserData({ phone: '15550101234' }));
    });

    it('never emits raw contact data', () => {
        const hashed = hashUserData({ email: 'fan@example.com', phone: '15550101234' });
        expect(JSON.stringify(hashed)).not.toContain('fan@example.com');
        expect(JSON.stringify(hashed)).not.toContain('15550101234');
        expect(hashed.em?.[0]).toMatch(/^[a-f0-9]{64}$/);
    });

    it('omits absent fields rather than hashing empty strings', () => {
        expect(hashUserData({})).toEqual({});
        expect(hashUserData({ phone: '---' })).toEqual({});
    });
});

describe('buildCapiPayload', () => {
    it('maps indii event types onto Meta standard events', () => {
        expect(buildCapiPayload(makeEvent({ eventType: 'presave' }))?.event_name).toBe('Lead');
        expect(buildCapiPayload(makeEvent({ eventType: 'sale' }))?.event_name).toBe('Purchase');
        expect(buildCapiPayload(makeEvent({ eventType: 'dsp_redirect' }))?.event_name).toBe('ViewContent');
    });

    it('never reports ad_click back to Meta', () => {
        // Meta told us about that click and billed for it; echoing it back is a
        // feedback loop carrying no information.
        expect(buildCapiPayload(makeEvent({ eventType: 'ad_click' }))).toBeNull();
    });

    it('derives the fbc cookie format from the click id', () => {
        const payload = buildCapiPayload(makeEvent());
        expect(payload?.user_data.fbc).toBe(`fb.1.${Date.parse('2026-07-31T12:00:00.000Z')}.IwAR123`);
    });

    it('skips events Meta cannot attribute to anything', () => {
        // No click id and no contact data means Meta can only add noise to the
        // artist's event-match quality.
        expect(buildCapiPayload(makeEvent({ metadata: {} }))).toBeNull();
    });

    it('still reports when contact data is present without a click id', () => {
        const payload = buildCapiPayload(makeEvent({ metadata: {} }), { email: 'fan@example.com' });
        expect(payload).not.toBeNull();
        expect(payload?.user_data.em).toBeDefined();
    });

    it('attaches purchase value in major units', () => {
        const payload = buildCapiPayload(makeEvent({ eventType: 'sale', revenueMinor: 2599 }));
        expect(payload?.custom_data).toEqual({ value: 25.99, currency: 'USD' });
    });

    it('omits custom_data when there is no revenue', () => {
        expect(buildCapiPayload(makeEvent())?.custom_data).toBeUndefined();
    });

    it('reuses the internal event id so Meta can dedupe against a pixel', () => {
        expect(buildCapiPayload(makeEvent())?.event_id).toBe('smart_link:dsp_redirect:abc');
    });
});

describe('sendConversions', () => {
    it('posts the batch and returns the accepted count', async () => {
        const fetcher = vi.fn().mockResolvedValue({ ok: true, status: 200, text: async () => '' } as Response);

        const sent = await sendConversions('pixel-1', 'token', [{ event: makeEvent() }], fetcher);

        expect(sent).toBe(1);
        expect(String(fetcher.mock.calls[0][0])).toBe('https://graph.facebook.com/v23.0/pixel-1/events');
        expect(String(fetcher.mock.calls[0][1].body)).toContain('access_token=token');
    });

    it('makes no request when every event is unreportable', async () => {
        const fetcher = vi.fn();

        const sent = await sendConversions(
            'pixel-1', 'token', [{ event: makeEvent({ eventType: 'ad_click' }) }], fetcher,
        );

        expect(sent).toBe(0);
        expect(fetcher).not.toHaveBeenCalled();
    });

    it('swallows a Meta rejection — reporting must not break the warehouse write', async () => {
        const fetcher = vi.fn().mockResolvedValue({
            ok: false, status: 400, text: async () => 'Invalid pixel',
        } as Response);

        await expect(sendConversions('pixel-1', 'token', [{ event: makeEvent() }], fetcher))
            .resolves.toBe(0);
    });

    it('swallows a network failure', async () => {
        const fetcher = vi.fn().mockRejectedValue(new Error('ECONNRESET'));

        await expect(sendConversions('pixel-1', 'token', [{ event: makeEvent() }], fetcher))
            .resolves.toBe(0);
    });
});
