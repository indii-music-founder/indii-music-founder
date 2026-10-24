/**
 * TikTokAdAdapter — Layer 3 (Execution)
 *
 * Implements `IAdPlatformAdapter` for TikTok Marketing API v1.3 & Spark Ads,
 * plus server-side TikTok Events API v1.3 conversion dispatch.
 *
 * Supports both organic artist post amplification via `tiktokSparkAuthCodes`
 * (`identity_type: 'AUTH_CODE'`) and custom identity video ad creatives
 * resolved from post-mastering `videoAssetIds`.
 */

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

export const TIKTOK_API_BASE_V1_3 = 'https://business-api.tiktok.com/open_api/v1.3';

export interface TikTokAdapterConfig {
    advertiserId: string;
    accessToken: string;
    pixelCode: string;
    /** Optional custom identity ID when running non-Spark video ads. */
    customIdentityId?: string;
    apiBaseUrl?: string;
}

const TIKTOK_OBJECTIVE_MAP: Record<CampaignObjective, string> = {
    DSP_STREAM_CONVERSION: 'TRAFFIC',
    PRE_SAVE_INTAKE: 'WEB_CONVERSIONS',
    WAITLIST_INTAKE: 'LEAD_GENERATION',
    MERCH_CONVERSION: 'WEB_CONVERSIONS',
    EVENT_TICKETING: 'WEB_CONVERSIONS',
};

const TIKTOK_EVENT_MAP: Record<UnifiedAttributionEvent['eventName'], string> = {
    SmartlinkView: 'ViewContent',
    DSPOutboundClick: 'ClickButton',
    PreSaveComplete: 'CompleteRegistration',
    WaitlistSignup: 'SubmitForm',
    MerchPurchase: 'CompletePayment',
};

interface TikTokApiEnvelope<T> {
    code?: number;
    message?: string;
    request_id?: string;
    data?: T;
}

interface TikTokCampaignCreateData {
    campaign_id?: string;
}

interface TikTokAdGroupCreateData {
    adgroup_id?: string;
}

interface TikTokAdCreateData {
    ad_ids?: string[];
}

interface TikTokReportMetrics {
    spend?: string;
    impressions?: string;
    clicks?: string;
    conversion?: string;
    onsite_shopping?: string;
    total_landing_page_view?: string;
}

interface TikTokReportRow {
    metrics?: TikTokReportMetrics;
}

interface TikTokReportData {
    list?: TikTokReportRow[];
}

export class TikTokAdAdapter extends BaseAdPlatformAdapter {
    readonly platform = 'TIKTOK' as const;
    private readonly config: TikTokAdapterConfig;
    private readonly baseUrl: string;

    constructor(config: TikTokAdapterConfig, fetcher: AdapterFetch = fetch) {
        super(fetcher);
        this.config = config;
        this.baseUrl = (config.apiBaseUrl ?? TIKTOK_API_BASE_V1_3).replace(/\/+$/, '');
    }

    private assertConfig(): void {
        if (
            !this.config.advertiserId?.trim() ||
            !this.config.accessToken?.trim() ||
            !this.config.pixelCode?.trim()
        ) {
            throw new AdPlatformAdapterError(
                this.platform,
                'MISSING_PLATFORM_CREDENTIALS',
                'TikTokAdAdapter requires advertiserId, accessToken, and pixelCode.',
            );
        }
    }

    private async requestTikTok<T>(
        endpoint: string,
        method: 'GET' | 'POST',
        payload: Record<string, unknown>,
    ): Promise<{ data: T; requestId?: string }> {
        const cleanEndpoint = endpoint.replace(/^\/+/, '');
        let url = `${this.baseUrl}/${cleanEndpoint}`;
        const init: RequestInit = {
            method,
            headers: {
                'Access-Token': this.config.accessToken,
                'Content-Type': 'application/json',
            },
        };

        if (method === 'GET') {
            const params = new URLSearchParams();
            for (const [k, v] of Object.entries(payload)) {
                if (v !== undefined && v !== null) {
                    params.set(k, typeof v === 'string' ? v : JSON.stringify(v));
                }
            }
            url = `${url}?${params.toString()}`;
        } else {
            init.body = JSON.stringify(payload);
        }

        const response = await this.fetcher(url, init);
        const envelope = (await response.json().catch(() => ({}))) as TikTokApiEnvelope<T>;

        if (!response.ok || (envelope.code !== undefined && envelope.code !== 0)) {
            throw new AdPlatformAdapterError(
                this.platform,
                'API_EXECUTION_FAILED',
                envelope.message ??
                    `TikTok API ${cleanEndpoint} failed with HTTP ${response.status} (code: ${envelope.code ?? 'unknown'}).`,
                {
                    status: response.status,
                    tiktokCode: envelope.code,
                    requestId: envelope.request_id,
                },
            );
        }

        return {
            data: (envelope.data ?? ({} as T)),
            requestId: envelope.request_id,
        };
    }

    async provisionCampaign(
        directive: UnifiedCampaignDirective,
        allocatedBudgetCents: number,
    ): Promise<PlatformCampaignReceipt> {
        this.assertConfig();
        const valid = this.validateProvisionRequest(directive, allocatedBudgetCents);

        const sparkCodes = valid.assets.tiktokSparkAuthCodes ?? [];
        const videoAssets = valid.assets.videoAssetIds;

        if (sparkCodes.length === 0 && videoAssets.length === 0) {
            throw new AdPlatformAdapterError(
                this.platform,
                'MISSING_PLATFORM_ASSETS',
                'TikTok campaign provisioning requires either tiktokSparkAuthCodes or videoAssetIds.',
            );
        }

        const totalBudgetDollars = Number((allocatedBudgetCents / 100).toFixed(2));
        const dailyBudgetCents = Math.min(allocatedBudgetCents, valid.budgetAllocation.dailyBudgetCents);
        const dailyBudgetDollars = Number((dailyBudgetCents / 100).toFixed(2));
        const campaignName = `indii_${valid.assets.isrc}_${valid.objective}_${valid.directiveId}`;

        // 1. Create TikTok Campaign
        const campaignRes = await this.requestTikTok<TikTokCampaignCreateData>(
            'campaign/create/',
            'POST',
            {
                advertiser_id: this.config.advertiserId,
                campaign_name: campaignName,
                objective_type: TIKTOK_OBJECTIVE_MAP[valid.objective],
                budget_mode: 'BUDGET_MODE_TOTAL',
                budget: totalBudgetDollars,
                operation_status: 'DISABLE',
            },
        );

        const externalCampaignId = campaignRes.data.campaign_id;
        if (!externalCampaignId) {
            throw new AdPlatformAdapterError(
                this.platform,
                'API_EXECUTION_FAILED',
                'TikTok campaign/create/ did not return a campaign_id.',
            );
        }

        // 2. Create TikTok AdGroup with targeting & pixel optimization
        const adGroupRes = await this.requestTikTok<TikTokAdGroupCreateData>(
            'adgroup/create/',
            'POST',
            {
                advertiser_id: this.config.advertiserId,
                campaign_id: externalCampaignId,
                adgroup_name: `${campaignName}_adgroup`,
                placement_type: 'PLACEMENT_TYPE_NORMAL',
                placements: ['PLACEMENT_TIKTOK'],
                promotion_type: 'WEBSITE',
                pixel_id: this.config.pixelCode,
                optimization_goal:
                    valid.objective === 'DSP_STREAM_CONVERSION' ? 'CLICK' : 'CONVERT',
                billing_event: 'OCPM',
                budget_mode: 'BUDGET_MODE_DAY',
                budget: dailyBudgetDollars,
                schedule_type: valid.schedule.endTimeIso
                    ? 'SCHEDULE_START_END'
                    : 'SCHEDULE_FROM_NOW',
                schedule_start_time: valid.schedule.startTimeIso,
                ...(valid.schedule.endTimeIso
                    ? { schedule_end_time: valid.schedule.endTimeIso }
                    : {}),
                location_ids: valid.targeting.geoLocations,
                ...(valid.targeting.customAudienceIds?.TIKTOK?.length
                    ? { audience_ids: valid.targeting.customAudienceIds.TIKTOK }
                    : {}),
                operation_status: 'DISABLE',
            },
        );

        const externalAdGroupId = adGroupRes.data.adgroup_id;
        if (!externalAdGroupId) {
            throw new AdPlatformAdapterError(
                this.platform,
                'API_EXECUTION_FAILED',
                'TikTok adgroup/create/ did not return an adgroup_id.',
            );
        }

        // 3. Provision Spark Ads or standard Video Ads
        const trackedUrl = this.buildTrackedSmartlinkUrl(valid);
        const creatives: Array<Record<string, unknown>> = [];

        if (sparkCodes.length > 0) {
            for (const authCode of sparkCodes) {
                creatives.push({
                    ad_name: `${campaignName}_spark_${authCode.slice(0, 8)}`,
                    ad_format: 'SINGLE_VIDEO',
                    identity_type: 'AUTH_CODE',
                    identity_authorized_bc_id: authCode,
                    tiktok_item_id: authCode,
                    landing_page_url: trackedUrl,
                    call_to_action:
                        valid.objective === 'MERCH_CONVERSION' ? 'SHOP_NOW' : 'LISTEN_NOW',
                    operation_status: 'DISABLE',
                });
            }
        } else {
            for (const videoId of videoAssets) {
                creatives.push({
                    ad_name: `${campaignName}_video_${videoId}`,
                    ad_format: 'SINGLE_VIDEO',
                    identity_type: 'CUSTOMIZED_USER',
                    identity_id: this.config.customIdentityId ?? `indii_artist_${valid.artistId}`,
                    video_id: videoId,
                    ad_text: `Stream now (${valid.assets.isrc})`,
                    landing_page_url: trackedUrl,
                    call_to_action:
                        valid.objective === 'MERCH_CONVERSION' ? 'SHOP_NOW' : 'LISTEN_NOW',
                    operation_status: 'DISABLE',
                });
            }
        }

        const adRes = await this.requestTikTok<TikTokAdCreateData>(
            'ad/create/',
            'POST',
            {
                advertiser_id: this.config.advertiserId,
                adgroup_id: externalAdGroupId,
                creatives,
            },
        );

        const externalAdIds = adRes.data.ad_ids ?? [];
        if (externalAdIds.length === 0) {
            throw new AdPlatformAdapterError(
                this.platform,
                'API_EXECUTION_FAILED',
                'TikTok ad/create/ returned no ad_ids.',
            );
        }

        return this.validateReceipt({
            platform: this.platform,
            externalCampaignId,
            externalAdSetOrGroupId: externalAdGroupId,
            externalAdIds,
            status: 'PAUSED',
            committedBudgetCents: allocatedBudgetCents,
            timestampIso: new Date().toISOString(),
            rawResponseMetadata: {
                advertiserId: this.config.advertiserId,
                sparkAdsMode: sparkCodes.length > 0,
                dailyBudgetCents,
                trackedSmartlinkUrl: trackedUrl,
                requestId: adRes.requestId,
            },
        });
    }

    async updateBudget(externalCampaignId: string, dailyBudgetCents: number): Promise<void> {
        this.assertConfig();
        if (!externalCampaignId.trim()) {
            throw new AdPlatformAdapterError(
                this.platform,
                'INVALID_DIRECTIVE_PAYLOAD',
                'externalCampaignId is required to update TikTok campaign budget.',
            );
        }
        if (!Number.isInteger(dailyBudgetCents) || dailyBudgetCents < this.minBudgetCents) {
            throw new AdPlatformAdapterError(
                this.platform,
                'BUDGET_BELOW_MINIMUM',
                `TikTok budget (${dailyBudgetCents} cents) must be an integer >= ${this.minBudgetCents} cents.`,
            );
        }

        await this.requestTikTok('campaign/update/', 'POST', {
            advertiser_id: this.config.advertiserId,
            campaign_id: externalCampaignId,
            budget: Number((dailyBudgetCents / 100).toFixed(2)),
        });
    }

    async updateStatus(externalCampaignId: string, status: 'ACTIVE' | 'PAUSED'): Promise<void> {
        this.assertConfig();
        if (!externalCampaignId.trim()) {
            throw new AdPlatformAdapterError(
                this.platform,
                'INVALID_DIRECTIVE_PAYLOAD',
                'externalCampaignId is required to update TikTok campaign status.',
            );
        }

        await this.requestTikTok('campaign/status/update/', 'POST', {
            advertiser_id: this.config.advertiserId,
            campaign_ids: [externalCampaignId],
            operation_status: status === 'ACTIVE' ? 'ENABLE' : 'DISABLE',
        });
    }

    async fetchTelemetry(
        externalCampaignId: string,
        dateRange: { start: string; end: string },
    ): Promise<PlatformTelemetrySnapshot> {
        this.assertConfig();

        const reportRes = await this.requestTikTok<TikTokReportData>(
            'report/integrated/get/',
            'GET',
            {
                advertiser_id: this.config.advertiserId,
                report_type: 'BASIC',
                data_level: 'AUCTION_CAMPAIGN',
                dimensions: ['campaign_id'],
                metrics: [
                    'spend',
                    'impressions',
                    'clicks',
                    'conversion',
                    'total_landing_page_view',
                ],
                start_date: dateRange.start,
                end_date: dateRange.end,
                filtering: [
                    {
                        field_name: 'campaign_ids',
                        filter_type: 'IN',
                        filter_value: [externalCampaignId],
                    },
                ],
            },
        );

        const metrics = reportRes.data.list?.[0]?.metrics ?? {};
        const spendDollars = Number.parseFloat(metrics.spend ?? '0');
        const spendCents = Number.isFinite(spendDollars) ? Math.round(spendDollars * 100) : 0;
        const impressions = Number.parseInt(metrics.impressions ?? '0', 10) || 0;
        const clicks = Number.parseInt(metrics.clicks ?? '0', 10) || 0;
        const outboundDspClicks =
            Number.parseInt(metrics.total_landing_page_view ?? metrics.clicks ?? '0', 10) || 0;
        const conversions = Number.parseInt(metrics.conversion ?? '0', 10) || 0;

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
    ): Promise<{ success: boolean; externalTraceId?: string; errorMessage?: string }> {
        this.assertConfig();
        const valid = this.validateAttributionEvent(event);

        const { ttclid, ttp } = valid.clickIdentifiers;
        const { emailSha256, phoneSha256, externalFanId, clientIpAddress, clientUserAgent } =
            valid.userData;

        const hasTikTokSignal = Boolean(
            ttclid || ttp || emailSha256 || phoneSha256 || externalFanId,
        );
        if (!hasTikTokSignal) {
            return { success: false };
        }

        const userObject: Record<string, unknown> = {
            ip: clientIpAddress,
            user_agent: clientUserAgent,
            ...(ttclid ? { ttclid } : {}),
            ...(ttp ? { ttp } : {}),
            ...(emailSha256 ? { email: emailSha256.toLowerCase() } : {}),
            ...(phoneSha256 ? { phone: phoneSha256.toLowerCase() } : {}),
            ...(externalFanId ? { external_id: this.sha256Hex(externalFanId) } : {}),
        };

        const propertiesObject: Record<string, unknown> = {
            content_id: valid.isrc,
            content_type: 'product',
            content_name: valid.releaseId,
            smartlink_id: valid.smartlinkId,
            ...(valid.targetDsp ? { target_dsp: valid.targetDsp } : {}),
            ...(valid.valueMetadata
                ? {
                    currency: valid.valueMetadata.currency,
                    value: Number((valid.valueMetadata.valueCents / 100).toFixed(2)),
                }
                : {}),
        };

        try {
            const res = await this.requestTikTok<Record<string, unknown>>(
                'event/track/',
                'POST',
                {
                    event_source: 'web',
                    event_source_id: this.config.pixelCode,
                    data: [
                        {
                            event: TIKTOK_EVENT_MAP[valid.eventName],
                            event_time: valid.eventTimestampUnix,
                            event_id: valid.eventId,
                            user: userObject,
                            properties: propertiesObject,
                        },
                    ],
                },
            );

            return {
                success: true,
                externalTraceId: res.requestId,
            };
        } catch (error) {
            return {
                success: false,
                errorMessage: error instanceof AdPlatformAdapterError
                    ? `TikTok Events API failed (${error.code}, HTTP ${error.details?.status ?? 'unknown'}).`
                    : 'TikTok Events API request failed.',
            };
        }
    }
}
