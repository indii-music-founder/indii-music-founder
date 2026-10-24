/**
 * BaseAdPlatformAdapter — Layer 3 (Execution)
 *
 * Abstract base class implementing `IAdPlatformAdapter` across Meta, TikTok,
 * and Google Ads. Enforces runtime Zod validation at the adapter boundary,
 * verifies post-mastering release identifiers (ISRC, smartlinkId), guards
 * budget invariants, and provides deterministic cost-per-outcome math.
 */

import { createHash } from 'node:crypto';
import {
    type IAdPlatformAdapter,
    type PlatformCampaignReceipt,
    type PlatformTelemetrySnapshot,
    type SupportedAdPlatform,
    type UnifiedAttributionEvent,
    type UnifiedCampaignDirective,
    PlatformCampaignReceiptSchema,
    PlatformTelemetrySnapshotSchema,
    UnifiedAttributionEventSchema,
    UnifiedCampaignDirectiveSchema,
} from '../../types/ad-execution.types';

export type AdapterFetch = (url: string, init: RequestInit) => Promise<Response>;

export type AdAdapterErrorCode =
    | 'INVALID_DIRECTIVE_PAYLOAD'
    | 'INVALID_ATTRIBUTION_EVENT'
    | 'BUDGET_BELOW_MINIMUM'
    | 'MISSING_PLATFORM_CREDENTIALS'
    | 'MISSING_PLATFORM_ASSETS'
    | 'API_EXECUTION_FAILED'
    | 'SWARM_HALTED';

export class AdPlatformAdapterError extends Error {
    constructor(
        readonly platform: SupportedAdPlatform,
        readonly code: AdAdapterErrorCode,
        message: string,
        readonly details?: Record<string, unknown>,
    ) {
        super(`[${platform}:${code}] ${message}`);
        this.name = 'AdPlatformAdapterError';
    }
}

export abstract class BaseAdPlatformAdapter implements IAdPlatformAdapter {
    abstract readonly platform: SupportedAdPlatform;

    /** Minimum daily or allocated budget in cents ($1.00 USD / 100 minor units). */
    protected readonly minBudgetCents = 100;

    protected readonly fetcher: AdapterFetch;

    constructor(fetcher: AdapterFetch = fetch) {
        this.fetcher = fetcher;
    }

    /**
     * Validates a `UnifiedCampaignDirective` and allocated budget before hitting
     * any external network API.
     */
    protected validateProvisionRequest(
        directive: UnifiedCampaignDirective,
        allocatedBudgetCents: number,
    ): UnifiedCampaignDirective {
        const parsed = UnifiedCampaignDirectiveSchema.safeParse(directive);
        if (!parsed.success) {
            throw new AdPlatformAdapterError(
                this.platform,
                'INVALID_DIRECTIVE_PAYLOAD',
                `Campaign directive failed schema validation: ${parsed.error.issues.map(i => i.message).join('; ')}`,
                { issues: parsed.error.issues },
            );
        }

        if (!Number.isInteger(allocatedBudgetCents) || allocatedBudgetCents < this.minBudgetCents) {
            throw new AdPlatformAdapterError(
                this.platform,
                'BUDGET_BELOW_MINIMUM',
                `Allocated budget (${allocatedBudgetCents} cents) must be an integer >= ${this.minBudgetCents} cents.`,
                { allocatedBudgetCents, minBudgetCents: this.minBudgetCents },
            );
        }

        if (!parsed.data.platforms.includes(this.platform)) {
            throw new AdPlatformAdapterError(
                this.platform,
                'INVALID_DIRECTIVE_PAYLOAD',
                `Directive ${parsed.data.directiveId} does not target platform ${this.platform}.`,
            );
        }

        return parsed.data;
    }

    /**
     * Validates a `UnifiedAttributionEvent` via Zod before dispatching to a
     * platform conversion endpoint.
     */
    protected validateAttributionEvent(event: UnifiedAttributionEvent): UnifiedAttributionEvent {
        const parsed = UnifiedAttributionEventSchema.safeParse(event);
        if (!parsed.success) {
            throw new AdPlatformAdapterError(
                this.platform,
                'INVALID_ATTRIBUTION_EVENT',
                `Attribution event failed schema validation: ${parsed.error.issues.map(i => i.message).join('; ')}`,
                { issues: parsed.error.issues },
            );
        }
        return parsed.data;
    }

    /**
     * Validates and freezes a `PlatformCampaignReceipt` before returning to the
     * Orchestration Layer.
     */
    protected validateReceipt(receipt: PlatformCampaignReceipt): PlatformCampaignReceipt {
        return PlatformCampaignReceiptSchema.parse(receipt);
    }

    /**
     * Computes deterministic unit costs (`costPerOutboundClickCents` and
     * `costPerConversionCents`) without floating-point drift or division-by-zero.
     */
    protected buildNormalizedTelemetry(input: {
        externalCampaignId: string;
        spendCents: number;
        impressions: number;
        clicks: number;
        outboundDspClicks: number;
        conversions: number;
        syncedAtIso?: string;
    }): PlatformTelemetrySnapshot {
        const spendCents = Math.max(0, Math.round(input.spendCents));
        const impressions = Math.max(0, Math.round(input.impressions));
        const clicks = Math.max(0, Math.round(input.clicks));
        const outboundDspClicks = Math.max(0, Math.round(input.outboundDspClicks));
        const conversions = Math.max(0, Math.round(input.conversions));

        const costPerOutboundClickCents =
            outboundDspClicks > 0 ? Math.round(spendCents / outboundDspClicks) : 0;
        const costPerConversionCents =
            conversions > 0 ? Math.round(spendCents / conversions) : 0;

        return PlatformTelemetrySnapshotSchema.parse({
            platform: this.platform,
            externalCampaignId: input.externalCampaignId,
            spendCents,
            impressions,
            clicks,
            outboundDspClicks,
            conversions,
            costPerOutboundClickCents,
            costPerConversionCents,
            syncedAtIso: input.syncedAtIso ?? new Date().toISOString(),
        });
    }

    /**
     * Appends deterministic cross-platform attribution query parameters to the
     * post-mastering Smartlink URL so downstream server-side redirects can link
     * clicks back to the exact directive, platform, and ISRC.
     */
    protected buildTrackedSmartlinkUrl(directive: UnifiedCampaignDirective): string {
        const url = new URL(directive.assets.smartlinkUrl);
        url.searchParams.set('utm_source', this.platform.toLowerCase());
        url.searchParams.set('utm_medium', 'paid_social');
        url.searchParams.set('utm_campaign', directive.directiveId);
        url.searchParams.set('indii_release_id', directive.assets.releaseId);
        url.searchParams.set('indii_isrc', directive.assets.isrc.replace(/-/g, '').toUpperCase());
        url.searchParams.set('indii_smartlink_id', directive.assets.smartlinkId);
        return url.toString();
    }

    /**
     * Deterministic SHA-256 hex digest helper for external fan identifiers when
     * an ad network requires hashed external IDs.
     */
    protected sha256Hex(raw: string): string {
        return createHash('sha256').update(raw.trim().toLowerCase()).digest('hex');
    }

    abstract provisionCampaign(
        directive: UnifiedCampaignDirective,
        allocatedBudgetCents: number,
    ): Promise<PlatformCampaignReceipt>;

    abstract updateBudget(
        externalCampaignId: string,
        dailyBudgetCents: number,
    ): Promise<void>;

    abstract updateStatus(
        externalCampaignId: string,
        status: 'ACTIVE' | 'PAUSED',
    ): Promise<void>;

    abstract fetchTelemetry(
        externalCampaignId: string,
        dateRange: { start: string; end: string },
    ): Promise<PlatformTelemetrySnapshot>;

    abstract dispatchConversionEvent(
        event: UnifiedAttributionEvent,
    ): Promise<{ success: boolean; externalTraceId?: string; errorMessage?: string }>;
}
