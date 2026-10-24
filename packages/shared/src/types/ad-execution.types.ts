/**
 * Multi-Platform Programmatic Ad Adapters & Unified Server-Side Attribution Contracts
 *
 * Strictly scoped to post-mastering music business administration:
 * All media references resolve to production-verified post-mastering release IDs,
 * ISRCs, smartlink routes, and validated visual/video creative assets.
 */

import { z } from 'zod';

// ─────────────────────────────────────────────────────────────────────────────
// Core Domain Types
// ─────────────────────────────────────────────────────────────────────────────

export type SupportedAdPlatform = 'META' | 'TIKTOK' | 'GOOGLE_ADS';

export type CampaignObjective =
    | 'DSP_STREAM_CONVERSION'
    | 'PRE_SAVE_INTAKE'
    | 'WAITLIST_INTAKE'
    | 'MERCH_CONVERSION'
    | 'EVENT_TICKETING';

export interface VerifiedReleaseAssets {
    releaseId: string;
    isrc: string;
    upc?: string;
    smartlinkId: string;
    smartlinkUrl: string;
    videoAssetIds: string[];       // Production-verified video teaser IDs
    imageAssetIds: string[];       // Production-verified / upscaled artwork IDs
    tiktokSparkAuthCodes?: string[]; // Optional auth codes for organic artist posts
    youtubeVideoIds?: string[];    // Unlisted/Public YouTube asset IDs for Google Ads
}

export interface AudienceTargetingSpec {
    geoLocations: string[];        // ISO country/region/DMA codes
    ageMin?: number;
    ageMax?: number;
    genreTaxonomyTags: string[];
    similarArtistEntityIds: string[];
    customAudienceIds?: Partial<Record<SupportedAdPlatform, string[]>>;
}

export interface UnifiedCampaignDirective {
    directiveId: string;
    triggeredBy: 'GROWTH_INTELLIGENCE_ENGINE' | 'MARKETING_AGENT' | 'MANUAL_OVERRIDE';
    artistId: string;
    ledgerAccountId: string;       // Finance Dept recoupment ledger reference
    objective: CampaignObjective;
    platforms: SupportedAdPlatform[];
    budgetAllocation: {
        currency: string;
        totalBudgetCents: number;
        dailyBudgetCents: number;
        platformSplitPercentages: Partial<Record<SupportedAdPlatform, number>>;
    };
    schedule: {
        startTimeIso: string;
        endTimeIso?: string;
    };
    assets: VerifiedReleaseAssets;
    targeting: AudienceTargetingSpec;
}

export interface PlatformCampaignReceipt {
    platform: SupportedAdPlatform;
    externalCampaignId: string;
    externalAdSetOrGroupId: string;
    externalAdIds: string[];
    status: 'ACTIVE' | 'PAUSED' | 'PENDING_REVIEW' | 'FAILED';
    committedBudgetCents: number;
    timestampIso: string;
    rawResponseMetadata?: Record<string, unknown>;
}

export interface UnifiedAttributionEvent {
    eventId: string;               // Deduplication key across CAPI / Events API
    eventTimestampUnix: number;
    eventName: 'SmartlinkView' | 'DSPOutboundClick' | 'PreSaveComplete' | 'WaitlistSignup' | 'MerchPurchase';
    releaseId: string;
    isrc: string;
    smartlinkId: string;
    targetDsp?: 'SPOTIFY' | 'APPLE_MUSIC' | 'TIDAL' | 'AMAZON_MUSIC' | 'YOUTUBE_MUSIC' | 'BANDCAMP';
    clickIdentifiers: {
        fbclid?: string;
        fbp?: string;
        fbc?: string;
        ttclid?: string;
        ttp?: string;
        gclid?: string;
        gbraid?: string;
        wbraid?: string;
    };
    userData: {
        clientIpAddress: string;
        clientUserAgent: string;
        emailSha256?: string;        // Pre-hashed from Waitlist/Pre-Save intake schema
        phoneSha256?: string;
        externalFanId?: string;
    };
    valueMetadata?: {
        currency: string;
        valueCents: number;
    };
}

export interface PlatformTelemetrySnapshot {
    platform: SupportedAdPlatform;
    externalCampaignId: string;
    spendCents: number;
    impressions: number;
    clicks: number;
    outboundDspClicks: number;
    conversions: number;
    costPerOutboundClickCents: number;
    costPerConversionCents: number;
    syncedAtIso: string;
}

export interface IAdPlatformAdapter {
    readonly platform: SupportedAdPlatform;
    provisionCampaign(directive: UnifiedCampaignDirective, allocatedBudgetCents: number): Promise<PlatformCampaignReceipt>;
    updateBudget(externalCampaignId: string, dailyBudgetCents: number): Promise<void>;
    updateStatus(externalCampaignId: string, status: 'ACTIVE' | 'PAUSED'): Promise<void>;
    fetchTelemetry(externalCampaignId: string, dateRange: { start: string; end: string }): Promise<PlatformTelemetrySnapshot>;
    dispatchConversionEvent(event: UnifiedAttributionEvent): Promise<{ success: boolean; externalTraceId?: string; errorMessage?: string }>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Runtime Zod Validation Schemas (API Boundaries)
// ─────────────────────────────────────────────────────────────────────────────

/** ISO 39012 ISRC standard: 2-char country + 3-char registrant + 2-digit year + 5-digit designation (with optional hyphens). */
export const ISRC_REGEX = /^[A-Z]{2}-?[A-Z0-9]{3}-?\d{2}-?\d{5}$/i;

export const SupportedAdPlatformSchema = z.enum(['META', 'TIKTOK', 'GOOGLE_ADS']);

export const CampaignObjectiveSchema = z.enum([
    'DSP_STREAM_CONVERSION',
    'PRE_SAVE_INTAKE',
    'WAITLIST_INTAKE',
    'MERCH_CONVERSION',
    'EVENT_TICKETING',
]);

export const VerifiedReleaseAssetsSchema = z.object({
    releaseId: z.string().min(1, 'releaseId is required'),
    isrc: z.string().regex(ISRC_REGEX, 'Invalid post-mastering ISRC format'),
    upc: z.string().regex(/^\d{12,14}$/, 'UPC/EAN must be 12-14 digits').optional(),
    smartlinkId: z.string().min(1, 'smartlinkId is required'),
    smartlinkUrl: z.string().url('smartlinkUrl must be a valid URL'),
    videoAssetIds: z.array(z.string().min(1)),
    imageAssetIds: z.array(z.string().min(1)),
    tiktokSparkAuthCodes: z.array(z.string().min(1)).optional(),
    youtubeVideoIds: z.array(z.string().min(1)).optional(),
}).refine(
    (assets) =>
        assets.videoAssetIds.length > 0 ||
        assets.imageAssetIds.length > 0 ||
        (assets.tiktokSparkAuthCodes?.length ?? 0) > 0 ||
        (assets.youtubeVideoIds?.length ?? 0) > 0,
    { message: 'At least one verified visual or video asset ID is required for campaign execution' },
);

export const AudienceTargetingSpecSchema = z.object({
    geoLocations: z.array(z.string().min(2)).min(1, 'At least one geoLocation code is required'),
    ageMin: z.number().int().min(13).max(65).optional(),
    ageMax: z.number().int().min(13).max(65).optional(),
    genreTaxonomyTags: z.array(z.string().min(1)),
    similarArtistEntityIds: z.array(z.string().min(1)),
    customAudienceIds: z.record(SupportedAdPlatformSchema, z.array(z.string().min(1))).optional(),
});

export const UnifiedCampaignDirectiveSchema = z.object({
    directiveId: z.string().min(1),
    triggeredBy: z.enum(['GROWTH_INTELLIGENCE_ENGINE', 'MARKETING_AGENT', 'MANUAL_OVERRIDE']),
    artistId: z.string().min(1),
    ledgerAccountId: z.string().min(1),
    objective: CampaignObjectiveSchema,
    platforms: z.array(SupportedAdPlatformSchema).min(1),
    budgetAllocation: z.object({
        currency: z.string().length(3),
        totalBudgetCents: z.number().int().positive(),
        dailyBudgetCents: z.number().int().positive(),
        platformSplitPercentages: z.record(SupportedAdPlatformSchema, z.number().min(0).max(100)),
    }),
    schedule: z.object({
        startTimeIso: z.string().min(1),
        endTimeIso: z.string().min(1).optional(),
    }),
    assets: VerifiedReleaseAssetsSchema,
    targeting: AudienceTargetingSpecSchema,
});

export const PlatformCampaignReceiptSchema = z.object({
    platform: SupportedAdPlatformSchema,
    externalCampaignId: z.string().min(1),
    externalAdSetOrGroupId: z.string().min(1),
    externalAdIds: z.array(z.string().min(1)),
    status: z.enum(['ACTIVE', 'PAUSED', 'PENDING_REVIEW', 'FAILED']),
    committedBudgetCents: z.number().int().nonnegative(),
    timestampIso: z.string().min(1),
    rawResponseMetadata: z.record(z.string(), z.unknown()).optional(),
});

const SHA256_HEX_REGEX = /^[a-f0-9]{64}$/i;

export const UnifiedAttributionEventSchema = z.object({
    eventId: z.string().min(1),
    eventTimestampUnix: z.number().int().positive(),
    eventName: z.enum([
        'SmartlinkView',
        'DSPOutboundClick',
        'PreSaveComplete',
        'WaitlistSignup',
        'MerchPurchase',
    ]),
    releaseId: z.string().min(1),
    isrc: z.string().regex(ISRC_REGEX, 'Invalid ISRC on attribution event'),
    smartlinkId: z.string().min(1),
    targetDsp: z.enum([
        'SPOTIFY',
        'APPLE_MUSIC',
        'TIDAL',
        'AMAZON_MUSIC',
        'YOUTUBE_MUSIC',
        'BANDCAMP',
    ]).optional(),
    clickIdentifiers: z.object({
        fbclid: z.string().min(1).optional(),
        fbp: z.string().min(1).optional(),
        fbc: z.string().min(1).optional(),
        ttclid: z.string().min(1).optional(),
        ttp: z.string().min(1).optional(),
        gclid: z.string().min(1).optional(),
        gbraid: z.string().min(1).optional(),
        wbraid: z.string().min(1).optional(),
    }),
    userData: z.object({
        clientIpAddress: z.string().min(1),
        clientUserAgent: z.string().min(1),
        emailSha256: z.string().regex(SHA256_HEX_REGEX, 'emailSha256 must be a 64-char SHA-256 hex digest').optional(),
        phoneSha256: z.string().regex(SHA256_HEX_REGEX, 'phoneSha256 must be a 64-char SHA-256 hex digest').optional(),
        externalFanId: z.string().min(1).optional(),
    }),
    valueMetadata: z.object({
        currency: z.string().length(3),
        valueCents: z.number().int().nonnegative(),
    }).optional(),
});

export const PlatformTelemetrySnapshotSchema = z.object({
    platform: SupportedAdPlatformSchema,
    externalCampaignId: z.string().min(1),
    spendCents: z.number().int().nonnegative(),
    impressions: z.number().int().nonnegative(),
    clicks: z.number().int().nonnegative(),
    outboundDspClicks: z.number().int().nonnegative(),
    conversions: z.number().int().nonnegative(),
    costPerOutboundClickCents: z.number().int().nonnegative(),
    costPerConversionCents: z.number().int().nonnegative(),
    syncedAtIso: z.string().min(1),
});
