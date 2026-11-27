import { AutonomousIntelligence } from '@/services/intelligence/AutonomousIntelligence';
import { INTELLIGENCE_MODELS } from '@/core/config/intelligence-models';
import { logger } from '@/utils/logger';
import type { JSONSchemaObject } from '@/services/agent/instruments/InstrumentTypes';
import type { AdAspectShape, AdRefinementPatch } from '@indii/video-compiler';
import {
    runCreativeVisionCheck,
    type CreativeBrandKit,
    type VisionCheckResult,
} from './BrandVisionQC';

/**
 * VideoAdAutorater — Level 5 Multimodal Ad Cut Judge (Score /10 + BrandVisionQC)
 *
 * Evaluates rendered short-form video / multi-shape ad cuts across 5 criteria
 * (0–10 each) via the server-enforced `evaluateVideoAdCut` Cloud Function
 * (`gemini-4-neon`), falling back to `INTELLIGENCE_MODELS.TEXT.CONDUCTOR`
 * only when Firebase Functions is unavailable/uninitialized (never on auth,
 * Arcjet, or budget denials), and enforces the `BrandVisionQC` hard gate.
 *
 * Rules:
 * - Pass threshold: `overallScore >= 9.0` AND `brandQc.approved === true` (when brandKit provided).
 * - Auto-redo loop: up to `MAX_CORRECTION_ATTEMPTS` (2) targeted refinements.
 * - Regression guard: if a retry scores LOWER than the prior attempt, stop immediately
 *   and hold the cut back (never ship a degraded cut).
 */

export const VIDEO_AD_PASS_THRESHOLD = 9.0;
export const VIDEO_AD_MAX_CORRECTION_ATTEMPTS = 2;

const SERVER_DENIAL_CODES = new Set([
    'unauthenticated',
    'permission-denied',
    'resource-exhausted',
    'invalid-argument',
    'failed-precondition',
    'internal',
    'aborted',
    'data-loss',
]);

type ServerEvaluationAttempt =
    | { status: 'ok'; score: VideoAdEvaluationScore }
    | { status: 'denied'; reason: string }
    | { status: 'fallback' };

export interface VideoAdEvaluationScore {
    firstTwoSecondHook: number;
    mobileLegibility: number;
    safeZoneIntegrity: number;
    audioVisualPacing: number;
    brandAlignment: number;
    overallScore: number;
    overallPass: boolean;
    gapsFound: string;
    refinementPatch?: AdRefinementPatch;
}

export interface VideoAdEvaluationInput {
    variantId: string;
    shape: AdAspectShape;
    durationSeconds: number;
    briefSummary: string;
    /** Keyframe strip (e.g. 0.5s, 1.5s, mid-cut, end-card) as base64 JPEG/PNG strings */
    keyframeBase64List: string[];
    mimeType?: string;
    brandKit?: CreativeBrandKit;
}

export interface VideoAdAutoRedoResult {
    variantId: string;
    shape: AdAspectShape;
    durationSeconds: number;
    approved: boolean;
    discardedForRegression: boolean;
    attemptsUsed: number;
    bestScore: VideoAdEvaluationScore | null;
    brandQc: VisionCheckResult | null;
    appliedPatches: AdRefinementPatch[];
    history: Array<{ attempt: number; overallScore: number; brandApproved: boolean; gapsFound: string }>;
}

const SCORE_SCHEMA: JSONSchemaObject = {
    type: 'object',
    properties: {
        firstTwoSecondHook: { type: 'number', description: '0-10: Is the artist, product, or hook unmistakable within the first 2 seconds?' },
        mobileLegibility: { type: 'number', description: '0-10: Can every line of text be read cleanly on a mobile phone screen?' },
        safeZoneIntegrity: { type: 'number', description: '0-10: Is all text/logo/subject clear of platform UI overlays with nothing cut off?' },
        audioVisualPacing: { type: 'number', description: '0-10: Do visual energy and scene transitions fit the target ad duration and hook?' },
        brandAlignment: { type: 'number', description: '0-10: Does palette, mood, and typography match the brand/artist identity?' },
        overallScore: { type: 'number', description: '0-10 weighted overall ad quality score.' },
        overallPass: { type: 'boolean', description: 'True only if this cut is launch-ready (>= 9.0/10).' },
        gapsFound: { type: 'string', description: 'Specific defects found, or "None" if launch-ready.' },
        refinementPatch: {
            type: 'object',
            properties: {
                fontScaleMultiplier: { type: 'number', description: 'Optional 0.75-1.25 scale adjustment.' },
                extraSafeMarginPct: { type: 'number', description: 'Optional 0.0-0.10 additional safe margin.' },
                headlineOverride: { type: 'string', description: 'Optional shorter/punchier headline if current copy overflows.' },
                ctaOverride: { type: 'string', description: 'Optional tighter CTA if current CTA clips.' },
            },
        },
    },
    required: [
        'firstTwoSecondHook',
        'mobileLegibility',
        'safeZoneIntegrity',
        'audioVisualPacing',
        'brandAlignment',
        'overallScore',
        'overallPass',
        'gapsFound',
    ],
};

function clampScore(value: unknown): number {
    const num = typeof value === 'number' && Number.isFinite(value) ? value : 0;
    return Math.round(Math.max(0, Math.min(10, num)) * 10) / 10;
}

function sanitizeRefinementPatch(rawPatch: AdRefinementPatch | undefined): AdRefinementPatch | undefined {
    if (!rawPatch || typeof rawPatch !== 'object') {
        return undefined;
    }
    const patch: AdRefinementPatch = {};
    if (typeof rawPatch.fontScaleMultiplier === 'number' && Number.isFinite(rawPatch.fontScaleMultiplier)) {
        patch.fontScaleMultiplier =
            Math.round(Math.max(0.75, Math.min(1.25, rawPatch.fontScaleMultiplier)) * 100) / 100;
    }
    if (typeof rawPatch.extraSafeMarginPct === 'number' && Number.isFinite(rawPatch.extraSafeMarginPct)) {
        patch.extraSafeMarginPct =
            Math.round(Math.max(0, Math.min(0.1, rawPatch.extraSafeMarginPct)) * 1000) / 1000;
    }
    if (typeof rawPatch.headlineOverride === 'string' && rawPatch.headlineOverride.trim()) {
        patch.headlineOverride = rawPatch.headlineOverride.trim().slice(0, 160);
    }
    if (typeof rawPatch.ctaOverride === 'string' && rawPatch.ctaOverride.trim()) {
        patch.ctaOverride = rawPatch.ctaOverride.trim().slice(0, 80);
    }
    return Object.keys(patch).length > 0 ? patch : undefined;
}

export class VideoAdAutorater {
    static readonly PASS_THRESHOLD = VIDEO_AD_PASS_THRESHOLD;
    static readonly MAX_CORRECTION_ATTEMPTS = VIDEO_AD_MAX_CORRECTION_ATTEMPTS;

    static doesPass(score: VideoAdEvaluationScore | null, brandQc: VisionCheckResult | null): boolean {
        if (!score) return false;
        if (!score.overallPass || score.overallScore < this.PASS_THRESHOLD) return false;
        if (brandQc && !brandQc.approved) return false;
        return true;
    }

    private static async evaluateViaServerCallable(
        input: VideoAdEvaluationInput,
        mimeType: string,
    ): Promise<ServerEvaluationAttempt> {
        try {
            const { getFunctions, httpsCallable } = await import('firebase/functions');
            const fn = httpsCallable<
                {
                    variantId: string;
                    shape: AdAspectShape;
                    durationSeconds: number;
                    briefSummary: string;
                    keyframeBase64List: string[];
                    mimeType: string;
                },
                VideoAdEvaluationScore
            >(getFunctions(), 'evaluateVideoAdCut');

            const response = await fn({
                variantId: input.variantId,
                shape: input.shape,
                durationSeconds: input.durationSeconds,
                briefSummary: input.briefSummary,
                keyframeBase64List: input.keyframeBase64List.slice(0, 4),
                mimeType,
            });

            if (response?.data && typeof response.data.overallScore === 'number') {
                return { status: 'ok', score: response.data };
            }
            return { status: 'fallback' };
        } catch (err: unknown) {
            const rawCode =
                typeof (err as { code?: unknown })?.code === 'string'
                    ? (err as { code: string }).code.replace(/^functions\//, '')
                    : '';
            if (SERVER_DENIAL_CODES.has(rawCode)) {
                const reason = err instanceof Error ? err.message : rawCode;
                logger.warn(`[VideoAdAutorater] Server evaluation denied (${rawCode}): ${reason}`);
                return { status: 'denied', reason };
            }
            return { status: 'fallback' };
        }
    }

    static async evaluateCut(input: VideoAdEvaluationInput): Promise<{
        score: VideoAdEvaluationScore | null;
        brandQc: VisionCheckResult | null;
    }> {
        if (!input.keyframeBase64List.length) {
            return {
                score: null,
                brandQc: input.brandKit
                    ? { approved: false, reason: 'No keyframes were supplied for video ad inspection.' }
                    : null,
            };
        }

        const mimeType = input.mimeType ?? 'image/jpeg';

        // Invoke server callable BEFORE starting BrandVisionQC so auth/Arcjet/budget
        // denials fail closed without triggering unbilled client vision checks.
        let rawScore: VideoAdEvaluationScore | null = null;
        const serverResult = await this.evaluateViaServerCallable(input, mimeType);
        if (serverResult.status === 'ok') {
            rawScore = serverResult.score;
        } else if (serverResult.status === 'denied') {
            return {
                score: null,
                brandQc: input.brandKit
                    ? { approved: false, reason: `Server evaluation denied: ${serverResult.reason}` }
                    : null,
            };
        }

        const brandQcPromise = input.brandKit
            ? runCreativeVisionCheck(input.keyframeBase64List[0]!, input.brandKit, mimeType).catch((err) => ({
                  approved: false,
                  reason: err instanceof Error ? err.message : String(err),
              }))
            : Promise.resolve(null);

        if (!rawScore) {
            const prompt = [
                `You are a strict Performance Creative Director evaluating a ${input.durationSeconds}s ${input.shape} video ad cut.`,
                `CAMPAIGN BRIEF: ${input.briefSummary}`,
                'You are viewing ordered keyframes captured from this cut (opening 0-2s hook, mid-body, and CTA end-card).',
                'Score each dimension strictly from 0 to 10 (decimals allowed, e.g. 8.8 or 9.5):',
                '1. firstTwoSecondHook: Is the subject/product/hook unmistakable in the first 2 seconds?',
                '2. mobileLegibility: Can every word be read effortlessly on a phone screen?',
                '3. safeZoneIntegrity: Is anything cut off or likely covered by Reels/TikTok/Shorts UI chrome?',
                '4. audioVisualPacing: Does visual pacing match a high-converting ad for this duration?',
                '5. brandAlignment: Does color, typography, and mood match the brief?',
                'Only set overallPass=true if overallScore >= 9.0 and there are zero clipping or legibility defects.',
                'If overallScore < 9.0, supply a concrete refinementPatch (e.g. fontScaleMultiplier, extraSafeMarginPct, headlineOverride).',
            ].join('\n');

            const parts: Array<Record<string, unknown>> = [{ text: prompt }];
            for (const frame of input.keyframeBase64List.slice(0, 4)) {
                const base64Data = frame.includes('base64,') ? frame.split('base64,')[1] : frame;
                parts.push({ inlineData: { data: base64Data, mimeType } });
            }

            rawScore = await AutonomousIntelligence.generateStructuredData<VideoAdEvaluationScore>(
                parts,
                SCORE_SCHEMA as unknown as Record<string, unknown>,
                undefined,
                undefined,
                INTELLIGENCE_MODELS.TEXT.CONDUCTOR,
            ).catch(err => {
                logger.error('[VideoAdAutorater] Multimodal evaluation failed:', err);
                return null;
            });
        }

        const brandQc = await brandQcPromise;

        if (!rawScore) {
            return { score: null, brandQc };
        }

        const sanitizedPatch = sanitizeRefinementPatch(rawScore.refinementPatch);
        const normalized: VideoAdEvaluationScore = {
            firstTwoSecondHook: clampScore(rawScore.firstTwoSecondHook),
            mobileLegibility: clampScore(rawScore.mobileLegibility),
            safeZoneIntegrity: clampScore(rawScore.safeZoneIntegrity),
            audioVisualPacing: clampScore(rawScore.audioVisualPacing),
            brandAlignment: clampScore(rawScore.brandAlignment),
            overallScore: clampScore(rawScore.overallScore),
            overallPass: Boolean(rawScore.overallPass) && clampScore(rawScore.overallScore) >= this.PASS_THRESHOLD,
            gapsFound: rawScore.gapsFound?.trim() || 'None',
            ...(sanitizedPatch ? { refinementPatch: sanitizedPatch } : {}),
        };

        return { score: normalized, brandQc };
    }

    /**
     * Runs the Level 5 evaluation loop:
     * - Scores the initial cut.
     * - If < 9.0/10 (or Brand QC fails), applies the suggested refinement patch and
     *   re-renders via `onRefine` up to `MAX_CORRECTION_ATTEMPTS` times.
     * - If a retry scores LOWER than the previous attempt, halts and flags
     *   `discardedForRegression: true` so degraded cuts never ship.
     */
    static async evaluateWithAutoRedo(
        initialInput: VideoAdEvaluationInput,
        onRefine?: (patch: AdRefinementPatch, attempt: number) => Promise<string[]>,
    ): Promise<VideoAdAutoRedoResult> {
        const history: VideoAdAutoRedoResult['history'] = [];
        const appliedPatches: AdRefinementPatch[] = [];
        let currentKeyframes = initialInput.keyframeBase64List;
        let bestScore: VideoAdEvaluationScore | null = null;
        let lastBrandQc: VisionCheckResult | null = null;
        let previousOverallScore: number | null = null;
        let discardedForRegression = false;

        for (let attempt = 0; attempt <= this.MAX_CORRECTION_ATTEMPTS; attempt++) {
            const { score, brandQc } = await this.evaluateCut({
                ...initialInput,
                keyframeBase64List: currentKeyframes,
            });
            lastBrandQc = brandQc;

            const currentOverall = score?.overallScore ?? 0;
            history.push({
                attempt,
                overallScore: currentOverall,
                brandApproved: brandQc ? brandQc.approved : true,
                gapsFound: score?.gapsFound ?? brandQc?.reason ?? 'Evaluation failed',
            });

            if (score && (!bestScore || score.overallScore >= bestScore.overallScore)) {
                bestScore = score;
            }

            if (this.doesPass(score, brandQc)) {
                return {
                    variantId: initialInput.variantId,
                    shape: initialInput.shape,
                    durationSeconds: initialInput.durationSeconds,
                    approved: true,
                    discardedForRegression: false,
                    attemptsUsed: attempt,
                    bestScore: score,
                    brandQc,
                    appliedPatches,
                    history,
                };
            }

            // Regression guard: stop if a refinement made the cut worse
            if (previousOverallScore !== null && currentOverall < previousOverallScore) {
                discardedForRegression = true;
                break;
            }
            previousOverallScore = currentOverall;

            // Stop if no refiner callback or attempt cap reached
            if (!onRefine || attempt >= this.MAX_CORRECTION_ATTEMPTS) {
                break;
            }

            const patch: AdRefinementPatch = score?.refinementPatch ?? {
                fontScaleMultiplier: 0.9,
                extraSafeMarginPct: 0.04,
            };
            appliedPatches.push(patch);
            currentKeyframes = await onRefine(patch, attempt + 1);
        }

        return {
            variantId: initialInput.variantId,
            shape: initialInput.shape,
            durationSeconds: initialInput.durationSeconds,
            approved: false,
            discardedForRegression,
            attemptsUsed: appliedPatches.length,
            bestScore,
            brandQc: lastBrandQc,
            appliedPatches,
            history,
        };
    }
}
