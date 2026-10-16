/**
 * Unit tests for Multi-Platform Programmatic Ad Adapters, Unified Server-Side
 * Attribution Engine (`AttributionBus`), and Cross-Department Campaign
 * Orchestrator (`CampaignOrchestrator`).
 */

import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import {
    type UnifiedAttributionEvent,
    type UnifiedCampaignDirective,
    UnifiedAttributionEventSchema,
    UnifiedCampaignDirectiveSchema,
} from '../../types/ad-execution.types';
import { type AdapterFetch } from '../ad-adapters/base.adapter';
import { GoogleAdsAdapter } from '../ad-adapters/google-ads.adapter';
import { MetaAdAdapter } from '../ad-adapters/meta.adapter';
import { TikTokAdAdapter } from '../ad-adapters/tiktok.adapter';
import {
    AttributionBus,
    InMemoryAttributionDeduplicationStore,
} from '../attribution/attribution-bus';
import {
    CampaignOrchestrator,
    InMemoryFinanceRecoupmentLedger,
} from '../../orchestration/marketing/campaign-orchestrator';

function sha256(value: string): string {
    return createHash('sha256').update(value.trim().toLowerCase()).digest('hex');
}

function buildMockDirective(
    overrides: Partial<UnifiedCampaignDirective> = {},
): UnifiedCampaignDirective {
    return {
        directiveId: 'dir_2026_vel_001',
        triggeredBy: 'GROWTH_INTELLIGENCE_ENGINE',
        artistId: 'artist_detroit_01',
        ledgerAccountId: 'ledger_recoup_01',
        objective: 'DSP_STREAM_CONVERSION',
        platforms: ['META', 'TIKTOK', 'GOOGLE_ADS'],
        budgetAllocation: {
            currency: 'USD',
            totalBudgetCents: 100_000, // $1,000.00
            dailyBudgetCents: 20_000,  // $200.00
            platformSplitPercentages: {
                META: 50,
                TIKTOK: 30,
                GOOGLE_ADS: 20,
            },
        },
        schedule: {
            startTimeIso: '2026-10-16T00:00:00.000Z',
            endTimeIso: '2026-10-23T00:00:00.000Z',
        },
        assets: {
            releaseId: 'rel_midnight_express',
            isrc: 'US-S1Z-26-00412',
            upc: '196589412301',
            smartlinkId: 'sl_midnight_01',
            smartlinkUrl: 'https://indii.link/midnight-express',
            videoAssetIds: ['vid_teaser_9x16_01'],
            imageAssetIds: ['img_cover_3000_01'],
            tiktokSparkAuthCodes: ['spark_auth_code_99887766'],
            youtubeVideoIds: ['yt_asset_778899'],
        },
        targeting: {
            geoLocations: ['US', 'GB', 'DE'],
            ageMin: 18,
            ageMax: 34,
            genreTaxonomyTags: ['electronic', 'detroit-techno'],
            similarArtistEntityIds: ['ent_carl_craig', 'ent_moodymann'],
            customAudienceIds: {
                META: ['meta_aud_111'],
                TIKTOK: ['tt_aud_222'],
            },
        },
        ...overrides,
    };
}

function jsonResponse(body: unknown, status = 200): Response {
    return {
        ok: status >= 200 && status < 300,
        status,
        json: async () => body,
        text: async () => JSON.stringify(body),
    } as unknown as Response;
}

describe('Multi-Platform Ad Execution & Attribution Contracts', () => {
    it('validates a well-formed post-mastering UnifiedCampaignDirective and rejects malformed ISRCs', () => {
        const valid = buildMockDirective();
        expect(() => UnifiedCampaignDirectiveSchema.parse(valid)).not.toThrow();

        const invalidIsrc = buildMockDirective({
            assets: {
                ...valid.assets,
                isrc: 'NOT_AN_ISRC',
            },
        });
        const parsed = UnifiedCampaignDirectiveSchema.safeParse(invalidIsrc);
        expect(parsed.success).toBe(false);
    });

    it('validates UnifiedAttributionEvent SHA-256 pre-hashed userData at the schema boundary', () => {
        const validEvent: UnifiedAttributionEvent = {
            eventId: 'evt_dedup_1001',
            eventTimestampUnix: 1792108800,
            eventName: 'PreSaveComplete',
            releaseId: 'rel_midnight_express',
            isrc: 'USS1Z2600412',
            smartlinkId: 'sl_midnight_01',
            targetDsp: 'SPOTIFY',
            clickIdentifiers: {
                fbclid: 'IwAR123456',
                ttclid: 'E.C.P.7890',
                gclid: 'Cj0KCQjw999',
            },
            userData: {
                clientIpAddress: '203.0.113.42',
                clientUserAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)',
                emailSha256: sha256('fan@example.com'),
            },
            valueMetadata: {
                currency: 'USD',
                valueCents: 150,
            },
        };

        expect(() => UnifiedAttributionEventSchema.parse(validEvent)).not.toThrow();

        const unhashedEvent: UnifiedAttributionEvent = {
            ...validEvent,
            userData: {
                ...validEvent.userData,
                emailSha256: 'raw-unhashed-email@example.com',
            },
        };
        expect(UnifiedAttributionEventSchema.safeParse(unhashedEvent).success).toBe(false);
    });
});

describe('MetaAdAdapter (Graph API & CAPI)', () => {
    it('provisions campaign, adset, creative, and ad, and normalizes insights telemetry', async () => {
        const calls: Array<{ url: string; body?: string }> = [];
        const mockFetcher: AdapterFetch = vi.fn(async (url, init) => {
            calls.push({ url, body: typeof init.body === 'string' ? init.body : undefined });
            if (url.endsWith('/campaigns')) return jsonResponse({ id: 'meta_camp_101' });
            if (url.endsWith('/adsets')) return jsonResponse({ id: 'meta_adset_202' });
            if (url.endsWith('/adcreatives')) return jsonResponse({ id: 'meta_cre_303' });
            if (url.endsWith('/ads')) return jsonResponse({ id: 'meta_ad_404' });
            if (url.includes('/insights')) {
                return jsonResponse({
                    data: [
                        {
                            spend: '45.50',
                            impressions: '12000',
                            clicks: '420',
                            actions: [
                                { action_type: 'offsite_conversion.fb_pixel_view_content', value: '350' },
                                { action_type: 'offsite_conversion.fb_pixel_lead', value: '70' },
                            ],
                        },
                    ],
                });
            }
            if (url.endsWith('/events')) {
                return jsonResponse({ events_received: 1, fbtrace_id: 'fbtrace_abc_999' });
            }
            return jsonResponse({ success: true });
        });

        const adapter = new MetaAdAdapter(
            {
                adAccountId: 'act_889900',
                accessToken: 'MOCK_KEY_DO_NOT_USE_META_TOKEN',
                facebookPageId: 'page_112233',
                pixelId: 'pixel_445566',
            },
            mockFetcher,
        );

        const directive = buildMockDirective();
        const receipt = await adapter.provisionCampaign(directive, 50_000);

        expect(receipt.platform).toBe('META');
        expect(receipt.externalCampaignId).toBe('meta_camp_101');
        expect(receipt.externalAdSetOrGroupId).toBe('meta_adset_202');
        expect(receipt.externalAdIds).toEqual(['meta_ad_404']);
        expect(receipt.committedBudgetCents).toBe(50_000);

        const telemetry = await adapter.fetchTelemetry('meta_camp_101', {
            start: '2026-10-16',
            end: '2026-10-20',
        });
        expect(telemetry.spendCents).toBe(4550);
        expect(telemetry.outboundDspClicks).toBe(350);
        expect(telemetry.conversions).toBe(70);
        expect(telemetry.costPerOutboundClickCents).toBe(13); // 4550 / 350
        expect(telemetry.costPerConversionCents).toBe(65);    // 4550 / 70
    });
});

describe('TikTokAdAdapter (Marketing API v1.3, Spark Ads & Events API)', () => {
    it('provisions Spark Ads using tiktokSparkAuthCodes and dispatches TikTok Events API conversions', async () => {
        const requests: Array<{ url: string; payload: Record<string, unknown> }> = [];
        const mockFetcher: AdapterFetch = vi.fn(async (url, init) => {
            const payload =
                typeof init.body === 'string'
                    ? (JSON.parse(init.body) as Record<string, unknown>)
                    : {};
            requests.push({ url, payload });

            if (url.endsWith('/campaign/create/')) {
                return jsonResponse({
                    code: 0,
                    request_id: 'tt_req_camp',
                    data: { campaign_id: 'tt_camp_901' },
                });
            }
            if (url.endsWith('/adgroup/create/')) {
                return jsonResponse({
                    code: 0,
                    request_id: 'tt_req_adgrp',
                    data: { adgroup_id: 'tt_adgrp_902' },
                });
            }
            if (url.endsWith('/ad/create/')) {
                return jsonResponse({
                    code: 0,
                    request_id: 'tt_req_ad',
                    data: { ad_ids: ['tt_spark_ad_903'] },
                });
            }
            if (url.endsWith('/event/track/')) {
                return jsonResponse({
                    code: 0,
                    request_id: 'tt_trace_event_777',
                    data: {},
                });
            }
            return jsonResponse({ code: 0, data: {} });
        });

        const adapter = new TikTokAdAdapter(
            {
                advertiserId: 'adv_tiktok_555',
                accessToken: 'MOCK_KEY_DO_NOT_USE_TIKTOK_TOKEN',
                pixelCode: 'tt_pixel_123',
            },
            mockFetcher,
        );

        const directive = buildMockDirective();
        const receipt = await adapter.provisionCampaign(directive, 30_000);

        expect(receipt.platform).toBe('TIKTOK');
        expect(receipt.externalCampaignId).toBe('tt_camp_901');
        expect(receipt.externalAdSetOrGroupId).toBe('tt_adgrp_902');
        expect(receipt.externalAdIds).toEqual(['tt_spark_ad_903']);
        expect(receipt.rawResponseMetadata?.sparkAdsMode).toBe(true);

        const adCreateCall = requests.find(r => r.url.endsWith('/ad/create/'));
        const creatives = adCreateCall?.payload.creatives as Array<Record<string, unknown>>;
        expect(creatives[0]?.identity_type).toBe('AUTH_CODE');
        expect(creatives[0]?.tiktok_item_id).toBe('spark_auth_code_99887766');
    });
});

describe('GoogleAdsAdapter (REST v17 Video Action / PMax & Enhanced Conversions)', () => {
    it('provisions CampaignBudget, Campaign, AdGroup, and VideoResponsiveAd bound to youtubeVideoIds', async () => {
        const mockFetcher: AdapterFetch = vi.fn(async (url) => {
            if (url.includes('campaignBudgets:mutate')) {
                return jsonResponse({
                    results: [{ resourceName: 'customers/1234567890/campaignBudgets/9901' }],
                });
            }
            if (url.includes('campaigns:mutate')) {
                return jsonResponse({
                    results: [{ resourceName: 'customers/1234567890/campaigns/9902' }],
                });
            }
            if (url.includes('adGroups:mutate')) {
                return jsonResponse({
                    results: [{ resourceName: 'customers/1234567890/adGroups/9903' }],
                });
            }
            if (url.includes('adGroupAds:mutate')) {
                return jsonResponse({
                    results: [{ resourceName: 'customers/1234567890/adGroupAds/9903~9904' }],
                });
            }
            if (url.includes('googleAds:search')) {
                return jsonResponse({
                    results: [
                        {
                            metrics: {
                                costMicros: '25000000', // $25.00 = 2500 cents
                                impressions: '8000',
                                clicks: '250',
                                conversions: '50',
                            },
                        },
                    ],
                });
            }
            if (url.includes('uploadClickConversions')) {
                return jsonResponse({
                    results: [{ conversionDateTime: '2026-10-16 00:00:00+00:00' }],
                });
            }
            return jsonResponse({});
        });

        const adapter = new GoogleAdsAdapter(
            {
                customerId: '123-456-7890',
                developerToken: 'MOCK_KEY_DO_NOT_USE_GADS_DEV',
                accessToken: 'MOCK_KEY_DO_NOT_USE_GADS_OAUTH',
                conversionActionId: '777888',
            },
            mockFetcher,
        );

        const directive = buildMockDirective();
        const receipt = await adapter.provisionCampaign(directive, 20_000);

        expect(receipt.platform).toBe('GOOGLE_ADS');
        expect(receipt.externalCampaignId).toBe('customers/1234567890/campaigns/9902');
        expect(receipt.externalAdSetOrGroupId).toBe('customers/1234567890/adGroups/9903');
        expect(receipt.externalAdIds).toEqual(['customers/1234567890/adGroupAds/9903~9904']);

        const telemetry = await adapter.fetchTelemetry(receipt.externalCampaignId, {
            start: '2026-10-16',
            end: '2026-10-20',
        });
        expect(telemetry.spendCents).toBe(2500);
        expect(telemetry.costPerOutboundClickCents).toBe(10); // 2500 / 250
        expect(telemetry.costPerConversionCents).toBe(50);    // 2500 / 50
    });
});

describe('AttributionBus (Server-Side Fan-Out & Deduplication)', () => {
    it('dispatches only to matching click-ID platforms, fans out first-party hashed PII when click IDs are absent, and deduplicates by eventId', async () => {
        const metaFetcher: AdapterFetch = vi.fn(async () =>
            jsonResponse({ events_received: 1, fbtrace_id: 'fb_trace_1' }),
        );
        const tiktokFetcher: AdapterFetch = vi.fn(async () =>
            jsonResponse({ code: 0, request_id: 'tt_trace_1', data: {} }),
        );
        const googleFetcher: AdapterFetch = vi.fn(async () =>
            jsonResponse({
                results: [{ conversionDateTime: '2026-10-16 12:00:00+00:00' }],
            }),
        );

        const metaAdapter = new MetaAdAdapter(
            {
                adAccountId: 'act_1',
                accessToken: 'MOCK_KEY_DO_NOT_USE',
                facebookPageId: 'page_1',
                pixelId: 'pixel_1',
            },
            metaFetcher,
        );
        const tiktokAdapter = new TikTokAdAdapter(
            {
                advertiserId: 'adv_1',
                accessToken: 'MOCK_KEY_DO_NOT_USE',
                pixelCode: 'tt_pix_1',
            },
            tiktokFetcher,
        );
        const googleAdapter = new GoogleAdsAdapter(
            {
                customerId: '1234567890',
                developerToken: 'MOCK_KEY_DO_NOT_USE',
                accessToken: 'MOCK_KEY_DO_NOT_USE',
                conversionActionId: 'conv_1',
            },
            googleFetcher,
        );

        const bus = new AttributionBus(
            [metaAdapter, tiktokAdapter, googleAdapter],
            new InMemoryAttributionDeduplicationStore(),
        );

        // 1. Event with only ttclid -> should only dispatch to TIKTOK
        const tiktokClickEvent: UnifiedAttributionEvent = {
            eventId: 'evt_tt_only_01',
            eventTimestampUnix: 1792152000,
            eventName: 'DSPOutboundClick',
            releaseId: 'rel_midnight_express',
            isrc: 'US-S1Z-26-00412',
            smartlinkId: 'sl_midnight_01',
            targetDsp: 'SPOTIFY',
            clickIdentifiers: {
                ttclid: 'tt_click_xyz_987',
            },
            userData: {
                clientIpAddress: '198.51.100.12',
                clientUserAgent: 'Mozilla/5.0',
            },
        };

        const receipt1 = await bus.dispatch(tiktokClickEvent);
        expect(receipt1.deduplicated).toBe(false);
        expect(receipt1.results.TIKTOK.attempted).toBe(true);
        expect(receipt1.results.TIKTOK.success).toBe(true);
        expect(receipt1.results.META.attempted).toBe(false);
        expect(receipt1.results.META.skippedReason).toBe('NO_MATCHING_SIGNAL');
        expect(receipt1.results.GOOGLE_ADS.attempted).toBe(false);

        // 2. Duplicate replay of same eventId -> must be deduplicated without network calls
        const duplicateReceipt = await bus.dispatch(tiktokClickEvent);
        expect(duplicateReceipt.deduplicated).toBe(true);
        expect(duplicateReceipt.results.TIKTOK.skippedReason).toBe('DUPLICATE_EVENT');
        expect(tiktokFetcher).toHaveBeenCalledTimes(1);

        // 3. Waitlist signup with pre-hashed SHA-256 email and no click IDs -> fans out to all 3 platforms
        const waitlistEvent: UnifiedAttributionEvent = {
            eventId: 'evt_waitlist_fanout_02',
            eventTimestampUnix: 1792152100,
            eventName: 'WaitlistSignup',
            releaseId: 'rel_midnight_express',
            isrc: 'US-S1Z-26-00412',
            smartlinkId: 'sl_midnight_01',
            clickIdentifiers: {},
            userData: {
                clientIpAddress: '198.51.100.12',
                clientUserAgent: 'Mozilla/5.0',
                emailSha256: sha256('superfan@indii.music'),
            },
        };

        const receipt2 = await bus.dispatch(waitlistEvent);
        expect(receipt2.results.META.success).toBe(true);
        expect(receipt2.results.TIKTOK.success).toBe(true);
        expect(receipt2.results.GOOGLE_ADS.success).toBe(true);
    });
});

describe('CampaignOrchestrator (Cross-Department Finance Recoupment & Execution)', () => {
    it('verifies post-mastering assets, reserves Finance recoupment ledger budget, splits budget across platforms, and commits receipts', async () => {
        const metaAdapter = new MetaAdAdapter(
            {
                adAccountId: 'act_1',
                accessToken: 'MOCK_KEY_DO_NOT_USE',
                facebookPageId: 'page_1',
                pixelId: 'pixel_1',
            },
            vi.fn(async (url) => {
                if (url.endsWith('/campaigns')) return jsonResponse({ id: 'm_camp' });
                if (url.endsWith('/adsets')) return jsonResponse({ id: 'm_adset' });
                if (url.endsWith('/adcreatives')) return jsonResponse({ id: 'm_cre' });
                return jsonResponse({ id: 'm_ad' });
            }),
        );

        const tiktokAdapter = new TikTokAdAdapter(
            {
                advertiserId: 'adv_1',
                accessToken: 'MOCK_KEY_DO_NOT_USE',
                pixelCode: 'tt_pix_1',
            },
            vi.fn(async (url) => {
                if (url.endsWith('/campaign/create/')) {
                    return jsonResponse({ code: 0, data: { campaign_id: 't_camp' } });
                }
                if (url.endsWith('/adgroup/create/')) {
                    return jsonResponse({ code: 0, data: { adgroup_id: 't_adgrp' } });
                }
                return jsonResponse({ code: 0, data: { ad_ids: ['t_ad'] } });
            }),
        );

        const googleAdapter = new GoogleAdsAdapter(
            {
                customerId: '1234567890',
                developerToken: 'MOCK_KEY_DO_NOT_USE',
                accessToken: 'MOCK_KEY_DO_NOT_USE',
                conversionActionId: 'conv_1',
            },
            vi.fn(async (url) => {
                if (url.includes('campaignBudgets:mutate')) {
                    return jsonResponse({ results: [{ resourceName: 'customers/1234567890/campaignBudgets/1' }] });
                }
                if (url.includes('campaigns:mutate')) {
                    return jsonResponse({ results: [{ resourceName: 'customers/1234567890/campaigns/2' }] });
                }
                if (url.includes('adGroups:mutate')) {
                    return jsonResponse({ results: [{ resourceName: 'customers/1234567890/adGroups/3' }] });
                }
                return jsonResponse({ results: [{ resourceName: 'customers/1234567890/adGroupAds/3~4' }] });
            }),
        );

        const financeLedger = new InMemoryFinanceRecoupmentLedger({
            ledger_recoup_01: 250_000, // $2,500.00 available
        });

        const orchestrator = new CampaignOrchestrator({
            adapters: [metaAdapter, tiktokAdapter, googleAdapter],
            financeLedger,
        });

        const directive = buildMockDirective();
        const result = await orchestrator.executeDirective(directive);

        expect(result.failures).toHaveLength(0);
        expect(result.receipts).toHaveLength(3);
        expect(result.allocatedPlatformBudgetsCents).toEqual({
            META: 50_000,
            TIKTOK: 30_000,
            GOOGLE_ADS: 20_000,
        });
        expect(result.totalCommittedBudgetCents).toBe(100_000);
        expect(financeLedger.getAccountBalance('ledger_recoup_01')).toBe(150_000);

        const ledgerEntry = financeLedger.getEntry(result.ledgerReservationId);
        expect(ledgerEntry?.status).toBe('COMMITTED');
        expect(ledgerEntry?.committedCents).toBe(100_000);
    });
});
