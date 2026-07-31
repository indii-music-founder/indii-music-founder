/**
 * metaConversionsApi — sends observed outcomes back to Meta, server-side.
 *
 * ── Why bother, when we already have the data ───────────────────────────────
 * Storing conversions in our own warehouse tells *us* which ads worked. It
 * does nothing for Meta's delivery model, which is choosing who sees the ad
 * thousands of times a day. Without a conversion signal, Meta optimizes for
 * link clicks — the metric it bills for — and the artist pays for traffic that
 * never listens.
 *
 * Feeding real outcomes back is what turns "cheap clicks" into "cheap fans".
 *
 * ── Why server-side rather than a browser pixel ─────────────────────────────
 * The events worth reporting mostly do not happen in a browser we control: a
 * DSP redirect ends on Spotify's domain, a pre-save completes against an OAuth
 * callback. Add iOS tracking prevention and a pixel would miss most of them.
 *
 * ── Privacy ─────────────────────────────────────────────────────────────────
 * Meta requires that any customer information be SHA-256 hashed before it
 * leaves our servers, and this module never sends raw contact data — see
 * `hashUserData`. Most events carry no contact data at all: `fbclid` alone is
 * enough for Meta to attribute the conversion.
 */

import { logger } from 'firebase-functions/v2';
import { createHash } from 'node:crypto';

import type { ConversionEvent, ConversionEventType } from '@indii/shared';
import { META_GRAPH_API_BASE } from '../analytics/instagramGraphConnection';

/** Injectable for tests. Defaults to global fetch (Node 22 runtime). */
export type CapiFetch = (url: string, init: RequestInit) => Promise<Response>;

/**
 * indii's event vocabulary → Meta's standard events.
 *
 * Standard names matter: Meta's optimizer only bids toward events it
 * recognizes. A custom name would be recorded but not optimizable, which
 * defeats the purpose of sending it.
 *
 * `ad_click` is absent deliberately — reporting Meta's own click back to Meta
 * would be a feedback loop with no information in it.
 */
const EVENT_NAME_BY_TYPE: Partial<Record<ConversionEventType, string>> = {
    link_click: 'ViewContent',
    dsp_redirect: 'ViewContent',
    presave: 'Lead',
    email_capture: 'Lead',
    sale: 'Purchase',
};

export interface MetaUserData {
    email?: string;
    phone?: string;
}

/**
 * Normalizes and hashes contact data to Meta's spec: trim, lowercase, then
 * SHA-256 hex. Un-normalized input hashes to a different digest and silently
 * fails to match, so the normalization is part of the contract, not hygiene.
 */
export function hashUserData(userData: MetaUserData): Record<string, string[]> {
    const hashed: Record<string, string[]> = {};

    if (userData.email) {
        hashed.em = [createHash('sha256').update(userData.email.trim().toLowerCase()).digest('hex')];
    }
    if (userData.phone) {
        // Meta expects digits only — no punctuation, no leading '+'.
        const digits = userData.phone.replace(/\D/g, '');
        if (digits) hashed.ph = [createHash('sha256').update(digits).digest('hex')];
    }

    return hashed;
}

export interface CapiPayload {
    event_name: string;
    event_time: number;
    event_id: string;
    action_source: string;
    user_data: Record<string, unknown>;
    custom_data?: Record<string, unknown>;
}

/**
 * Builds the Meta payload for one conversion event, or null when the event is
 * not worth reporting.
 *
 * Returns null when there is no `fbclid`: without it Meta cannot attribute the
 * event to an ad, so sending it adds noise to the artist's dataset — and to
 * their event-match quality score — for no gain.
 */
export function buildCapiPayload(
    event: ConversionEvent,
    userData: MetaUserData = {},
): CapiPayload | null {
    const eventName = EVENT_NAME_BY_TYPE[event.eventType];
    if (!eventName) return null;

    const fbclid = event.metadata.fbclid;
    const hashed = hashUserData(userData);
    if (!fbclid && Object.keys(hashed).length === 0) return null;

    return {
        event_name: eventName,
        event_time: Math.floor(new Date(event.occurredAt).getTime() / 1000),
        // Same id we use internally, so Meta can deduplicate this against any
        // browser pixel that also fired for the same action.
        event_id: event.eventId,
        action_source: 'website',
        user_data: {
            ...hashed,
            // Meta's documented derivation of a click id into the fbc cookie
            // format: fb.1.<timestamp_ms>.<fbclid>.
            ...(fbclid ? { fbc: `fb.1.${new Date(event.occurredAt).getTime()}.${fbclid}` } : {}),
        },
        ...(event.revenueMinor > 0
            ? {
                custom_data: {
                    value: Number((event.revenueMinor / 100).toFixed(2)),
                    currency: event.currency,
                },
            }
            : {}),
    };
}

/**
 * Posts a batch of conversions to a Meta pixel's Conversions API.
 *
 * Never throws. This is a reporting side-channel: a Meta outage must not fail
 * the flush that is also writing these events to our own warehouse, which is
 * the record that actually matters.
 *
 * @returns how many events were accepted for sending.
 */
export async function sendConversions(
    pixelId: string,
    accessToken: string,
    events: ReadonlyArray<{ event: ConversionEvent; userData?: MetaUserData }>,
    fetcher: CapiFetch = fetch,
): Promise<number> {
    const payloads = events
        .map(({ event, userData }) => buildCapiPayload(event, userData))
        .filter((payload): payload is CapiPayload => payload !== null);

    if (payloads.length === 0) return 0;

    try {
        const response = await fetcher(`${META_GRAPH_API_BASE}/${pixelId}/events`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                data: JSON.stringify(payloads),
                access_token: accessToken,
            }).toString(),
        });

        if (!response.ok) {
            const detail = await response.text().catch(() => '');
            logger.error('[metaConversionsApi] Meta rejected the batch', {
                pixelId, status: response.status, detail: detail.slice(0, 1000),
            });
            return 0;
        }

        return payloads.length;
    } catch (error) {
        logger.error('[metaConversionsApi] Send failed', {
            pixelId, error: error instanceof Error ? error.message : String(error),
        });
        return 0;
    }
}
