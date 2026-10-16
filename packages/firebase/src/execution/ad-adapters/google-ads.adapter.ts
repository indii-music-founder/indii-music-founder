/**
 * GoogleAdsAdapter — Layer 3 (Execution)
 *
 * Implements `IAdPlatformAdapter` for Google Ads REST API (v17+) Video Action
 * & Performance Max (PMax) campaigns, GAQL telemetry queries, and Google Ads
 * Enhanced Conversions (`uploadClickConversions`).
 *
 * Strictly uses post-mastering YouTube asset IDs (`youtubeVideoIds`) and
 * verified release artwork (`imageAssetIds`).
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

export const GOOGLE_ADS_API_BASE_V17 = 'https://googleads.googleapis.com/v17';

export interface GoogleAdsAdapterConfig {
    customerId: string;
    developerToken: string;
    accessToken: string;
    loginCustomerId?: string;
    /** Conversion action ID or resource name for Enhanced Conversions upload. */
    conversionActionId: string;
    apiBaseUrl?: string;
}

const GOOGLE_ADS_CHANNEL_MAP: Record<
    CampaignObjective,
    { advertisingChannelType: 'VIDEO' | 'PERFORMANCE_MAX'; biddingStrategyType: string }
> = {
    DSP_STREAM_CONVERSION: {
        advertisingChannelType: 'VIDEO',
        biddingStrategyType: 'MAXIMIZE_CONVERSIONS',
    },
    PRE_SAVE_INTAKE: {
        advertisingChannelType: 'VIDEO',
        biddingStrategyType: 'MAXIMIZE_CONVERSIONS',
    },
    WAITLIST_INTAKE: {
        advertisingChannelType: 'PERFORMANCE_MAX',
        biddingStrategyType: 'MAXIMIZE_CONVERSIONS',
    },
    MERCH_CONVERSION: {
        advertisingChannelType: 'PERFORMANCE_MAX',
        biddingStrategyType: 'MAXIMIZE_CONVERSION_VALUE',
    },
    EVENT_TICKETING: {
        advertisingChannelType: 'PERFORMANCE_MAX',
        biddingStrategyType: 'MAXIMIZE_CONVERSION_VALUE',
    },
};

interface GoogleAdsMutateResultItem {
    resourceName?: string;
}

interface GoogleAdsMutateResponse {
    results?: GoogleAdsMutateResultItem[];
    partialFailureError?: { message?: string; code?: number };
    error?: { message?: string; code?: number; status?: string };
}

interface GoogleAdsSearchRow {
    campaign?: { resourceName?: string; id?: string };
    campaignBudget?: { resourceName?: string };
    metrics?: {
        costMicros?: string | number;
        impressions?: string | number;
        clicks?: string | number;
        conversions?: string | number;
         engagements?: string | number;
    };
}

interface GoogleAdsSearchResponse {
    results?: GoogleAdsSearchRow[];
    error?: { message?: string; code?: number };
}

interface GoogleClickConversionUploadResponse {
    results?: Array<{ gclid?: string; conversionAction?: string; conversionDateTime?: string }>;
    partialFailureError?: { message?: string };
    error?: { message?: string };
}

export class GoogleAdsAdapter extends BaseAdPlatformAdapter {
    readonly platform = 'GOOGLE_ADS' as const;
    private readonly config: GoogleAdsAdapterConfig;
    private readonly baseUrl: string;

    constructor(config: GoogleAdsAdapterConfig, fetcher: AdapterFetch = fetch) {
        super(fetcher);
        this.config = config;
        this.baseUrl = (config.apiBaseUrl ?? GOOGLE_ADS_API_BASE_V17).replace(/\/+$/, '');
    }

    private assertConfig(): void {
        if (
            !this.config.customerId?.trim() ||
            !this.config.developerToken?.trim() ||
            !this.config.accessToken?.trim() ||
            !this.config.conversionActionId?.trim()
        ) {
            throw new AdPlatformAdapterError(
                this.platform,
                'MISSING_PLATFORM_CREDENTIALS',
                'GoogleAdsAdapter requires customerId, developerToken, accessToken, and conversionActionId.',
            );
        }
    }

    private get normalizedCustomerId(): string {
        return this.config.customerId.replace(/-/g, '').trim();
    }

    private get conversionActionResourceName(): string {
        if (this.config.conversionActionId.startsWith('customers/')) {
            return this.config.conversionActionId;
        }
        return `customers/${this.normalizedCustomerId}/conversionActions/${this.config.conversionActionId}`;
    }

    private buildHeaders(): Record<string, string> {
        const headers: Record<string, string> = {
            Authorization: `Bearer ${this.config.accessToken}`,
            'developer-token': this.config.developerToken,
            'Content-Type': 'application/json',
        };
        if (this.config.loginCustomerId?.trim()) {
            headers['login-customer-id'] = this.config.loginCustomerId.replace(/-/g, '').trim();
        }
        return headers;
    }

    private async requestGoogleAds<T extends { error?: { message?: string } }>(
        resourcePath: string,
        payload: Record<string, unknown>,
    ): Promise<T> {
        const cleanPath = resourcePath.replace(/^\/+/, '');
        const response = await this.fetcher(`${this.baseUrl}/${cleanPath}`, {
            method: 'POST',
            headers: this.buildHeaders(),
            body: JSON.stringify(payload),
        });

        const data = (await response.json().catch(() => ({}))) as T;
        if (!response.ok || data.error) {
            throw new AdPlatformAdapterError(
                this.platform,
                'API_EXECUTION_FAILED',
                data.error?.message ??
                    `Google Ads API ${cleanPath} failed with HTTP ${response.status}.`,
                { status: response.status },
            );
        }

        return data;
    }

    /**
     * Converts minor currency units (cents) into Google Ads micros (1 cent = 10,000 micros).
     */
    private centsToMicros(cents: number): string {
        return String(Math.round(cents) * 10_000);
    }

    /**
     * Converts Google Ads micros into integer cents (`10,000 micros = 1 cent`).
     */
    private microsToCents(micros: string | number | undefined): number {
        const numeric = typeof micros === 'number' ? micros : Number.parseFloat(micros ?? '0');
        if (!Number.isFinite(numeric) || numeric <= 0) return 0;
        return Math.round(numeric / 10_000);
    }

    /**
     * Formats a UNIX timestamp in seconds to Google Ads conversion datetime format
     * (`yyyy-mm-dd hh:mm:ss+|-hh:mm`).
     */
    private formatGoogleConversionDateTime(timestampUnix: number): string {
        const iso = new Date(timestampUnix * 1000).toISOString();
        // YYYY-MM-DDTHH:mm:ss.sssZ -> YYYY-MM-DD HH:mm:ss+00:00
        return `${iso.slice(0, 10)} ${iso.slice(11, 19)}+00:00`;
    }

    async provisionCampaign(
        directive: UnifiedCampaignDirective,
        allocatedBudgetCents: number,
    ): Promise<PlatformCampaignReceipt> {
        this.assertConfig();
        const valid = this.validateProvisionRequest(directive, allocatedBudgetCents);

        const youtubeIds = valid.assets.youtubeVideoIds ?? [];
        const videoAssets = valid.assets.videoAssetIds;

        if (youtubeIds.length === 0 && videoAssets.length === 0) {
            throw new AdPlatformAdapterError(
                this.platform,
                'MISSING_PLATFORM_ASSETS',
                'Google Ads Video Action / PMax provisioning requires youtubeVideoIds or videoAssetIds.',
            );
        }

        const customerId = this.normalizedCustomerId;
        const dailyBudgetCents = Math.min(
            allocatedBudgetCents,
            valid.budgetAllocation.dailyBudgetCents,
        );
        const campaignName = `indii_${valid.assets.isrc}_${valid.objective}_${valid.directiveId}`;
        const channelSpec = GOOGLE_ADS_CHANNEL_MAP[valid.objective];

        // 1. Provision CampaignBudget
        const budgetMutate = await this.requestGoogleAds<GoogleAdsMutateResponse>(
            `customers/${customerId}/campaignBudgets:mutate`,
            {
                operations: [
                    {
                        create: {
                            name: `${campaignName}_budget`,
                            amountMicros: this.centsToMicros(dailyBudgetCents),
                            deliveryMethod: 'STANDARD',
                            explicitlyShared: false,
                        },
                    },
                ],
            },
        );

        const budgetResourceName = budgetMutate.results?.[0]?.resourceName;
        if (!budgetResourceName) {
            throw new AdPlatformAdapterError(
                this.platform,
                'API_EXECUTION_FAILED',
                'Google Ads campaignBudgets:mutate did not return a resourceName.',
            );
        }

        // 2. Provision Campaign (Video Action or Performance Max)
        const campaignMutate = await this.requestGoogleAds<GoogleAdsMutateResponse>(
            `customers/${customerId}/campaigns:mutate`,
            {
                operations: [
                    {
                        create: {
                            name: campaignName,
                            status: 'PAUSED',
                            campaignBudget: budgetResourceName,
                            advertisingChannelType: channelSpec.advertisingChannelType,
                            biddingStrategyType: channelSpec.biddingStrategyType,
                            startDate: valid.schedule.startTimeIso.slice(0, 10).replace(/-/g, ''),
                            ...(valid.schedule.endTimeIso
                                ? {
                                    endDate: valid.schedule.endTimeIso
                                        .slice(0, 10)
                                        .replace(/-/g, ''),
                                }
                                : {}),
                        },
                    },
                ],
            },
        );

        const campaignResourceName = campaignMutate.results?.[0]?.resourceName;
        if (!campaignResourceName) {
            throw new AdPlatformAdapterError(
                this.platform,
                'API_EXECUTION_FAILED',
                'Google Ads campaigns:mutate did not return a resourceName.',
            );
        }

        // 3. Provision AdGroup
        const adGroupMutate = await this.requestGoogleAds<GoogleAdsMutateResponse>(
            `customers/${customerId}/adGroups:mutate`,
            {
                operations: [
                    {
                        create: {
                            name: `${campaignName}_adgroup`,
                            campaign: campaignResourceName,
                            status: 'PAUSED',
                            type: 'VIDEO_TRUE_VIEW_IN_STREAM',
                        },
                    },
                ],
            },
        );

        const adGroupResourceName = adGroupMutate.results?.[0]?.resourceName;
        if (!adGroupResourceName) {
            throw new AdPlatformAdapterError(
                this.platform,
                'API_EXECUTION_FAILED',
                'Google Ads adGroups:mutate did not return a resourceName.',
            );
        }

        // 4. Provision Video Responsive Ads bound to YouTube video IDs & tracked Smartlink
        const trackedUrl = this.buildTrackedSmartlinkUrl(valid);
        const videoSources = youtubeIds.length > 0 ? youtubeIds : videoAssets;

        const adOperations = videoSources.map((ytVideoId, idx) => ({
            create: {
                adGroup: adGroupResourceName,
                status: 'PAUSED',
                ad: {
                    name: `${campaignName}_ad_${idx + 1}`,
                    finalUrls: [trackedUrl],
                    videoResponsiveAd: {
                        videos: [{ asset: `customers/${customerId}/assets/${ytVideoId}` }],
                        headlines: [{ text: `Listen Now (${valid.assets.isrc})` }],
                        longHeadlines: [
                            { text: `Official Release (${valid.assets.isrc}) — Stream Now` },
                        ],
                        descriptions: [{ text: `Official Smartlink for ${valid.assets.releaseId}` }],
                        callToActions: [
                            {
                                text:
                                    valid.objective === 'MERCH_CONVERSION'
                                        ? 'Shop Now'
                                        : 'Listen Now',
                            },
                        ],
                    },
                },
            },
        }));

        const adGroupAdsMutate = await this.requestGoogleAds<GoogleAdsMutateResponse>(
            `customers/${customerId}/adGroupAds:mutate`,
            { operations: adOperations },
        );

        const externalAdIds = (adGroupAdsMutate.results ?? [])
            .map(r => r.resourceName)
            .filter((name): name is string => Boolean(name));

        if (externalAdIds.length === 0) {
            throw new AdPlatformAdapterError(
                this.platform,
                'API_EXECUTION_FAILED',
                'Google Ads adGroupAds:mutate returned no ad resource names.',
            );
        }

        return this.validateReceipt({
            platform: this.platform,
            externalCampaignId: campaignResourceName,
            externalAdSetOrGroupId: adGroupResourceName,
            externalAdIds,
            status: 'PAUSED',
            committedBudgetCents: allocatedBudgetCents,
            timestampIso: new Date().toISOString(),
            rawResponseMetadata: {
                customerId,
                budgetResourceName,
                advertisingChannelType: channelSpec.advertisingChannelType,
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
                'externalCampaignId is required to update Google Ads budget.',
            );
        }
        if (!Number.isInteger(dailyBudgetCents) || dailyBudgetCents < this.minBudgetCents) {
            throw new AdPlatformAdapterError(
                this.platform,
                'BUDGET_BELOW_MINIMUM',
                `Google Ads daily budget (${dailyBudgetCents} cents) must be >= ${this.minBudgetCents} cents.`,
            );
        }

        const customerId = this.normalizedCustomerId;
        const budgetResourceName = externalCampaignId.includes('/campaignBudgets/')
            ? externalCampaignId
            : `customers/${customerId}/campaignBudgets/${externalCampaignId.split('/').pop()}`;

        await this.requestGoogleAds<GoogleAdsMutateResponse>(
            `customers/${customerId}/campaignBudgets:mutate`,
            {
                operations: [
                    {
                        updateMask: 'amount_micros',
                        update: {
                            resourceName: budgetResourceName,
                            amountMicros: this.centsToMicros(dailyBudgetCents),
                        },
                    },
                ],
            },
        );
    }

    async updateStatus(externalCampaignId: string, status: 'ACTIVE' | 'PAUSED'): Promise<void> {
        this.assertConfig();
        if (!externalCampaignId.trim()) {
            throw new AdPlatformAdapterError(
                this.platform,
                'INVALID_DIRECTIVE_PAYLOAD',
                'externalCampaignId is required to update Google Ads status.',
            );
        }

        const customerId = this.normalizedCustomerId;
        const campaignResourceName = externalCampaignId.startsWith('customers/')
            ? externalCampaignId
            : `customers/${customerId}/campaigns/${externalCampaignId}`;

        await this.requestGoogleAds<GoogleAdsMutateResponse>(
            `customers/${customerId}/campaigns:mutate`,
            {
                operations: [
                    {
                        updateMask: 'status',
                        update: {
                            resourceName: campaignResourceName,
                            status: status === 'ACTIVE' ? 'ENABLED' : 'PAUSED',
                        },
                    },
                ],
            },
        );
    }

    async fetchTelemetry(
        externalCampaignId: string,
        dateRange: { start: string; end: string },
    ): Promise<PlatformTelemetrySnapshot> {
        this.assertConfig();
        const customerId = this.normalizedCustomerId;
        const campaignIdFragment = externalCampaignId.split('/').pop() ?? externalCampaignId;

        const gaqlQuery = [
            'SELECT campaign.id, campaign.resource_name,',
            'metrics.cost_micros, metrics.impressions, metrics.clicks, metrics.conversions',
            'FROM campaign',
            `WHERE campaign.id = '${campaignIdFragment.replace(/[^a-zA-Z0-9_-]/g, '')}'`,
            `AND segments.date BETWEEN '${dateRange.start}' AND '${dateRange.end}'`,
        ].join(' ');

        const searchRes = await this.requestGoogleAds<GoogleAdsSearchResponse>(
            `customers/${customerId}/googleAds:search`,
            { query: gaqlQuery },
        );

        let spendCents = 0;
        let impressions = 0;
        let clicks = 0;
        let conversions = 0;

        for (const row of searchRes.results ?? []) {
            spendCents += this.microsToCents(row.metrics?.costMicros);
            impressions += Number.parseInt(String(row.metrics?.impressions ?? '0'), 10) || 0;
            clicks += Number.parseInt(String(row.metrics?.clicks ?? '0'), 10) || 0;
            conversions += Math.round(Number.parseFloat(String(row.metrics?.conversions ?? '0')) || 0);
        }

        const outboundDspClicks = clicks;

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

        const { gclid, gbraid, wbraid } = valid.clickIdentifiers;
        const { emailSha256, phoneSha256 } = valid.userData;

        const hasGoogleSignal = Boolean(
            gclid || gbraid || wbraid || emailSha256 || phoneSha256,
        );
        if (!hasGoogleSignal) {
            return { success: false };
        }

        const customerId = this.normalizedCustomerId;
        const userIdentifiers: Array<Record<string, string>> = [];

        if (emailSha256) {
            userIdentifiers.push({
                userIdentifierSource: 'FIRST_PARTY',
                hashedEmail: emailSha256.toLowerCase(),
            });
        }
        if (phoneSha256) {
            userIdentifiers.push({
                userIdentifierSource: 'FIRST_PARTY',
                hashedPhoneNumber: phoneSha256.toLowerCase(),
            });
        }

        const clickConversion: Record<string, unknown> = {
            conversionAction: this.conversionActionResourceName,
            conversionDateTime: this.formatGoogleConversionDateTime(valid.eventTimestampUnix),
            orderId: valid.eventId,
            ...(gclid ? { gclid } : {}),
            ...(gbraid ? { gbraid } : {}),
            ...(wbraid ? { wbraid } : {}),
            ...(userIdentifiers.length > 0 ? { userIdentifiers } : {}),
            ...(valid.valueMetadata
                ? {
                    conversionValue: Number((valid.valueMetadata.valueCents / 100).toFixed(2)),
                    currencyCode: valid.valueMetadata.currency,
                }
                : {
                    conversionValue: 1.0,
                    currencyCode: 'USD',
                }),
        };

        try {
            const uploadRes = await this.requestGoogleAds<GoogleClickConversionUploadResponse>(
                `customers/${customerId}:uploadClickConversions`,
                {
                    conversions: [clickConversion],
                    partialFailure: true,
                },
            );

            if (uploadRes.partialFailureError) {
                return { success: false };
            }

            return {
                success: true,
                externalTraceId:
                    uploadRes.results?.[0]?.conversionDateTime ?? valid.eventId,
            };
        } catch {
            return { success: false };
        }
    }
}
