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
    FirestoreAttributionDeduplicationStore,
    type FirestoreLikeDb,
} from '../attribution/firestore-attribution-store';
import {
    CampaignOrchestrator,
    InMemoryFinanceRecoupmentLedger,
} from '../../orchestration/marketing/campaign-orchestrator';
import {
    FirestoreFinanceRecoupmentLedger,
    type TransactionalFirestoreDb,
} from '../../orchestration/marketing/firestore-recoupment-ledger';
import {
    __resetCampaignJudgmentCooldownForTests,
    computeBoundedSplitRefinement,
    evaluateCampaignAllocationWithJev,
    heuristicCampaignJudgment,
} from '../../orchestration/marketing/campaign-judgments';
import type { TypesafeClient } from '../../functions/intelligence/typesafeClient';
import {
    handleExecuteUnifiedCampaignDirective,
    handleIngestUnifiedAttributionEvent,
} from '../../functions/marketing/adCampaignCallables';

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

describe('FirestoreAttributionDeduplicationStore', () => {
    function createMockDb(): {
        db: FirestoreLikeDb;
        store: Map<string, Record<string, unknown>>;
    } {
        const store = new Map<string, Record<string, unknown>>();
        const db: FirestoreLikeDb = {
            collection() {
                return {
                    doc(docId: string) {
                        return {
                            async get() {
                                const existing = store.get(docId);
                                return {
                                    exists: existing !== undefined,
                                    data: () => existing,
                                };
                            },
                            async set(data: Record<string, unknown>, options?: { merge?: boolean }) {
                                if (options?.merge && store.has(docId)) {
                                    store.set(docId, { ...store.get(docId), ...data });
                                } else {
                                    store.set(docId, { ...data });
                                }
                            },
                            async create(data: Record<string, unknown>) {
                                if (store.has(docId)) {
                                    const err = new Error('Document already exists') as Error & { code?: number };
                                    err.code = 6; // gRPC ALREADY_EXISTS
                                    throw err;
                                }
                                store.set(docId, { ...data });
                            },
                        };
                    },
                };
            },
        };
        return { db, store };
    }

    it('persists processed eventIds in Firestore and prevents duplicate AttributionBus replay across instances', async () => {
        const { db, store } = createMockDb();
        const dedupStoreA = new FirestoreAttributionDeduplicationStore({ db });
        const dedupStoreB = new FirestoreAttributionDeduplicationStore({ db });

        const metaAdapter = new MetaAdAdapter(
            {
                adAccountId: '1',
                accessToken: 'MOCK_KEY_DO_NOT_USE',
                facebookPageId: 'p1',
                pixelId: 'px1',
            },
            vi.fn(async () => jsonResponse({ events_received: 1, fbtrace_id: 'fb_trace_fs_1' })),
        );

        const busInstance1 = new AttributionBus([metaAdapter], dedupStoreA);
        const busInstance2 = new AttributionBus([metaAdapter], dedupStoreB);

        const event: UnifiedAttributionEvent = {
            eventId: 'evt_fs_durable_01',
            eventTimestampUnix: 1792108800,
            eventName: 'DSPOutboundClick',
            releaseId: 'rel_midnight_express',
            isrc: 'US-S1Z-26-00412',
            smartlinkId: 'sl_midnight_01',
            targetDsp: 'SPOTIFY',
            clickIdentifiers: {
                fbclid: 'fb_click_fs_01',
            },
            userData: {
                clientIpAddress: '203.0.113.42',
                clientUserAgent: 'Mozilla/5.0',
                emailSha256: sha256('fan@indii.music'),
            },
        };

        const firstDispatch = await busInstance1.dispatch(event);
        expect(firstDispatch.deduplicated).toBe(false);
        expect(firstDispatch.results['META']?.success).toBe(true);
        expect(store.has('evt_fs_durable_01')).toBe(true);

        // Second dispatch on a separate AttributionBus instance backed by the same Firestore collection
        const secondDispatch = await busInstance2.dispatch(event);
        expect(secondDispatch.deduplicated).toBe(true);
        expect(secondDispatch.results['META']?.skippedReason).toBe('DUPLICATE_EVENT');
    });
});

describe('FirestoreFinanceRecoupmentLedger', () => {
    function createMockRecoupmentFirestore(initialBalances: Record<string, number>): {
        db: TransactionalFirestoreDb;
        accounts: Map<string, Record<string, unknown>>;
        reservations: Map<string, Record<string, unknown>>;
    } {
        const accounts = new Map<string, Record<string, unknown>>();
        for (const [id, balance] of Object.entries(initialBalances)) {
            accounts.set(id, { availableBalanceCents: balance });
        }
        const reservations = new Map<string, Record<string, unknown>>();

        const makeDocRef = (map: Map<string, Record<string, unknown>>, docId: string) => ({
            id: docId,
            async get() {
                const data = map.get(docId);
                return {
                    exists: data !== undefined,
                    data: () => data,
                };
            },
            async set(data: Record<string, unknown>, options?: { merge?: boolean }) {
                if (options?.merge && map.has(docId)) {
                    map.set(docId, { ...map.get(docId), ...data });
                } else {
                    map.set(docId, { ...data });
                }
            },
        });

        const db: TransactionalFirestoreDb = {
            collection(name: string) {
                const targetMap = name.toLowerCase().includes('reservation') ? reservations : accounts;
                return {
                    doc(docId: string) {
                        return makeDocRef(targetMap, docId);
                    },
                };
            },
            async runTransaction<T>(updateFunction: (tx: {
                get(ref: ReturnType<typeof makeDocRef>): Promise<{ exists: boolean; data(): Record<string, unknown> | undefined }>;
                set(ref: ReturnType<typeof makeDocRef>, data: Record<string, unknown>, options?: { merge?: boolean }): void;
            }) => Promise<T>): Promise<T> {
                const tx = {
                    async get(ref: ReturnType<typeof makeDocRef>) {
                        return ref.get();
                    },
                    set(ref: ReturnType<typeof makeDocRef>, data: Record<string, unknown>, options?: { merge?: boolean }) {
                        void ref.set(data, options);
                    },
                };
                return updateFunction(tx);
            },
        };

        return { db, accounts, reservations };
    }

    it('atomically reserves, commits with partial refund, and releases recoupment budget in Firestore', async () => {
        const { db, accounts, reservations } = createMockRecoupmentFirestore({
            ledger_fs_01: 200_000, // $2,000.00
        });
        const ledger = new FirestoreFinanceRecoupmentLedger({ db });

        const entry = await ledger.reserveCampaignBudget({
            ledgerAccountId: 'ledger_fs_01',
            directiveId: 'dir_fs_001',
            artistId: 'artist_detroit_01',
            releaseId: 'rel_midnight_express',
            isrc: 'US-S1Z-26-00412',
            amountCents: 100_000,
            currency: 'USD',
        });

        expect(accounts.get('ledger_fs_01')?.availableBalanceCents).toBe(100_000);
        expect(reservations.get(entry.reservationId)?.status).toBe('RESERVED');

        // Commit only $800.00 -> $200.00 refunded to available balance
        await ledger.commitCampaignBudget(entry.reservationId, 80_000, [
            {
                platform: 'META',
                externalCampaignId: 'm_camp_1',
                externalAdSetOrGroupId: 'm_adset_1',
                externalAdIds: ['m_ad_1'],
                status: 'PAUSED',
                committedBudgetCents: 80_000,
                timestampIso: '2026-10-15T00:00:00.000Z',
            },
        ]);
        expect(accounts.get('ledger_fs_01')?.availableBalanceCents).toBe(120_000);
        expect(reservations.get(entry.reservationId)?.status).toBe('COMMITTED');
        expect(reservations.get(entry.reservationId)?.committedCents).toBe(80_000);

        // Reserve another $500.00 and release it on failure
        const secondEntry = await ledger.reserveCampaignBudget({
            ledgerAccountId: 'ledger_fs_01',
            directiveId: 'dir_fs_002',
            artistId: 'artist_detroit_01',
            releaseId: 'rel_midnight_express',
            isrc: 'US-S1Z-26-00412',
            amountCents: 50_000,
            currency: 'USD',
        });
        expect(accounts.get('ledger_fs_01')?.availableBalanceCents).toBe(70_000);

        await ledger.releaseCampaignBudget(secondEntry.reservationId, 'Simulated adapter outage');
        expect(accounts.get('ledger_fs_01')?.availableBalanceCents).toBe(120_000);
        expect(reservations.get(secondEntry.reservationId)?.status).toBe('RELEASED');
    });
});

describe('Jev System One Campaign Judgments & Orchestrator Integration', () => {
    it('refines platform split percentages toward Jev dominant platform while enforcing 10% floor and 100% sum', async () => {
        __resetCampaignJudgmentCooldownForTests();
        const directive = buildMockDirective();

        const mockTypesafeClient = {
            judge: vi.fn(async () => ({
                requestId: 'req_mock_jev_01',
                model: 'jev-1.13.0',
                usage: { inputTokens: 410, outputTokens: 18 },
                answers: {
                    dominant_platform: {
                        type: 'choice' as const,
                        choice: 'TIKTOK',
                        confidence: 0.92,
                        probabilities: { TIKTOK: 0.92, META: 0.05, GOOGLE_ADS: 0.03 },
                    },
                    creative_fit_score: {
                        type: 'score' as const,
                        answer: 5,
                        score: 3.78,
                        distribution: { 0: 0.0, 1: 0.0, 2: 0.02, 3: 0.18, 4: 0.8 },
                    },
                    creative_readiness_confirmed: {
                        type: 'noul' as const,
                        noul: 0.96,
                    },
                },
            })),
        } as unknown as TypesafeClient;

        const judgment = await evaluateCampaignAllocationWithJev(
            directive,
            [
                {
                    platform: 'TIKTOK',
                    externalCampaignId: 'tt_prev_1',
                    spendCents: 20_000,
                    impressions: 95_000,
                    clicks: 3_200,
                    outboundDspClicks: 2_100,
                    conversions: 640,
                    costPerOutboundClickCents: 10,
                    costPerConversionCents: 31,
                    syncedAtIso: '2026-10-15T00:00:00.000Z',
                },
            ],
            { client: mockTypesafeClient },
        );

        expect(judgment.source).toBe('jev');
        expect(mockTypesafeClient.judge).toHaveBeenCalledWith(expect.objectContaining({
            questions: expect.objectContaining({
                creative_fit_score: expect.objectContaining({ criteria: expect.any(Array) }),
            }),
        }));
        expect(judgment.dominantPlatform).toBe('TIKTOK');
        expect(judgment.confidence).toBeCloseTo(0.92, 2);
        expect(judgment.creativeFitScore).toBeCloseTo(4.78, 2);
        expect(judgment.creativeReadinessConfirmed).toBe(true);
        // Original split was META: 50, TIKTOK: 30, GOOGLE_ADS: 20.
        // With TIKTOK dominant and creativeFitScore >= 4 (+10% boost), TIKTOK increases to 40%.
        expect(judgment.refinedSplitPercentages['TIKTOK']).toBe(40);
        const totalPct =
            (judgment.refinedSplitPercentages['META'] ?? 0) +
            (judgment.refinedSplitPercentages['TIKTOK'] ?? 0) +
            (judgment.refinedSplitPercentages['GOOGLE_ADS'] ?? 0);
        expect(totalPct).toBe(100);
    });

    it('blocks CampaignOrchestrator execution before reserving finance funds when Jev creativeReadinessConfirmed is false', async () => {
        const financeLedger = new InMemoryFinanceRecoupmentLedger({
            ledger_recoup_01: 250_000,
        });

        const metaAdapter = new MetaAdAdapter(
            {
                adAccountId: '1',
                accessToken: 'MOCK_KEY_DO_NOT_USE',
                facebookPageId: 'p1',
                pixelId: 'px1',
            },
            vi.fn(async () => jsonResponse({ id: 'm_1' })),
        );

        const orchestrator = new CampaignOrchestrator({
            adapters: [metaAdapter],
            financeLedger,
            campaignJudge: vi.fn(async (dir) => ({
                ...heuristicCampaignJudgment(dir),
                creativeReadinessConfirmed: false,
                source: 'jev' as const,
            })),
        });

        const directive = buildMockDirective({
            platforms: ['META'],
            budgetAllocation: {
                currency: 'USD',
                totalBudgetCents: 50_000,
                dailyBudgetCents: 10_000,
                platformSplitPercentages: { META: 100 },
            },
        });

        await expect(orchestrator.executeDirective(directive)).rejects.toThrow(
            /creative readiness check rejected campaign execution/i,
        );

        // Balance must remain untouched
        expect(financeLedger.getAccountBalance('ledger_recoup_01')).toBe(250_000);
    });

    it('falls back cleanly to heuristic judgment when TypesafeClient throws', async () => {
        __resetCampaignJudgmentCooldownForTests();
        const directive = buildMockDirective();
        const failingClient = {
            judge: vi.fn(async () => {
                throw new Error('Simulated Jev network timeout');
            }),
        } as unknown as TypesafeClient;

        const judgment = await evaluateCampaignAllocationWithJev(
            directive,
            [],
            { client: failingClient },
        );
        expect(judgment.source).toBe('heuristic');
        expect(judgment.creativeReadinessConfirmed).toBe(true);
        expect(judgment.refinedSplitPercentages).toEqual({
            META: 50,
            TIKTOK: 30,
            GOOGLE_ADS: 20,
        });

        // Verify computeBoundedSplitRefinement preserves 10% floor on extreme shift
        const extremeRefined = computeBoundedSplitRefinement(
            ['META', 'TIKTOK'],
            { META: 85, TIKTOK: 15 },
            'META',
            5,
        );
        expect(extremeRefined['TIKTOK']).toBeGreaterThanOrEqual(10);
        expect((extremeRefined['META'] ?? 0) + (extremeRefined['TIKTOK'] ?? 0)).toBe(100);
    });
});

describe('Cloud Function Callable Handlers (adCampaignCallables)', () => {
    it('rejects cross-artist directive execution when directive.artistId does not match authenticatedUid', async () => {
        const directive = buildMockDirective({
            artistId: 'artist_detroit_01',
        });

        await expect(
            handleExecuteUnifiedCampaignDirective('attacker_uid_999', directive),
        ).rejects.toThrow(/Directive artistId must match the authenticated user/i);
    });

    it('executes handleExecuteUnifiedCampaignDirective and handleIngestUnifiedAttributionEvent end-to-end', async () => {
        const persistedResults: unknown[] = [];
        const accounts = new Map<string, Record<string, unknown>>([
            ['ledger_recoup_01', { availableBalanceCents: 200_000 }],
        ]);
        const reservations = new Map<string, Record<string, unknown>>();

        const makeDocRef = (map: Map<string, Record<string, unknown>>, docId: string) => ({
            id: docId,
            async get() {
                const data = map.get(docId);
                return { exists: data !== undefined, data: () => data };
            },
            async set(data: Record<string, unknown>, options?: { merge?: boolean }) {
                if (options?.merge && map.has(docId)) {
                    map.set(docId, { ...map.get(docId), ...data });
                } else {
                    map.set(docId, { ...data });
                }
            },
        });

        const ledgerDb: TransactionalFirestoreDb = {
            collection(name: string) {
                const targetMap = name.toLowerCase().includes('reservation') ? reservations : accounts;
                return { doc: (docId: string) => makeDocRef(targetMap, docId) };
            },
            async runTransaction<T>(fn: (tx: {
                get(ref: ReturnType<typeof makeDocRef>): Promise<{ exists: boolean; data(): Record<string, unknown> | undefined }>;
                set(ref: ReturnType<typeof makeDocRef>, data: Record<string, unknown>, options?: { merge?: boolean }): void;
            }) => Promise<T>): Promise<T> {
                return fn({
                    get: (ref) => ref.get(),
                    set: (ref, data, options) => { void ref.set(data, options); },
                });
            },
        };

        const metaAdapter = new MetaAdAdapter(
            {
                adAccountId: '1',
                accessToken: 'MOCK_KEY_DO_NOT_USE',
                facebookPageId: 'p1',
                pixelId: 'px1',
            },
            vi.fn(async () => jsonResponse({ id: 'm_callable_1', events_received: 1, fbtrace_id: 'fb_call_trace' })),
        );

        const directive = buildMockDirective({
            platforms: ['META'],
            budgetAllocation: {
                currency: 'USD',
                totalBudgetCents: 50_000,
                dailyBudgetCents: 10_000,
                platformSplitPercentages: { META: 100 },
            },
        });

        const execResult = await handleExecuteUnifiedCampaignDirective(
            'artist_detroit_01',
            directive,
            {
                adapters: [metaAdapter],
                ledger: new FirestoreFinanceRecoupmentLedger({ db: ledgerDb }),
                allocationJudge: async (dir) => heuristicCampaignJudgment(dir),
                onReceiptPersist: async (res) => {
                    persistedResults.push(res);
                },
            },
        );

        expect(execResult.totalCommittedBudgetCents).toBe(50_000);
        expect(execResult.receipts).toHaveLength(1);
        expect(persistedResults).toHaveLength(1);

        const dedupMap = new Map<string, Record<string, unknown>>();
        const dedupDb: FirestoreLikeDb = {
            collection() {
                return {
                    doc(id: string) {
                        return {
                            async get() {
                                return { exists: dedupMap.has(id), data: () => dedupMap.get(id) };
                            },
                            async set(data: Record<string, unknown>) {
                                dedupMap.set(id, data);
                            },
                        };
                    },
                };
            },
        };

        const receipt = await handleIngestUnifiedAttributionEvent(
            'artist_detroit_01',
            {
                eventId: 'evt_callable_01',
                eventTimestampUnix: 1792108800,
                eventName: 'PreSaveComplete',
                releaseId: 'rel_midnight_express',
                isrc: 'US-S1Z-26-00412',
                smartlinkId: 'sl_midnight_01',
                clickIdentifiers: { fbclid: 'fb_click_callable_1' },
                userData: {
                    clientIpAddress: '198.51.100.10',
                    clientUserAgent: 'Mozilla/5.0',
                    emailSha256: sha256('listener@indii.music'),
                },
            },
            {
                adapters: [metaAdapter],
                dedupStore: new FirestoreAttributionDeduplicationStore({ db: dedupDb }),
            },
        );

        expect(receipt.deduplicated).toBe(false);
        expect(receipt.results['META']?.success).toBe(true);
    });
});
