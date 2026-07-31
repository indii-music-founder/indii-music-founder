import { z } from 'zod';
/**
 * Conversion Event — the attribution spine.
 *
 * One shape for every measurable thing a fan does, from any surface, that the
 * marketing swarm is allowed to reason about. It maps 1:1 onto the
 * `indii_analytics.omnichannel_events` columns (see
 * warehouse/clickhouse/migrations/001_initial_analytics_schema.sql), so a
 * schema change here is a warehouse migration there — they are one contract in
 * two places.
 *
 * ── Why this exists ─────────────────────────────────────────────────────────
 * Before this, `omnichannel_events` had no writer. Spend was visible and
 * outcomes were not, which means any optimizer running on it would have been
 * optimizing against zeros.
 *
 * ── What is deliberately NOT modelled ───────────────────────────────────────
 * Streams. A Spotify play cannot be attributed to an ad click — no identifier
 * survives the DSP handoff, and royalty reporting arrives months later,
 * aggregated. Modelling a `stream` conversion would invent a causal link that
 * does not exist. Streams still land in `omnichannel_events` via the Airbyte
 * path as platform *volume*, never as an attributed conversion.
 */
const IdentifierSchema = z.string().trim().min(1).max(256);
/**
 * Where an event came from. `platform` answers "which system observed this",
 * not "which ad paid for it" — attribution lives in the campaign fields.
 */
export const ConversionPlatformSchema = z.enum([
    'smart_link', // indii-owned redirect — our own first-party observation
    'facebook_ads', // Meta-reported click/impression cost
    'presave', // indii pre-save landing page
    'shopify', // connected store
    'stripe', // direct checkout
]);
/**
 * The measurable outcomes. Ordered roughly by depth of intent.
 *
 * `ad_click` is Meta's count and carries `cost`; `link_click` is our own
 * redirect's count and carries none. They will never match exactly — Meta
 * counts clicks we never see (bots, prefetch, abandoned loads) — and the gap
 * between them is itself a signal worth watching.
 */
export const ConversionEventTypeSchema = z.enum([
    'ad_click', // Meta reported a paid click
    'link_click', // a fan actually reached our redirect
    'dsp_redirect', // a fan chose a streaming service and left
    'presave', // a fan authorized a pre-save
    'email_capture',
    'sale', // a purchase we can tie to money
]);
export const ConversionEventSchema = z.object({
    schemaVersion: z.literal('conversion-event.v1'),
    /**
     * Deduplication key, and the reason a retried Cloud Function cannot
     * double-count a conversion. Callers derive it deterministically from the
     * event's natural identity, never from a timestamp or a random value.
     */
    eventId: IdentifierSchema,
    /** Firebase auth uid of the artist this event belongs to. */
    artistId: IdentifierSchema,
    platform: ConversionPlatformSchema,
    eventType: ConversionEventTypeSchema,
    /** ISO 8601. When the fan acted, not when we recorded it. */
    occurredAt: z.string().datetime(),
    /**
     * Money, in minor units (cents), as integers.
     *
     * Never floats: these sum into the figures an artist reads as their ad
     * spend and their revenue, and float drift surfaces as a wrong number on
     * their dashboard. The warehouse stores Decimal(18,4); conversion happens
     * once, at the flush boundary.
     */
    revenueMinor: z.number().int().nonnegative().default(0),
    costMinor: z.number().int().nonnegative().default(0),
    currency: z.string().length(3).default('USD'),
    // ── Attribution ─────────────────────────────────────────────────────────
    /** Meta campaign id, when this event traces back to a paid campaign. */
    campaignId: z.string().max(256).default(''),
    adCreativeId: z.string().max(256).default(''),
    /** indii smart-link slug that produced the click, when applicable. */
    smartLinkSlug: z.string().max(128).default(''),
    utmSource: z.string().max(128).default(''),
    utmMedium: z.string().max(128).default(''),
    utmCampaign: z.string().max(128).default(''),
    /**
     * Free-form platform specifics — the DSP a fan chose, a Shopify order id,
     * a Meta click id. Kept out of typed columns so a new platform does not
     * require a migration.
     */
    metadata: z.record(z.string(), z.string()).default({}),
}).strict();
/**
 * Event types that represent a fan outcome the swarm may optimize toward.
 *
 * `ad_click` is excluded on purpose: optimizing for clicks Meta charges for is
 * circular — it rewards the platform for billing us. Optimization targets must
 * be outcomes we observe ourselves.
 */
export const OPTIMIZABLE_EVENT_TYPES = [
    'link_click', 'dsp_redirect', 'presave', 'email_capture', 'sale',
];
/**
 * Builds the deterministic dedup key for an event.
 *
 * Same natural identity in, same key out — so a Cloud Function retried by
 * Inngest or Cloud Scheduler re-enqueues the same row rather than inflating
 * the artist's conversion count.
 */
export function buildConversionEventId(parts) {
    return `${parts.platform}:${parts.eventType}:${parts.sourceId}`;
}
