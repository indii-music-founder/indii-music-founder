import {
    compileAdMatrixProjects,
    compileAdMatrixVariant,
    type AdMatrixBrief,
    type AdRefinementPatch,
    type CompiledAdMatrixVariant,
} from '@indii/video-compiler';
import {
    judgeAdMatrixCut,
    type AdMatrixCutState,
    type AdMatrixJevVerdict,
} from '@/config/typesafeJudgments';
import {
    VideoAdAutorater,
    type VideoAdAutoRedoResult,
} from '@/services/agent/governance/VideoAdAutorater';
import type { CreativeBrandKit } from '@/services/agent/governance/BrandVisionQC';

export interface ScoredAdMatrixVariant {
    variant: CompiledAdMatrixVariant;
    jevVerdict: AdMatrixJevVerdict;
    jevImproved: boolean;
    evaluation: VideoAdAutoRedoResult;
    renderUrl?: string;
}

export interface AdMatrixRunReport {
    campaignId: string;
    totalVariants: number;
    jevImprovedCount: number;
    approvedVariants: ScoredAdMatrixVariant[];
    heldBackVariants: ScoredAdMatrixVariant[];
    generatedAtIso: string;
}

export interface AdMatrixPreviewExtractor {
    /** Captures keyframe base64 snapshots for a compiled ad project so Gemini can inspect it. */
    extractKeyframes: (variant: CompiledAdMatrixVariant) => Promise<string[]>;
}

function toJevCutState(
    brief: AdMatrixBrief,
    variant: CompiledAdMatrixVariant,
    brandVibe?: string,
): AdMatrixCutState {
    const hookClip = variant.project.clips.find(c => c.id.endsWith('_hook'));
    const ctaClip = variant.project.clips.find(c => c.id.endsWith('_cta'));
    return {
        variantId: variant.variantId,
        shape: variant.shape,
        durationSeconds: variant.durationSeconds,
        channelLabel: variant.channelLabel,
        brandOrArtistName: brief.brandOrArtistName,
        hookHeadline: hookClip?.text ?? brief.hookHeadline,
        subHeadline: brief.subHeadline,
        ctaText: ctaClip?.text ?? brief.ctaText,
        safeWidthPx: hookClip?.width ?? Math.round(variant.project.width * 0.8),
        headlineFontSizePx: hookClip?.fontSize ?? variant.safeZone.baseHeadlineFontSize,
        ctaFontSizePx: ctaClip?.fontSize ?? variant.safeZone.baseCtaFontSize,
        brandVibe,
    };
}

/**
 * MultiShapeAdMatrixService
 *
 * Level 5 parallel workflow orchestrator:
 * 1. Compiles every requested (shape x duration) ad variant via `@indii/video-compiler`.
 * 2. Runs a fast TypeSafe System One (Jev) test/improve pass (`judgeAdMatrixCut`) on each
 *    cut and automatically applies `suggestedPatch` refinements before rendering.
 * 3. Fans out in parallel across all variants, capturing keyframes and scoring each cut
 *    out of 10 with `VideoAdAutorater` + `BrandVisionQC`.
 * 4. Automatically re-compiles cuts scoring < 9.0 with the suggested refinement patch,
 *    and separates launch-ready (`>= 9.0` + Brand QC approved) cuts from held-back cuts.
 */
export class MultiShapeAdMatrixService {
    static async generateAndScoreMatrix(
        brief: AdMatrixBrief,
        options: {
            brandKit?: CreativeBrandKit;
            previewExtractor?: AdMatrixPreviewExtractor;
            renderVariant?: (variant: CompiledAdMatrixVariant) => Promise<{ keyframes: string[]; renderUrl: string }>;
        } = {},
    ): Promise<AdMatrixRunReport> {
        const initialVariants = compileAdMatrixProjects(brief);

        const scoreVariant = async (initialVariant: CompiledAdMatrixVariant): Promise<ScoredAdMatrixVariant> => {
            let activeVariant = initialVariant;
            let jevVerdict = await judgeAdMatrixCut(
                toJevCutState(brief, activeVariant, options.brandKit?.vibe),
            );
            let jevImproved = false;

            if (!jevVerdict.passesPreFlight && jevVerdict.suggestedPatch) {
                const refinedVariant = compileAdMatrixVariant(
                    brief,
                    activeVariant.shape,
                    activeVariant.durationSeconds,
                    jevVerdict.suggestedPatch,
                );
                const refinedVerdict = await judgeAdMatrixCut(
                    toJevCutState(brief, refinedVariant, options.brandKit?.vibe),
                );
                if (refinedVerdict.compositeScore >= jevVerdict.compositeScore) {
                    activeVariant = refinedVariant;
                    jevVerdict = refinedVerdict;
                    jevImproved = true;
                }
            }

            let renderUrl: string | undefined;
            const capture = async (variant: CompiledAdMatrixVariant) => {
                if (!options.renderVariant) return options.previewExtractor?.extractKeyframes(variant) ?? [];
                const rendered = await options.renderVariant(variant);
                renderUrl = rendered.renderUrl;
                return rendered.keyframes;
            };
            const holdBack = (reason: string): ScoredAdMatrixVariant => ({
                variant: activeVariant,
                jevVerdict,
                jevImproved,
                evaluation: {
                    variantId: activeVariant.variantId,
                    shape: activeVariant.shape,
                    durationSeconds: activeVariant.durationSeconds,
                    approved: false,
                    discardedForRegression: false,
                    attemptsUsed: 0,
                    bestScore: null,
                    brandQc: null,
                    appliedPatches: [],
                    history: [{ attempt: 0, overallScore: 0, brandApproved: false, gapsFound: reason }],
                },
            });

            try {
                const initialKeyframes = await capture(activeVariant);
                if (!initialKeyframes.length) {
                    return holdBack('Awaiting rendered keyframes for Gemini 4 Neon /10 visual & brand inspection.');
                }

                const evaluation = await VideoAdAutorater.evaluateWithAutoRedo(
                    {
                        variantId: activeVariant.variantId,
                        shape: activeVariant.shape,
                        durationSeconds: activeVariant.durationSeconds,
                        briefSummary: `${brief.brandOrArtistName} — ${brief.title}: "${brief.hookHeadline}" -> CTA "${brief.ctaText}" (${activeVariant.channelLabel})`,
                        keyframeBase64List: initialKeyframes,
                        brandKit: options.brandKit,
                    },
                    async (patch: AdRefinementPatch) => {
                        activeVariant = compileAdMatrixVariant(
                            brief,
                            activeVariant.shape,
                            activeVariant.durationSeconds,
                            patch,
                        );
                        return capture(activeVariant);
                    },
                );

                return { variant: activeVariant, jevVerdict, jevImproved, evaluation, ...(renderUrl ? { renderUrl } : {}) };
            } catch (error) {
                const reason = error instanceof Error ? error.message : String(error);
                return holdBack(`Could not render or score this cut: ${reason}`);
            }
        };

        const scored: ScoredAdMatrixVariant[] = [];
        // Limit cloud render and refinement jobs per matrix to two at a time.
        const batchSize = options.renderVariant ? 2 : initialVariants.length || 1;
        for (let offset = 0; offset < initialVariants.length; offset += batchSize) {
            scored.push(...await Promise.all(initialVariants.slice(offset, offset + batchSize).map(scoreVariant)));
        }

        return {
            campaignId: brief.campaignId,
            totalVariants: scored.length,
            jevImprovedCount: scored.filter(item => item.jevImproved).length,
            approvedVariants: scored.filter(item => item.evaluation.approved),
            heldBackVariants: scored.filter(item => !item.evaluation.approved),
            generatedAtIso: new Date().toISOString(),
        };
    }
}
