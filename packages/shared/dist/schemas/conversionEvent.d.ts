import { z } from 'zod';
/**
 * Where an event came from. `platform` answers "which system observed this",
 * not "which ad paid for it" — attribution lives in the campaign fields.
 */
export declare const ConversionPlatformSchema: z.ZodEnum<["smart_link", "facebook_ads", "presave", "shopify", "stripe"]>;
/**
 * The measurable outcomes. Ordered roughly by depth of intent.
 *
 * `ad_click` is Meta's count and carries `cost`; `link_click` is our own
 * redirect's count and carries none. They will never match exactly — Meta
 * counts clicks we never see (bots, prefetch, abandoned loads) — and the gap
 * between them is itself a signal worth watching.
 */
export declare const ConversionEventTypeSchema: z.ZodEnum<["ad_click", "link_click", "dsp_redirect", "presave", "email_capture", "sale"]>;
export declare const ConversionEventSchema: z.ZodObject<{
    schemaVersion: z.ZodLiteral<"conversion-event.v1">;
    /**
     * Deduplication key, and the reason a retried Cloud Function cannot
     * double-count a conversion. Callers derive it deterministically from the
     * event's natural identity, never from a timestamp or a random value.
     */
    eventId: z.ZodString;
    /** Firebase auth uid of the artist this event belongs to. */
    artistId: z.ZodString;
    platform: z.ZodEnum<["smart_link", "facebook_ads", "presave", "shopify", "stripe"]>;
    eventType: z.ZodEnum<["ad_click", "link_click", "dsp_redirect", "presave", "email_capture", "sale"]>;
    /** ISO 8601. When the fan acted, not when we recorded it. */
    occurredAt: z.ZodString;
    /**
     * Money, in minor units (cents), as integers.
     *
     * Never floats: these sum into the figures an artist reads as their ad
     * spend and their revenue, and float drift surfaces as a wrong number on
     * their dashboard. The warehouse stores Decimal(18,4); conversion happens
     * once, at the flush boundary.
     */
    revenueMinor: z.ZodDefault<z.ZodNumber>;
    costMinor: z.ZodDefault<z.ZodNumber>;
    currency: z.ZodDefault<z.ZodString>;
    /** Meta campaign id, when this event traces back to a paid campaign. */
    campaignId: z.ZodDefault<z.ZodString>;
    adCreativeId: z.ZodDefault<z.ZodString>;
    /** indii smart-link slug that produced the click, when applicable. */
    smartLinkSlug: z.ZodDefault<z.ZodString>;
    utmSource: z.ZodDefault<z.ZodString>;
    utmMedium: z.ZodDefault<z.ZodString>;
    utmCampaign: z.ZodDefault<z.ZodString>;
    /**
     * Free-form platform specifics — the DSP a fan chose, a Shopify order id,
     * a Meta click id. Kept out of typed columns so a new platform does not
     * require a migration.
     */
    metadata: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodString>>;
}, "strict", z.ZodTypeAny, {
    artistId: string;
    eventId: string;
    eventType: "presave" | "ad_click" | "link_click" | "dsp_redirect" | "email_capture" | "sale";
    schemaVersion: "conversion-event.v1";
    metadata: Record<string, string>;
    currency: string;
    platform: "smart_link" | "facebook_ads" | "presave" | "shopify" | "stripe";
    occurredAt: string;
    revenueMinor: number;
    costMinor: number;
    campaignId: string;
    adCreativeId: string;
    smartLinkSlug: string;
    utmSource: string;
    utmMedium: string;
    utmCampaign: string;
}, {
    artistId: string;
    eventId: string;
    eventType: "presave" | "ad_click" | "link_click" | "dsp_redirect" | "email_capture" | "sale";
    schemaVersion: "conversion-event.v1";
    platform: "smart_link" | "facebook_ads" | "presave" | "shopify" | "stripe";
    occurredAt: string;
    metadata?: Record<string, string> | undefined;
    currency?: string | undefined;
    revenueMinor?: number | undefined;
    costMinor?: number | undefined;
    campaignId?: string | undefined;
    adCreativeId?: string | undefined;
    smartLinkSlug?: string | undefined;
    utmSource?: string | undefined;
    utmMedium?: string | undefined;
    utmCampaign?: string | undefined;
}>;
export type ConversionPlatform = z.infer<typeof ConversionPlatformSchema>;
export type ConversionEventType = z.infer<typeof ConversionEventTypeSchema>;
export type ConversionEvent = z.infer<typeof ConversionEventSchema>;
/**
 * Event types that represent a fan outcome the swarm may optimize toward.
 *
 * `ad_click` is excluded on purpose: optimizing for clicks Meta charges for is
 * circular — it rewards the platform for billing us. Optimization targets must
 * be outcomes we observe ourselves.
 */
export declare const OPTIMIZABLE_EVENT_TYPES: readonly ConversionEventType[];
/**
 * Builds the deterministic dedup key for an event.
 *
 * Same natural identity in, same key out — so a Cloud Function retried by
 * Inngest or Cloud Scheduler re-enqueues the same row rather than inflating
 * the artist's conversion count.
 */
export declare function buildConversionEventId(parts: {
    platform: ConversionPlatform;
    eventType: ConversionEventType;
    /** Whatever uniquely identifies the occurrence on its source platform. */
    sourceId: string;
}): string;
//# sourceMappingURL=conversionEvent.d.ts.map