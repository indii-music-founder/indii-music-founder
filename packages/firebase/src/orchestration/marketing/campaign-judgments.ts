/**
 * campaign-judgments — Layer 2 (Orchestration / Jev System One Integration)
 *
 * Server-side Jev (`jev-latest`) System One judgments for multi-platform
 * campaign allocation and asset readiness verification.
 *
 * House contract (mirrors `packages/firebase/src/functions/audit/judgments.ts`):
 *  - Deterministic baseline (`heuristicCampaignJudgment`) always computes first.
 *  - Jev only refines platform split percentages within safe bounds when
 *    2+ platforms are targeted and confidence >= `DOMINANT_PLATFORM_MIN_CONFIDENCE`.
 *  - Every requested platform retains a minimum 10% floor so Jev never silently
 *    drops a requested network, and split percentages always sum to 100.
 *  - Any network or credential failure falls back to the deterministic baseline
 *    and enters a 5-minute cooldown.
 */

import { typesafeApiKey } from '../../config/secrets';
import {
    getServerTypesafeClient,
    type TypesafeClient,
    TypesafeClientError,
} from '../../functions/intelligence/typesafeClient';
import {
    type PlatformTelemetrySnapshot,
    type SupportedAdPlatform,
    type UnifiedCampaignDirective,
} from '../../types/ad-execution.types';

export const DOMINANT_PLATFORM_MIN_CONFIDENCE = 0.6;
export const PLATFORM_MIN_SPLIT_FLOOR_PCT = 10;
export const CAMPAIGN_JUDGMENT_COOLDOWN_MS = 5 * 60 * 1000;

export interface CampaignAllocationJudgment {
    dominantPlatform: SupportedAdPlatform;
    refinedSplitPercentages: Partial<Record<SupportedAdPlatform, number>>;
    creativeFitScore: number;
    creativeReadinessConfirmed: boolean;
    source: 'jev' | 'heuristic';
    confidence?: number;
    requestId?: string;
}

let lastCampaignJudgmentFailureAt = 0;

function campaignJudgmentsAvailable(): boolean {
    return Date.now() - lastCampaignJudgmentFailureAt >= CAMPAIGN_JUDGMENT_COOLDOWN_MS;
}

function noteCampaignJudgmentFailure(err: unknown): void {
    lastCampaignJudgmentFailureAt = Date.now();
    console.warn(
        `[campaignJudgments] Jev System One unavailable — deterministic baseline in use for ${CAMPAIGN_JUDGMENT_COOLDOWN_MS / 1000}s:`,
        err instanceof TypesafeClientError
            ? `${err.kind}: ${err.message}`
            : err instanceof Error
                ? err.message
                : String(err),
    );
}

/** Test hook: resets the failure cooldown so unit tests stay order-independent. */
export function __resetCampaignJudgmentCooldownForTests(): void {
    lastCampaignJudgmentFailureAt = 0;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Deterministic baseline judgment — always available, zero network latency.
 */
export function heuristicCampaignJudgment(
    directive: UnifiedCampaignDirective,
    priorTelemetry: ReadonlyArray<PlatformTelemetrySnapshot> = [],
): CampaignAllocationJudgment {
    const splits = { ...directive.budgetAllocation.platformSplitPercentages };

    // Pick dominant platform by lowest non-zero costPerConversionCents in prior telemetry,
    // or fallback to highest configured split percentage.
    let dominantPlatform: SupportedAdPlatform = directive.platforms[0] ?? 'META';

    const rankedTelemetry = priorTelemetry
        .filter(
            snap =>
                directive.platforms.includes(snap.platform) &&
                snap.conversions > 0 &&
                snap.costPerConversionCents > 0,
        )
        .sort((a, b) => a.costPerConversionCents - b.costPerConversionCents);

    if (rankedTelemetry.length > 0) {
        dominantPlatform = rankedTelemetry[0]!.platform;
    } else {
        let bestPct = -1;
        for (const platform of directive.platforms) {
            const pct = splits[platform] ?? 0;
            if (pct > bestPct) {
                bestPct = pct;
                dominantPlatform = platform;
            }
        }
    }

    const hasSpark = (directive.assets.tiktokSparkAuthCodes?.length ?? 0) > 0;
    const hasYouTube = (directive.assets.youtubeVideoIds?.length ?? 0) > 0;
    const hasVideo = directive.assets.videoAssetIds.length > 0;
    const creativeFitScore = hasSpark && hasYouTube && hasVideo ? 5 : hasVideo ? 4 : 3;

    return {
        dominantPlatform,
        refinedSplitPercentages: splits,
        creativeFitScore,
        creativeReadinessConfirmed: true,
        source: 'heuristic',
    };
}

/**
 * Applies a bounded tilt (+10 percentage points to `dominantPlatform` when
 * `creativeFitScore >= 4`, or +5 percentage points when `creativeFitScore >= 3`)
 * while preserving the 10% floor on every other platform and ensuring the
 * percentages across `directive.platforms` sum to exactly 100.
 */
export function computeBoundedSplitRefinement(
    platforms: ReadonlyArray<SupportedAdPlatform>,
    baseSplits: Partial<Record<SupportedAdPlatform, number>>,
    dominantPlatform: SupportedAdPlatform,
    creativeFitScore: number,
): Partial<Record<SupportedAdPlatform, number>> {
    if (platforms.length <= 1 || !platforms.includes(dominantPlatform)) {
        return { ...baseSplits };
    }

    const boost = creativeFitScore >= 4 ? 10 : creativeFitScore >= 3 ? 5 : 0;
    if (boost === 0) {
        return { ...baseSplits };
    }

    const result: Partial<Record<SupportedAdPlatform, number>> = {};
    const otherPlatforms = platforms.filter(p => p !== dominantPlatform);

    let totalDeduction = 0;
    for (const p of otherPlatforms) {
        const current = baseSplits[p] ?? 0;
        const maxDeductible = Math.max(0, current - PLATFORM_MIN_SPLIT_FLOOR_PCT);
        const targetDeduction = Math.min(
            maxDeductible,
            Math.floor(boost / otherPlatforms.length),
        );
        result[p] = current - targetDeduction;
        totalDeduction += targetDeduction;
    }

    result[dominantPlatform] = (baseSplits[dominantPlatform] ?? 0) + totalDeduction;
    return result;
}

/**
 * Evaluates a `UnifiedCampaignDirective` and optional historical telemetry with
 * Jev (`jev-latest`) via TypeSafe System One.
 */
export async function evaluateCampaignAllocationWithJev(
    directive: UnifiedCampaignDirective,
    priorTelemetry: ReadonlyArray<PlatformTelemetrySnapshot> = [],
    options?: { client?: TypesafeClient },
): Promise<CampaignAllocationJudgment> {
    const baseline = heuristicCampaignJudgment(directive, priorTelemetry);

    if (directive.platforms.length <= 1) {
        return baseline;
    }

    if (!options?.client && !typesafeApiKey.value()) {
        return baseline;
    }

    if (!options?.client && !campaignJudgmentsAvailable()) {
        return baseline;
    }

    let client: TypesafeClient;
    try {
        client = options?.client ?? getServerTypesafeClient();
    } catch (err) {
        noteCampaignJudgmentFailure(err);
        return baseline;
    }

    const platformCriteria: Record<string, string> = {};
    if (directive.platforms.includes('META')) {
        platformCriteria.META =
            'Prioritize Meta (Instagram/Facebook Reels & Stories + CAPI) when visual/video assets and custom audiences align with direct smartlink conversion.';
    }
    if (directive.platforms.includes('TIKTOK')) {
        platformCriteria.TIKTOK =
            'Prioritize TikTok (Spark Ads + TikTok Events API) when organic artist Spark auth codes or short-form vertical teasers show strongest viral momentum or lowest CPA.';
    }
    if (directive.platforms.includes('GOOGLE_ADS')) {
        platformCriteria.GOOGLE_ADS =
            'Prioritize Google Ads (YouTube Video Action / PMax + Enhanced Conversions) when YouTube video assets or high-intent search/video conversions lead efficiency.';
    }

    const state: Record<string, unknown> = {
        directiveId: directive.directiveId,
        objective: directive.objective,
        platforms: directive.platforms,
        budgetAllocation: directive.budgetAllocation,
        assetInventory: {
            videoCount: directive.assets.videoAssetIds.length,
            imageCount: directive.assets.imageAssetIds.length,
            sparkAuthCodeCount: directive.assets.tiktokSparkAuthCodes?.length ?? 0,
            youtubeVideoCount: directive.assets.youtubeVideoIds?.length ?? 0,
        },
        targeting: {
            geoLocations: directive.targeting.geoLocations,
            genreTaxonomyTags: directive.targeting.genreTaxonomyTags,
            hasCustomAudiences: Boolean(directive.targeting.customAudienceIds),
        },
        priorTelemetry: priorTelemetry.map(t => ({
            platform: t.platform,
            spendCents: t.spendCents,
            outboundDspClicks: t.outboundDspClicks,
            conversions: t.conversions,
            costPerOutboundClickCents: t.costPerOutboundClickCents,
            costPerConversionCents: t.costPerConversionCents,
        })),
    };

    const questions: Record<string, unknown> = {
        dominant_platform: {
            type: 'choice',
            instructions:
                'Select which requested ad platform in `platforms` should receive the primary budget weighting for this post-mastering release directive based on `objective`, `assetInventory`, and `priorTelemetry`.',
            criteria: platformCriteria,
        },
        creative_fit_score: {
            type: 'score',
            instructions:
                'Rate how complete and native the post-mastering `assetInventory` is for the requested `platforms`.',
            criteria: {
                1: 'Only static images are available while video-first networks (TikTok or YouTube) are requested.',
                2: 'Generic video assets exist without native platform identifiers (no Spark auth codes or YouTube IDs).',
                3: 'Verified video and image assets cover the requested platforms adequately.',
                4: 'Strong native coverage including platform-specific Spark auth codes or YouTube video IDs.',
                5: 'Complete multi-platform asset coverage with verified video teasers, artwork, TikTok Spark auth codes, and YouTube asset IDs.',
            },
        },
        creative_readiness_confirmed: {
            type: 'noul',
            instructions:
                'Does `assetInventory` provide sufficient verified post-mastering assets to execute `objective` across the requested `platforms`?',
        },
    };

    try {
        const result = await client.judge({ state, questions });
        const dominantRaw = result.answers['dominant_platform'];
        const fitScoreRaw = result.answers['creative_fit_score'];
        const readinessRaw = result.answers['creative_readiness_confirmed'];

        let dominantPlatform = baseline.dominantPlatform;
        let confidence: number | undefined;

        if (isPlainObject(dominantRaw)) {
            const choice = dominantRaw['choice'];
            const conf =
                typeof dominantRaw['confidence'] === 'number' &&
                Number.isFinite(dominantRaw['confidence'])
                    ? dominantRaw['confidence']
                    : undefined;
            confidence = conf;

            if (
                (choice === 'META' || choice === 'TIKTOK' || choice === 'GOOGLE_ADS') &&
                directive.platforms.includes(choice) &&
                (conf === undefined || conf >= DOMINANT_PLATFORM_MIN_CONFIDENCE)
            ) {
                dominantPlatform = choice;
            }
        }

        let creativeFitScore = baseline.creativeFitScore;
        if (isPlainObject(fitScoreRaw) && typeof fitScoreRaw['score'] === 'number') {
            const rawScore = fitScoreRaw['score'];
            if (Number.isFinite(rawScore) && rawScore >= 1 && rawScore <= 5) {
                creativeFitScore = Math.round(rawScore * 100) / 100;
            }
        }

        let creativeReadinessConfirmed = baseline.creativeReadinessConfirmed;
        if (isPlainObject(readinessRaw) && typeof readinessRaw['noul'] === 'number') {
            creativeReadinessConfirmed = readinessRaw['noul'] >= 0.35;
        }

        const refinedSplitPercentages =
            confidence !== undefined && confidence >= DOMINANT_PLATFORM_MIN_CONFIDENCE
                ? computeBoundedSplitRefinement(
                    directive.platforms,
                    directive.budgetAllocation.platformSplitPercentages,
                    dominantPlatform,
                    creativeFitScore,
                )
                : baseline.refinedSplitPercentages;

        return {
            dominantPlatform,
            refinedSplitPercentages,
            creativeFitScore,
            creativeReadinessConfirmed,
            source: 'jev',
            confidence,
            requestId: result.requestId,
        };
    } catch (err) {
        noteCampaignJudgmentFailure(err);
        return baseline;
    }
}
