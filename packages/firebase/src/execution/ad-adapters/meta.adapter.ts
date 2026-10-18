/**
 * MetaAdAdapter — Layer 3 (Execution)
 *
 * Implements `IAdPlatformAdapter` for Meta (Facebook & Instagram Ads + Meta CAPI).
 * Integrates with the existing `facebookAdsExecutor` & `metaConversionsApi`
 * patterns while exposing the unified programmatic interface across Campaign,
 * AdSet, AdCreative, Ad provisioning, budget/status mutations, normalized
 * telemetry snapshots, and server-side Conversions API (CAPI) dispatch.
 */

import { META_GRAPH_API_BASE } from '../../analytics/instagramGraphConnection';
import {
    type CampaignObjective,
    type PlatformCampaignReceipt,
    type PlatformTelemetrySnapshot,
    type UnifiedAttributionEvent,
    type UnifiedCampaignDirective,
} from '../../types/ad-execution.types';
import {
    type AdapterFetch,
    AdPlatformAdapterError,
    BaseAdPlatformAdapter,
} from './base.adapter';

export interface MetaAdapterConfig {
    /** Meta Ad Account ID (with or without `act_` prefix). */
    adAccountId: string;
    /** Long-lived Meta System User or OAuth access token. */
    accessToken: string;
    /** Facebook Page ID representing the artist identity. */
    facebookPageId: string;
    /** Optional Instagram Actor ID for native Reels/Stories placement. */
    instagramActorId?: string;
    /** Meta Pixel / Dataset ID for Conversions API (`/{pixelId}/events`). */
    pixelId: string;
    /** Optional resolver that maps internal verified asset IDs to public signed URLs or Meta hashes. */
    assetUrlResolver?: (assetId: string) => Promise<string> | string;
}

const META_OBJECTIVE_MAP: Record<CampaignObjective, string> = {
    DSP_STREAM_CONVERSION: 'OUTCOME_TRAFFIC',
    PRE_SAVE_INTAKE: 'OUTCOME_LEADS',
    WAITLIST_INTAKE: 'OUTCOME_LEADS',
    MERCH_CONVERSION: 'OUTCOME_SALES',
    EVENT_TICKETING: 'OUTCOME_SALES',
};

const META_CAPI_EVENT_MAP: Record<UnifiedAttributionEvent['eventName'], string> = {
    SmartlinkView: 'ViewContent',
    DSPOutboundClick: 'ViewContent',
    PreSaveComplete: 'Lead',
    WaitlistSignup: 'CompleteRegistration',
    MerchPurchase: 'Purchase',
};

interface MetaGraphIdResponse {
    id?: string;
    success?: boolean;
    error?: { message?: string; code?: number; fbtrace_id?: string };
}

interface MetaCapiResponse {
    events_received?: number;
    fbtrace_id?: string;
    error?: { message?: string; code?: number; fbtrace_id?: string };
}

interface MetaInsightsRow {
    spend?: string;
    impressions?: string;
    clicks?: string;
    actions?: Array<{ action_type?: string; value?: string }>;
}

interface MetaInsightsResponse {
    data?: MetaInsightsRow[];
    error?: { message?: string; code?: number };
}

export class MetaAdAdapter extends BaseAdPlatformAdapter {
    readonly platform = 'META' as const;
    private readonly config: MetaAdapterConfig;

    constructor(config: MetaAdapterConfig, fetcher: AdapterFetch = fetch) {
        super(fetcher);
        this.config = config;
    }

    private assertConfig(): void {
        if (
            !this.config.adAccountId?.trim() ||
            !this.config.accessToken?.trim() ||
            !this.config.facebookPageId?.trim() ||
            !this.config.pixelId?.trim()
        ) {
            throw new AdPlatformAdapterError(
                this.platform,
                'MISSING_PLATFORM_CREDENTIALS',
                'MetaAdAdapter requires adAccountId, accessToken, facebookPageId, and pixelId.',
            );
        }
    }

    private get normalizedAdAccountId(): string {
        return this.config.adAccountId.replace(/^act_/, '').trim();
    }

    private async postGraph<T extends MetaGraphIdResponse>(
        path: string,
        params: Record<string, string>,
    ): Promise<T> {
        const cleanPath = path.replace(/^\/+/, '');
        const body = new URLSearchParams({
            ...params,
            access_token: this.config.accessToken,
        });

        const response = await this.fetcher(`${META_GRAPH_API_BASE}/${cleanPath}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: body.toString(),
        });

        const raw = (await response.json().catch(() => ({}))) as T;
        if (!response.ok || raw.error) {
            throw new AdPlatformAdapterError(
                this.platform,
                'API_EXECUTION_FAILED',
                raw.error?.message ?? `Meta Graph write to ${cleanPath} failed with HTTP ${response.status}.`,
                { status: response.status, fbtraceId: raw.error?.fbtrace_id },
            );
        }

        return raw;
    }

    async provisionCampaign(
        directive: UnifiedCampaignDirective,
        allocatedBudgetCents: number,
    ): Promise<PlatformCampaignReceipt> {
        this.assertConfig();
        const valid = this.validateProvisionRequest(directive, allocatedBudgetCents);

        const primaryAssets =
            valid.assets.videoAssetIds.length > 0
                ? valid.assets.videoAssetIds
                : valid.assets.imageAssetIds;

        if (primaryAssets.length === 0) {
            throw new AdPlatformAdapterError(
                this.platform,
                'MISSING_PLATFORM_ASSETS',
                'Meta campaign provisioning requires at least one verified videoAssetId or imageAssetId.',
            );
        }

        const accountId = this.normalizedAdAccountId;
        const dailyBudgetCents = Math.min(allocatedBudgetCents, valid.budgetAllocation.dailyBudgetCents);

        // 1. Create Meta Campaign
        const campaignName = `indii_${valid.assets.isrc}_${valid.objective}_${valid.directiveId}`;
        const campaignRes = await this.postGraph<MetaGraphIdResponse>(
            `act_${accountId}/campaigns`,
            {
                name: campaignName,
                objective: META_OBJECTIVE_MAP[valid.objective],
                status: 'PAUSED',
                special_ad_categories: JSON.stringify([]),
            },
        );

        if (!campaignRes.id) {
            throw new AdPlatformAdapterError(
                this.platform,
                'API_EXECUTION_FAILED',
                'Meta Graph API did not return a campaign ID.',
            );
        }

        // 2. Create Meta AdSet with AudienceTargetingSpec & Pixel promoted_object
        const targetingPayload: Record<string, unknown> = {
            geo_locations: { countries: valid.targeting.geoLocations },
            ...(valid.targeting.ageMin ? { age_min: valid.targeting.ageMin } : {}),
            ...(valid.targeting.ageMax ? { age_max: valid.targeting.ageMax } : {}),
            ...(valid.targeting.customAudienceIds?.META?.length
                ? {
                    custom_audiences: valid.targeting.customAudienceIds.META.map(id => ({ id })),
                }
                : {}),
        };

        const adSetParams: Record<string, string> = {
            name: `${campaignName}_adset`,
            campaign_id: campaignRes.id,
            daily_budget: String(dailyBudgetCents),
            billing_event: 'IMPRESSIONS',
            optimization_goal: 'OFFSITE_CONVERSIONS',
            targeting: JSON.stringify(targetingPayload),
            promoted_object: JSON.stringify({
                pixel_id: this.config.pixelId,
                custom_event_type:
                    valid.objective === 'MERCH_CONVERSION' || valid.objective === 'EVENT_TICKETING'
                        ? 'PURCHASE'
                        : valid.objective === 'PRE_SAVE_INTAKE' || valid.objective === 'WAITLIST_INTAKE'
                            ? 'LEAD'
                            : 'CONTENT_VIEW',
            }),
            start_time: valid.schedule.startTimeIso,
            ...(valid.schedule.endTimeIso ? { end_time: valid.schedule.endTimeIso } : {}),
            status: 'PAUSED',
        };

        const adSetRes = await this.postGraph<MetaGraphIdResponse>(
            `act_${accountId}/adsets`,
            adSetParams,
        );

        if (!adSetRes.id) {
            throw new AdPlatformAdapterError(
                this.platform,
                'API_EXECUTION_FAILED',
                'Meta Graph API did not return an AdSet ID.',
            );
        }

        // 3. Create Ad Creative & Ad for each verified post-mastering asset
        const trackedUrl = this.buildTrackedSmartlinkUrl(valid);
        const externalAdIds: string[] = [];

        for (const assetId of primaryAssets) {
            const resolvedAssetRef = this.config.assetUrlResolver
                ? await this.config.assetUrlResolver(assetId)
                : assetId;

            const creativeRes = await this.postGraph<MetaGraphIdResponse>(
                `act_${accountId}/adcreatives`,
                {
                    name: `${campaignName}_creative_${assetId}`,
                    object_story_spec: JSON.stringify({
                        page_id: this.config.facebookPageId,
                        ...(this.config.instagramActorId
                            ? { instagram_actor_id: this.config.instagramActorId }
                            : {}),
                        link_data: {
                            link: trackedUrl,
                            message: `Stream / Pre-Save (${valid.assets.isrc})`,
                            call_to_action: {
                                type:
                                    valid.objective === 'MERCH_CONVERSION'
                                        ? 'SHOP_NOW'
                                        : valid.objective === 'PRE_SAVE_INTAKE' || valid.objective === 'WAITLIST_INTAKE'
                                            ? 'SIGN_UP'
                                            : 'LISTEN_NOW',
                                value: { link: trackedUrl },
                            },
                            asset_reference: resolvedAssetRef,
                        },
                    }),
                },
            );

            if (!creativeRes.id) {
                throw new AdPlatformAdapterError(
                    this.platform,
                    'API_EXECUTION_FAILED',
                    `Meta Graph API did not return a creative ID for asset ${assetId}.`,
                );
            }

            const adRes = await this.postGraph<MetaGraphIdResponse>(
                `act_${accountId}/ads`,
                {
                    name: `${campaignName}_ad_${assetId}`,
                    adset_id: adSetRes.id,
                    creative: JSON.stringify({ creative_id: creativeRes.id }),
                    status: 'PAUSED',
                },
            );

            if (!adRes.id) {
                throw new AdPlatformAdapterError(
                    this.platform,
                    'API_EXECUTION_FAILED',
                    `Meta Graph API did not return an ad ID for asset ${assetId}.`,
                );
            }

            externalAdIds.push(adRes.id);
        }

        return this.validateReceipt({
            platform: this.platform,
            externalCampaignId: campaignRes.id,
            externalAdSetOrGroupId: adSetRes.id,
            externalAdIds,
            status: 'PAUSED',
            committedBudgetCents: allocatedBudgetCents,
            timestampIso: new Date().toISOString(),
            rawResponseMetadata: {
                adAccountId: accountId,
                dailyBudgetCents,
                trackedSmartlinkUrl: trackedUrl,
            },
        });
    }

    async updateBudget(externalCampaignId: string, dailyBudgetCents: number): Promise<void> {
        this.assertConfig();
        if (!externalCampaignId.trim()) {
            throw new AdPlatformAdapterError(
                this.platform,
                'INVALID_DIRECTIVE_PAYLOAD',
                'externalCampaignId is required to update budget.',
            );
        }
        if (!Number.isInteger(dailyBudgetCents) || dailyBudgetCents < this.minBudgetCents) {
            throw new AdPlatformAdapterError(
                this.platform,
                'BUDGET_BELOW_MINIMUM',
                `Daily budget (${dailyBudgetCents} cents) must be an integer >= ${this.minBudgetCents} cents.`,
            );
        }

        await this.postGraph<MetaGraphIdResponse>(externalCampaignId, {
            daily_budget: String(dailyBudgetCents),
        });
    }

    async updateStatus(externalCampaignId: string, status: 'ACTIVE' | 'PAUSED'): Promise<void> {
        this.assertConfig();
        if (!externalCampaignId.trim()) {
            throw new AdPlatformAdapterError(
                this.platform,
                'INVALID_DIRECTIVE_PAYLOAD',
                'externalCampaignId is required to update status.',
            );
        }

        await this.postGraph<MetaGraphIdResponse>(externalCampaignId, { status });
    }

    async fetchTelemetry(
        externalCampaignId: string,
        dateRange: { start: string; end: string },
    ): Promise<PlatformTelemetrySnapshot> {
        this.assertConfig();
        const query = new URLSearchParams({
            fields: 'spend,impressions,clicks,actions',
            time_range: JSON.stringify({ since: dateRange.start, until: dateRange.end }),
            access_token: this.config.accessToken,
        });

        const response = await this.fetcher(
            `${META_GRAPH_API_BASE}/${externalCampaignId.replace(/^\/+/, '')}/insights?${query.toString()}`,
            { method: 'GET' },
        );

        const body = (await response.json().catch(() => ({}))) as MetaInsightsResponse;
        if (!response.ok || body.error) {
            throw new AdPlatformAdapterError(
                this.platform,
                'API_EXECUTION_FAILED',
                body.error?.message ?? `Meta insights query failed with HTTP ${response.status}.`,
            );
        }

        const row = body.data?.[0] ?? {};
        const spendDollars = Number.parseFloat(row.spend ?? '0');
        const spendCents = Number.isFinite(spendDollars) ? Math.round(spendDollars * 100) : 0;
        const impressions = Number.parseInt(row.impressions ?? '0', 10) || 0;
        const clicks = Number.parseInt(row.clicks ?? '0', 10) || 0;

        let outboundDspClicks = 0;
        let conversions = 0;

        for (const action of row.actions ?? []) {
            const count = Number.parseInt(action.value ?? '0', 10) || 0;
            if (
                action.action_type === 'offsite_conversion.fb_pixel_view_content' ||
                action.action_type === 'link_click'
            ) {
                outboundDspClicks += count;
            }
            if (
                action.action_type === 'offsite_conversion.fb_pixel_lead' ||
                action.action_type === 'offsite_conversion.fb_pixel_complete_registration' ||
                action.action_type === 'offsite_conversion.fb_pixel_purchase'
            ) {
                conversions += count;
            }
        }

        return this.buildNormalizedTelemetry({
            externalCampaignId,
            spendCents,
            impressions,
            clicks,
            outboundDspClicks,
            conversions,
        });
    }

    async dispatchConversionEvent(
        event: UnifiedAttributionEvent,
    ): Promise<{ success: boolean; externalTraceId?: string }> {
        this.assertConfig();
        const valid = this.validateAttributionEvent(event);

        const { fbclid, fbp, fbc } = valid.clickIdentifiers;
        const { emailSha256, phoneSha256, externalFanId, clientIpAddress, clientUserAgent } =
            valid.userData;

        const hasMetaSignal = Boolean(
            fbclid || fbp || fbc || emailSha256 || phoneSha256 || externalFanId,
        );
        if (!hasMetaSignal) {
            return { success: false };
        }

        const derivedFbc =
            fbc ?? (fbclid ? `fb.1.${valid.eventTimestampUnix * 1000}.${fbclid}` : undefined);

        const userDataPayload: Record<string, unknown> = {
            client_ip_address: clientIpAddress,
            client_user_agent: clientUserAgent,
            ...(emailSha256 ? { em: [emailSha256.toLowerCase()] } : {}),
            ...(phoneSha256 ? { ph: [phoneSha256.toLowerCase()] } : {}),
            ...(externalFanId ? { external_id: [this.sha256Hex(externalFanId)] } : {}),
            ...(derivedFbc ? { fbc: derivedFbc } : {}),
            ...(fbp ? { fbp } : {}),
        };

        const customDataPayload: Record<string, unknown> = {
            content_ids: [valid.isrc, valid.releaseId],
            content_type: 'music_release',
            smartlink_id: valid.smartlinkId,
            ...(valid.targetDsp ? { target_dsp: valid.targetDsp } : {}),
            ...(valid.valueMetadata
                ? {
                    currency: valid.valueMetadata.currency,
                    value: Number((valid.valueMetadata.valueCents / 100).toFixed(2)),
                }
                : {}),
        };

        const eventPayload = {
            event_name: META_CAPI_EVENT_MAP[valid.eventName],
            event_time: valid.eventTimestampUnix,
            event_id: valid.eventId,
            action_source: 'website',
            user_data: userDataPayload,
            custom_data: customDataPayload,
        };

        const response = await this.fetcher(
            `${META_GRAPH_API_BASE}/${this.config.pixelId}/events`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({
                    data: JSON.stringify([eventPayload]),
                    access_token: this.config.accessToken,
                }).toString(),
            },
        );

        const raw = (await response.json().catch(() => ({}))) as MetaCapiResponse;
        if (!response.ok || raw.error) {
            return {
                success: false,
                externalTraceId: raw.error?.fbtrace_id,
            };
        }

        return {
            success: true,
            externalTraceId: raw.fbtrace_id,
        };
    }
}
