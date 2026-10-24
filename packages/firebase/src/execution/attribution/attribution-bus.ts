/**
 * AttributionBus — Layer 3 (Execution)
 *
 * Unified Server-Side Attribution Engine that validates incoming
 * `UnifiedAttributionEvent` records, deduplicates by `eventId`, routes
 * conversions to eligible platform adapters (Meta CAPI, TikTok Events API,
 * Google Ads Enhanced Conversions) based on click identifiers (`fbclid`/`fbp`,
 * `ttclid`/`ttp`, `gclid`/`gbraid`/`wbraid`) and pre-hashed contact signals,
 * and returns a structured fan-out receipt.
 */

import {
    type IAdPlatformAdapter,
    type SupportedAdPlatform,
    type UnifiedAttributionEvent,
    UnifiedAttributionEventSchema,
} from '../../types/ad-execution.types';

export interface PlatformAttributionDispatchResult {
    platform: SupportedAdPlatform;
    attempted: boolean;
    success: boolean;
    externalTraceId?: string;
    skippedReason?: 'NO_MATCHING_SIGNAL' | 'ADAPTER_NOT_REGISTERED' | 'DUPLICATE_EVENT';
    errorMessage?: string;
}

export interface AttributionFanOutReceipt {
    eventId: string;
    eventName: UnifiedAttributionEvent['eventName'];
    releaseId: string;
    isrc: string;
    deduplicated: boolean;
    dispatchedAtIso: string;
    results: Record<SupportedAdPlatform, PlatformAttributionDispatchResult>;
}

export interface AttributionDeduplicationStore {
    hasProcessed(eventId: string): Promise<boolean> | boolean;
    markProcessed(eventId: string, receipt: AttributionFanOutReceipt): Promise<void> | void;
}

export class InMemoryAttributionDeduplicationStore implements AttributionDeduplicationStore {
    private readonly processed = new Map<string, AttributionFanOutReceipt>();

    hasProcessed(eventId: string): boolean {
        return this.processed.has(eventId);
    }

    markProcessed(eventId: string, receipt: AttributionFanOutReceipt): void {
        this.processed.set(eventId, receipt);
    }

    getReceipt(eventId: string): AttributionFanOutReceipt | undefined {
        return this.processed.get(eventId);
    }
}

const ALL_PLATFORMS: readonly SupportedAdPlatform[] = ['META', 'TIKTOK', 'GOOGLE_ADS'] as const;

export class AttributionBus {
    private readonly adapters = new Map<SupportedAdPlatform, IAdPlatformAdapter>();
    private readonly dedupStore: AttributionDeduplicationStore;

    constructor(
        adapters: ReadonlyArray<IAdPlatformAdapter> = [],
        dedupStore: AttributionDeduplicationStore = new InMemoryAttributionDeduplicationStore(),
    ) {
        for (const adapter of adapters) {
            this.adapters.set(adapter.platform, adapter);
        }
        this.dedupStore = dedupStore;
    }

    registerAdapter(adapter: IAdPlatformAdapter): void {
        this.adapters.set(adapter.platform, adapter);
    }

    /**
     * Determines whether an event carries attribution signals applicable to a
     * specific ad platform.
     *
     * Rules:
     * 1. If platform-specific click IDs are present (`fbclid`/`fbp`/`fbc` for Meta,
     *    `ttclid`/`ttp` for TikTok, `gclid`/`gbraid`/`wbraid` for Google Ads),
     *    only the matching platform(s) receive the click-attributed event unless
     *    hashed first-party PII (`emailSha256`/`phoneSha256`) is also provided for
     *    cross-network match.
     * 2. If no click IDs are present on the event, first-party hashed identity
     *    (`emailSha256` or `phoneSha256`) fans out across all registered adapters
     *    for view-through / cross-device attribution matching.
     */
    static isPlatformEligible(
        event: UnifiedAttributionEvent,
        platform: SupportedAdPlatform,
    ): boolean {
        const { fbclid, fbp, fbc, ttclid, ttp, gclid, gbraid, wbraid } = event.clickIdentifiers;
        const hasMetaClick = Boolean(fbclid || fbp || fbc);
        const hasTikTokClick = Boolean(ttclid || ttp);
        const hasGoogleClick = Boolean(gclid || gbraid || wbraid);
        const hasAnyClickId = hasMetaClick || hasTikTokClick || hasGoogleClick;

        const hasHashedPii = Boolean(
            event.userData.emailSha256 || event.userData.phoneSha256,
        );

        if (platform === 'META') {
            return hasMetaClick || (!hasAnyClickId && hasHashedPii);
        }
        if (platform === 'TIKTOK') {
            return hasTikTokClick || (!hasAnyClickId && hasHashedPii);
        }
        if (platform === 'GOOGLE_ADS') {
            return hasGoogleClick || (!hasAnyClickId && hasHashedPii);
        }
        return false;
    }

    /**
     * Validates and fans out a `UnifiedAttributionEvent` across registered
     * platform adapters concurrently.
     */
    async dispatch(event: UnifiedAttributionEvent): Promise<AttributionFanOutReceipt> {
        const valid = UnifiedAttributionEventSchema.parse(event);
        const alreadyProcessed = await this.dedupStore.hasProcessed(valid.eventId);

        if (alreadyProcessed) {
            const skippedResults = {} as Record<
                SupportedAdPlatform,
                PlatformAttributionDispatchResult
            >;
            for (const platform of ALL_PLATFORMS) {
                skippedResults[platform] = {
                    platform,
                    attempted: false,
                    success: false,
                    skippedReason: 'DUPLICATE_EVENT',
                };
            }

            return {
                eventId: valid.eventId,
                eventName: valid.eventName,
                releaseId: valid.releaseId,
                isrc: valid.isrc,
                deduplicated: true,
                dispatchedAtIso: new Date().toISOString(),
                results: skippedResults,
            };
        }

        const entries = await Promise.all(
            ALL_PLATFORMS.map(async (platform): Promise<[SupportedAdPlatform, PlatformAttributionDispatchResult]> => {
                const adapter = this.adapters.get(platform);
                if (!adapter) {
                    return [
                        platform,
                        {
                            platform,
                            attempted: false,
                            success: false,
                            skippedReason: 'ADAPTER_NOT_REGISTERED',
                        },
                    ];
                }

                if (!AttributionBus.isPlatformEligible(valid, platform)) {
                    return [
                        platform,
                        {
                            platform,
                            attempted: false,
                            success: false,
                            skippedReason: 'NO_MATCHING_SIGNAL',
                        },
                    ];
                }

                try {
                    const outcome = await adapter.dispatchConversionEvent(valid);
                    return [
                        platform,
                        {
                            platform,
                            attempted: true,
                            success: outcome.success,
                            ...(outcome.externalTraceId
                                ? { externalTraceId: outcome.externalTraceId }
                                : {}),
                            ...(!outcome.success && outcome.errorMessage
                                ? { errorMessage: outcome.errorMessage }
                                : {}),
                        },
                    ];
                } catch (err) {
                    return [
                        platform,
                        {
                            platform,
                            attempted: true,
                            success: false,
                            errorMessage: err instanceof Error ? err.message : String(err),
                        },
                    ];
                }
            }),
        );

        const results = Object.fromEntries(entries) as Record<
            SupportedAdPlatform,
            PlatformAttributionDispatchResult
        >;

        const receipt: AttributionFanOutReceipt = {
            eventId: valid.eventId,
            eventName: valid.eventName,
            releaseId: valid.releaseId,
            isrc: valid.isrc,
            deduplicated: false,
            dispatchedAtIso: new Date().toISOString(),
            results,
        };

        // Only a fully delivered fan-out is terminal. A partial failure must
        // remain retryable; adapters send the same eventId on each attempt so
        // platform-side event deduplication can suppress successful replays.
        const attempted = Object.values(results).filter((result) => result.attempted);
        if (attempted.length > 0 && attempted.every((result) => result.success)) {
            await this.dedupStore.markProcessed(valid.eventId, receipt);
        }
        return receipt;
    }
}
